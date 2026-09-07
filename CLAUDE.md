# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mobile ordering app + admin dashboard for ريحة الشام / Rihat Alsham, a real
fast-food restaurant in Medina, Saudi Arabia. `README.md` explains the product
and the reasoning behind the stack; read it for context, but see
"README drift" below — several of its statements are now out of date.

## Commands

```bash
# Run (from the repo root)
npm run dev:api                 # Express on :4000, tsx watch
npm run dev:admin               # Next.js on :3000
npm run dev:mobile              # Expo dev server

# Verify — run these after every change, before considering work done
npx tsc -p packages/api --noEmit
cd apps/mobile && npx tsc --noEmit
cd apps/mobile && npx expo export --platform ios    # the real Metro bundle
cd apps/mobile && npx expo-doctor

# Tests (no runner is configured; they are standalone scripts)
npx tsx --test apps/mobile/tests/auth.test.ts                    # pure units
cd packages/api && node -r dotenv/config scripts/test-auth-identity.js
cd packages/api && node -r dotenv/config scripts/test-loyalty.js
cd packages/api && node -r dotenv/config scripts/e2e-test.js     # needs the API running
cd packages/api && node -r dotenv/config scripts/create-staff.js # promote a user to staff/owner

# Database
docker compose up -d db
npm run db:migrate              # applies db/schema.sql WHOLESALE — see warning below
npm run db:seed
```

`npx expo export --platform ios` is the highest-value check in the repo. It runs
the same bundler a real build runs and catches module-resolution failures that
typechecking cannot — it is what finally explained a white-screen crash that
three TestFlight builds could not.

## Build economy

EAS meters builds per account per month (30 on the free plan). **Do not run a
build or a TestFlight submission per change.** Batch work, verify everything
verifiable locally, then spend one build. Say plainly which failures local
checks cannot catch — native pods, Apple sign-in entitlements, push tokens,
App Store review — because those only appear in a real build.

## Architecture

Four npm workspaces. `packages/shared` (types + bilingual ar/en strings) is
consumed by all three others and must be built before them — the root
`postinstall` does this, and both Dockerfiles build it explicitly.

**The phone never touches the database.** Everything goes through
`packages/api` to Postgres. Firebase is used for *authentication only* — no
Firestore, no Realtime Database, and Storage was dropped (see below). This is
why the whole class of "row-level rules let a user edit any column" bugs cannot
occur here; there is no client-writable database.

### Identity

Firebase issues the token; Postgres owns the account. `requireAuth` verifies the
ID token, then resolves or creates the `users` row keyed on `provider_uid`
(the Firebase UID) inside a transaction with an advisory lock. Everything
downstream trusts `req.user`, never the request body.

- **`role` has no write path from any route.** It is set at INSERT (default
  `customer`) and changed only via `scripts/create-staff.js` or direct SQL.
  Do not add an endpoint that writes it.
- `phone` is nullable — social sign-ins have no phone until they link one.
  Uniqueness is on `provider_uid`.
- A user *can* change their own email in Firebase, so `email` is stored but
  never used for any permission decision. Keep it that way.

### Money paths

Two places decide money, and both are deliberately paranoid:

- **Order pricing is fully server-computed.** `POST /api/orders` re-looks-up
  every item, variant and extra from the database. The client sends ids and
  quantities, never prices.
- **Only a confirmed Moyasar charge moves an order out of `pending_payment`.**
  The 3-D Secure callback re-fetches the payment from Moyasar rather than
  trusting its own query parameters. Staff cannot move an order out of
  `pending_payment` either — that route explicitly excludes it.
- **Loyalty points are reserved at checkout and deducted atomically at
  payment.** Checkout subtracts points already claimed by the customer's
  pending orders and takes `FOR UPDATE` on their row; settlement deducts the
  full cost or nothing, decided inside the UPDATE. This exists because a
  balance check alone let one balance fund several unpaid orders — five orders
  redeeming the same reward, all paid, only the first deduction finding points.

`DELIVERY_FEE` is a flat constant in `routes/orders.ts`.

### Realtime

Socket.IO rooms are `admin` (staff/owner) and `user:<database id>`. **The role
is read from Postgres using the verified UID, never from the handshake** — the
comment in `server.ts` explains what trusting the client cost. Both the room
name and every emit key on the *database* id, not the Firebase UID; those two
were mismatched once and customers silently received no order updates at all.

### Chat media

Uploads go to `POST /api/orders/:orderId/media` and are served back from the
same prefix. They do **not** go to Firebase Storage — Google now requires a
billing account for it, and Storage rules cannot read our database, so they
could only check that *someone* was signed in, not that this customer owns the
order. `routes/media.ts` reuses `loadAuthorizedOrder` from `routes/messages.ts`
so the upload and the chat enforce identical ownership.

Files land on `MEDIA_DIR` (a mounted Railway volume at `/data/media`); the
container filesystem is wiped on deploy. Filenames carry 256 bits of randomness
and reads are unauthenticated by design — an `<Image>` tag cannot carry an
Authorization header that survives its ID token expiring.

### Rate limiting

Global 240/min; 20/min on `/api/orders` and `/api/payments`. Two deliberate
exemptions in `server.ts`: Moyasar's callback (dropping one loses a real
payment) and all GETs (the write limiter is mounted on the whole `/api/orders`
prefix, so it was counting order fetches, chat polls and inline photos).

## Mobile specifics

- **`apps/mobile/index.js` is the entry point**, not `expo/AppEntry.js`, which
  resolves `../../App` to the monorepo root once Expo is hoisted. It loads
  `App.tsx` inside try/catch and renders the error on screen — module-level
  throws otherwise produce a white screen with nothing reported anywhere.
- **`metro.config.js` sets `unstable_enablePackageExports = false`.** Firebase
  v10 has no `react-native` export condition on its umbrella subpaths, so
  package-exports resolution produces two `@firebase/app` instances and startup
  dies with "Component auth has not been registered yet". The same file pins
  react/react-dom/react-native to this app's copy, because the root hoists a
  different React for the Next.js admin.
- **`src/lib/recaptcha/` is vendored** from the removed `expo-firebase-recaptcha`,
  which pulled native Firebase pods that broke `pod install`. Do not reinstall
  that package. It is mounted once in `AuthContext` with
  `attemptInvisibleVerification` — without that prop every sign-in shows the
  full "select all the buses" challenge.
- Startup must always reach `loading: false`; `AuthContext` has a 20s failsafe.
- `expo-file-system`'s `uploadAsync` lives at `expo-file-system/legacy` in SDK 54.

## Database migrations

`npm run db:migrate` applies `db/schema.sql` **wholesale** and is for creating a
fresh database only. Never run it against the live database.

Incremental changes are numbered files in `db/migrations/`. The API's Dockerfile
CMD runs `scripts/migrate-auth.js` before starting the server. Keep that script's
ordered list in sync when adding a migration; all listed migrations must be safe
to run again after a container restart.

## Deployment

Railway project `laudable-nourishment`, three services: `api`,
`@rihasham/admin`, `Postgres`. Both web services listen on Railway's injected
`PORT` (8080) — domains must target that port, not 4000/3000. Railway overrides
the Dockerfile CMD with `npm start` for the admin service, which is why its
start script is `node server.js` against a Next.js standalone build.

`api.rihatalsham.com` / `admin.rihatalsham.com` are Cloudflare CNAMEs that must
stay **DNS-only (grey cloud)**; the proxy breaks Railway's TLS. Use
`railway domain status <domain>` to read the exact CNAME target and TXT
verification token — they are not the service's `.up.railway.app` hostname, and
guessing them wastes an hour.

## Working with the user

They are a doctor, not a developer, and say so: *"I'm not an expert, I'm still
learning."* Console work needs exact click-by-click steps — which menu, which
button, what the field is called — and an explanation of what a thing is *for*,
not just what to press. Name the money: what it costs, whether a limit can be
set, what the real risk is. They are cost-sensitive and have read about a
surprise-bill incident; treat that as a live concern rather than a hypothetical.

Verify claims against the live systems rather than reasoning from the code
alone — the Expo GraphQL API (`~/.expo/state.json` holds the session secret),
`railway status --json`, `railway usage`, `dig`, and Firebase's REST endpoints
have each overturned an assumption in this repo. Report what was actually
confirmed versus what was inferred.

**Another agent (Codex) works in this repo concurrently.** Check `git status`
before editing; leave its uncommitted files alone and commit only your own.

## README drift

`README.md` is otherwise accurate but states several things that are no longer
true: hosting is **Railway**, not Vercel; chat media goes to **our own API**,
not Firebase Storage; `expo-firebase-recaptcha` has been **removed and
vendored**; and it refers to `packages/mobile/...` for files that live in
`apps/mobile/...`. `SETUP.md` is a user-facing external-services checklist and
is likewise partly stale — Google and Apple sign-in are already enabled on the
live Firebase project.

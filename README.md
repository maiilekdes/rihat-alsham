# Rihasham (ريحا الشام)

Mobile ordering app + restaurant admin dashboard for a Medina-based fast-food
restaurant serving shawarma, mishawi/kebab grills, falafel, oven-baked
maajanat, and beverages.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | React Native (Expo, TypeScript) | One codebase for iOS + Android; Expo's managed workflow speeds up the auth/notifications/localization plumbing this app needs. |
| Admin dashboard | Next.js 14 (App Router) | Server-friendly React, easy Vercel deploy, shares TypeScript types with the API via the `packages/shared` workspace. |
| Backend API | Node.js + Express + PostgreSQL (`pg`) | Relational data (orders, payments, menu variants) fits Postgres well; Express keeps the payment-gating logic explicit and easy to audit. |
| Realtime | Socket.IO | Powers the admin live order queue and per-customer order tracking. |
| Auth | Firebase Authentication | Native phone-OTP, Google, and Facebook sign-in out of the box; the backend verifies Firebase ID tokens on every request rather than issuing its own session tokens. |
| Payments | **Moyasar** | Saudi-based gateway with first-class native Mada support alongside Visa/Mastercard, a hosted-fields JS SDK (card data never touches our servers), and straightforward REST + webhook integration. |
| Push notifications | Firebase Cloud Messaging | Order-status pushes to the customer's device. |
| Hosting | Vercel (admin + API), managed Postgres (Supabase/RDS) | Standard, low-ops path for both. |

## Repo layout

```
rihasham/
  apps/
    mobile/        Expo React Native customer app
    admin/         Next.js staff/owner dashboard
  packages/
    api/            Express + PostgreSQL backend (REST API + Socket.IO)
    shared/          Shared TypeScript types + bilingual (ar/en) strings
  db/
    schema.sql       Full Postgres schema
    seed.sql          Sample menu (shawarma, mishawi/kebab, falafel, maajanat, beverages)
  docker-compose.yml  Local Postgres for development
```

## Two apps, not one — and why

The customer app (`apps/mobile`) and the restaurant side (`apps/admin`) are
deliberately **separate surfaces**, not one app with a role toggle — the same
pattern Talabat, HungerStation, Uber Eats, and DoorDash all use:

- **Security**: restaurant/staff logic and other customers' order data never
  ship inside the binary every customer downloads.
- **Update speed**: the restaurant side is a **web app** on purpose. Menu/stock
  changes, order-queue tweaks, etc. deploy instantly — no App Store review
  cycle. It's already mobile-responsive, so staff can run it from a phone
  browser today without needing a native "staff app" at all.
- A future courier/rider role (independent delivery partners claiming
  available orders, like Talabat's rider model) would be a third surface
  later — the schema already has room for it (`orders.status` has
  `out_for_delivery`; adding a `couriers` table + `assigned_courier_id` slots
  in without reworking anything here).

## Sign-in methods

Phone OTP (primary), Google, Facebook, and **Sign in with Apple**. Apple isn't
optional — App Store review guideline 4.8 requires it on iOS builds that offer
any other third-party login, so it's wired in from the start rather than
bolted on before submission. It only ever appears on iOS (Android has no
equivalent, which is expected and compliant). None of the three social
providers hand over a verified phone number, so all three funnel into the
same "add and verify your phone" step before a first order, per the business
rule that every account needs one on file.

## Order-scoped delivery chat

Each order gets its own two-way chat thread (`order_messages` table) — the
customer can send text or a photo/video (building, door, landmark) from the
Order Tracking screen; staff see and reply from a panel opened off that
order's card in the live queue. Delivered over the same Socket.IO connection
used for order-status updates, with an FCM push to whichever side didn't send
the message. Media uploads go straight from the device/browser to **Firebase
Storage** — set up a bucket on the same Firebase project used for auth; no
extra env var is needed beyond the existing `FIREBASE_*` service account,
since uploads happen client-side via the Firebase Storage SDK and the API
only ever stores the resulting download URL.

## Critical business rule: no unpaid order reaches the kitchen

- The mobile app **never** talks to Moyasar's charge API directly for order
  placement. `POST /api/orders` creates an order in `pending_payment` status
  with **server-computed** pricing (menu prices/variants/extras are re-looked-up
  from the DB — the client's numbers are never trusted).
- `POST /api/payments/charge` is the only path that can flip an order to
  `received` (visible to the admin queue), and it only does so after Moyasar
  confirms the charge was authorized/captured. A decline leaves the order
  stuck in `pending_payment` — it's invisible to staff and the customer sees
  a retry/different-card prompt.
- Raw card data is entered into Moyasar's own hosted-fields JS (loaded in a
  WebView on mobile); our backend only ever receives a Moyasar **token**,
  keeping us out of PCI DSS scope for cardholder data.
- 3D Secure step-ups are handled via `GET /api/payments/callback`, which
  re-fetches the payment status from Moyasar's API directly rather than
  trusting redirect query params.

## Local setup

### 1. Database

```bash
docker compose up -d db
cp packages/api/.env.example packages/api/.env   # fill in DATABASE_URL, etc.
npm install
npm run db:migrate
npm run db:seed
```

### 2. Environment variables

**`packages/api/.env`**
- `DATABASE_URL` — Postgres connection string
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — a
  Firebase service account (Project Settings → Service Accounts → Generate
  new private key)
- `MOYASAR_SECRET_KEY` — from the Moyasar dashboard (test mode key while developing)
- `CORS_ORIGIN` — comma-separated origins allowed to call the API

**`apps/admin/.env.local`**
- `NEXT_PUBLIC_API_URL` — e.g. `http://localhost:4000`
- `NEXT_PUBLIC_FIREBASE_*` — the Firebase **web** app config (Project Settings → General → Your apps)

**`apps/mobile/app.json` → `expo.extra`** (or an `.env` read via `expo-constants`)
- `apiUrl` — the API's base URL
- `moyasarPublishableKey` — Moyasar's publishable key (safe to ship in the client)
- Firebase config for the mobile app, plus Google/Facebook OAuth client IDs
  for `expo-auth-session` (see `src/screens/Auth/LoginScreen.tsx`)

Staff/owner accounts sign into the **admin dashboard** with Firebase
email+password (create them via the Firebase console or Admin SDK, then set
`role = 'staff'` / `'owner'` on their `users` row — the seed data creates one
`owner` row already, at `+966500000000`).

### 3. Run everything

```bash
npm run dev:api      # http://localhost:4000
npm run dev:admin     # http://localhost:3000
npm run dev:mobile    # Expo dev server — scan the QR code with Expo Go,
                      # or press i / a for an iOS/Android simulator
```

## What's implemented vs. left as follow-up

Implemented end-to-end: bilingual (ar/en) menu browsing with real RTL layout,
cart → checkout → Moyasar-tokenized payment → order creation gated on a
successful charge, live Socket.IO order queue with accept/status-update/cancel
on the admin side, stock toggling, basic sales/best-seller analytics by
payment method, phone-OTP as the primary login with Google/Facebook plus a
forced "add a verified phone" step for social sign-ups, FCM push
notifications on status change, and a two-way order-scoped delivery chat
(text + photo/video) between customer and staff.

Left as clearly-flagged follow-up before a real launch:
- End-to-end test coverage and CI.
- Production hardening of the Moyasar WebView flow against the *current*
  Moyasar API docs (`packages/mobile/src/components/MoyasarCardForm.tsx`) —
  double-check the tokenize vs. charge split against their latest reference
  before going live.
- Native phone-OTP reCAPTCHA in production typically wants an EAS custom dev
  client rather than Expo Go; `expo-firebase-recaptcha` covers managed-workflow
  development.
- Delivery-fee/zone logic beyond the flat `DELIVERY_FEE` constant.
- Role management UI (creating/removing staff accounts) — currently a manual
  DB/Firebase step.
- Image upload pipeline for menu photos (currently a plain `image_url` field —
  wire up a CDN/object-storage upload from the admin dashboard).

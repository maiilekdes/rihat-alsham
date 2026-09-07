# Authentication repair — 2026-09-06

## Confirmed causes and changes

- Firebase phone authentication was enabled, but its SMS region allowlist was empty. Updated the live project to allow Saudi Arabia (`SA`). Existing Firebase test phone numbers do not receive actual SMS.
- Apple was absent from Firebase's enabled providers. Enabled `apple.com` for `sa.rihasham.app`. Added Expo's Apple plugin and checked the generated sign-in entitlement.
- Google had placeholder OAuth IDs in the app and outdated Firebase native configuration files. Retrieved the current files from Firebase and replaced the browser flow with native Google sign-in using the real web/iOS client IDs. Android's Firebase configuration still needs the signing certificate SHA fingerprints registered before an Android release; the downloaded file currently only contains the web OAuth client.
- Login was presented as a native modal while reCAPTCHA used another modal at the app root. Login now uses the normal stack, so phone verification can present reliably. Verification has error reporting, a timeout, and clean cancellation.
- Phone entry accepts Saudi local/international formats and Arabic/Persian digits. OTP requires six digits. Successful verification now navigates explicitly; account-loading errors no longer appear to be successful sign-ins.
- The API previously mapped every social account without a phone onto one empty phone value and overwrote its Firebase UID. It now maps by UID, preserves the account on phone linking, and rejects phone collisions. New accounts without phones use SQL NULL. Pre-created accounts can only be claimed if they have no Firebase UID.

## Deployment

Live Firebase project: `rihasham-restaurant`.
API deployment: `c485cd59-0e2c-40a7-b328-7b44eba89dd7` (Railway, production).
The API image applies `db/migrations/001_auth_identity.sql` before starting. The migration is repeatable and deliberately fails on duplicate UIDs rather than merging account history. Do not use the original full-schema migration against an existing database.

Mobile native changes require a new signed iOS build. They cannot update an already installed TestFlight/App Store binary through a JavaScript reload.

## Validation

- `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- `npm run build --workspace=@rihasham/api`
- `npx tsx --test apps/mobile/tests/auth.test.ts`
- From `packages/api`: `node -r dotenv/config scripts/test-auth-identity.js` (uses a connection-local temporary table, applies the migration, and tests social isolation, repeated sign-in, linking, collision rejection, and staff claims).
- From `apps/mobile`: `npx expo config --type introspect` and `npx expo export --platform ios --platform android`.

Still requires a physical iPhone check: real SMS receipt (including project billing/quota and carrier delivery), Apple identity exchange, Google identity exchange, cancellation/retry, and returning to checkout after linking a phone. Successful configuration checks and bundle compilation do not establish these device outcomes.

Provider documentation: [Expo Apple authentication SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/apple-authentication/), [native Google sign-in Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo), [Firebase phone authentication](https://firebase.google.com/docs/auth/web/phone-auth).

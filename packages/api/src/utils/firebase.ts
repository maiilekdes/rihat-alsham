import admin from 'firebase-admin';

// Auth strategy: the mobile app signs the user in client-side with Firebase Auth
// (phone OTP, Google, Facebook all supported natively by Firebase). The client
// sends the resulting Firebase ID token on every request; we verify it here and
// map it to our own `users` row. We never issue or trust our own session tokens
// for auth decisions — Firebase remains the single source of truth for identity.
const hasServiceAccount =
  process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  // Falls back to an unauthenticated app (no service account) when the env
  // vars aren't set, e.g. local development against public-only routes —
  // any route that actually calls firebaseAuth/firebaseMessaging will then
  // fail loudly rather than crashing the whole process at import time.
  admin.initializeApp(
    hasServiceAccount
      ? {
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        }
      : { projectId: 'rihasham-dev-unconfigured' }
  );
  if (!hasServiceAccount) {
    console.warn('FIREBASE_* env vars not set — auth-protected routes will fail until configured.');
  }
}

export const firebaseAuth = admin.auth();
export const firebaseMessaging = admin.messaging();

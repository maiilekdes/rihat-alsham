/**
 * Creates a staff/owner account that can log into the admin dashboard.
 *
 * Staff sign in with email + password (unlike customers, who use phone OTP),
 * so this does two things that have to stay in sync:
 *   1. creates the Firebase Auth user (the identity the dashboard logs in as)
 *   2. creates/updates the matching `users` row with role 'owner' or 'staff'
 *      (the authorization the API checks on every request)
 *
 * Usage:
 *   node -r dotenv/config scripts/create-staff.js <email> <password> <phone> [role]
 *
 * Example:
 *   node -r dotenv/config scripts/create-staff.js owner@rihasham.sa 'StrongPass123' +966500000000 owner
 */
const admin = require('firebase-admin');
const { Client } = require('pg');

async function main() {
  const [email, password, phone, role = 'owner'] = process.argv.slice(2);

  if (!email || !password || !phone) {
    console.error('Usage: node -r dotenv/config scripts/create-staff.js <email> <password> <phone> [role]');
    process.exit(1);
  }
  if (!['owner', 'staff'].includes(role)) {
    console.error(`Invalid role "${role}" — must be "owner" or "staff".`);
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Firebase requires passwords of at least 6 characters.');
    process.exit(1);
  }
  if (!/^\+\d{10,15}$/.test(phone)) {
    console.error('Phone must be in E.164 format, e.g. +966500000000');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  // 1. Firebase Auth user — reuse the existing one if this email is already registered.
  let firebaseUser;
  try {
    firebaseUser = await admin.auth().createUser({ email, password, phoneNumber: phone });
    console.log(`Created Firebase user ${firebaseUser.uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      firebaseUser = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(firebaseUser.uid, { password });
      console.log(`Firebase user already existed (${firebaseUser.uid}) — password reset.`);
    } else {
      throw err;
    }
  }

  // 2. Matching row in our own database, carrying the role the API authorizes against.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO users (phone, phone_verified, full_name, email, auth_provider, provider_uid, role)
       VALUES ($1, TRUE, $2, $3, 'phone', $4, $5)
       ON CONFLICT (phone) DO UPDATE
         SET role = EXCLUDED.role,
             email = EXCLUDED.email,
             provider_uid = EXCLUDED.provider_uid,
             phone_verified = TRUE
       RETURNING id, role`,
      [phone, role === 'owner' ? 'Restaurant Owner' : 'Staff', email, firebaseUser.uid, role]
    );
    console.log(`Database user ${rows[0].id} set to role "${rows[0].role}".`);
    console.log(`\nDone. Log into the dashboard at http://localhost:3000/login with:\n  ${email}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

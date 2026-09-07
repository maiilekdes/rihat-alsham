// Uses a connection-local temporary table; never changes application users.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { pool } = require('../dist/db/pool');
const { firebaseAuth } = require('../dist/utils/firebase');
const { requireAuth } = require('../dist/middleware/auth');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const originalConnect = pool.connect;
  const originalVerify = firebaseAuth.verifyIdToken;
  try {
    await client.query(`CREATE TEMP TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone VARCHAR(20) UNIQUE NOT NULL,
      phone_verified BOOLEAN DEFAULT false, auth_provider TEXT, provider_uid TEXT,
      email TEXT, role TEXT DEFAULT 'customer', updated_at TIMESTAMPTZ DEFAULT now()
    )`);
    await client.query("INSERT INTO users (phone, provider_uid) VALUES ('', 'legacy-social')");
    const migration = require('fs').readFileSync(require('path').join(__dirname, '../../../db/migrations/001_auth_identity.sql'), 'utf8');
    await client.query(migration);
    await client.query(migration);
    assert.equal((await client.query("SELECT phone FROM users WHERE provider_uid = 'legacy-social'")).rows[0].phone, null);
    pool.connect = async () => ({ query: client.query.bind(client), release() {} });
    firebaseAuth.verifyIdToken = async (token) => JSON.parse(token);
    async function signIn(uid, phone, provider = 'google.com') {
      const req = { headers: { authorization: 'Bearer ' + JSON.stringify({ uid, phone_number: phone, firebase: { sign_in_provider: provider } }) } };
      let status = 200;
      let nextCalled = false;
      const res = { status(code) { status = code; return this; }, json() {} };
      await requireAuth(req, res, () => { nextCalled = true; });
      return { user: req.user, status, nextCalled };
    }
    const first = await signIn('test-google');
    const second = await signIn('test-apple', undefined, 'apple.com');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.notEqual(first.user.id, second.user.id);
    assert.equal((await signIn('test-google')).user.id, first.user.id);
    const linked = await signIn('test-google', '+966512345678');
    assert.equal(linked.user.id, first.user.id);
    assert.equal(linked.user.phoneVerified, true);
    const conflict = await signIn('test-impostor', '+966512345678');
    assert.equal(conflict.nextCalled, false);
    assert.equal((await signIn('test-google', '+966512345678')).user.id, first.user.id);
    await client.query("INSERT INTO users (phone, role) VALUES ('+966512345679', 'staff')");
    const staff = await signIn('test-staff', '+966512345679', 'phone');
    assert.equal(staff.user.role, 'staff');
    assert.equal(staff.user.phoneVerified, true);
    console.log('PASS: social isolation, repeat sign-in, phone linking, collision protection, pre-created staff claim');
  } finally {
    pool.connect = originalConnect;
    firebaseAuth.verifyIdToken = originalVerify;
    await client.end();
    await pool.end();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });

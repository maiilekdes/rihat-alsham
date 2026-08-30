// Verifies the capped-percentage promotion against the exact scenarios
// described: 50% off, capped at 15 SAR, first 3 orders only.
const admin = require('firebase-admin');
const API = 'http://localhost:4000';
const WEB_KEY = 'AIzaSyCH4rG23alx4UpDoOxOiNdMu5_Iwbdw3Mc';
const { Client } = require('pg');

admin.initializeApp({ credential: admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n'),
})});

const UID = 'discount-test-user';
const PHONE = '+966599887766';

async function token() {
  try { await admin.auth().getUser(UID); }
  catch {
    try { const e = await admin.auth().getUserByPhoneNumber(PHONE); await admin.auth().deleteUser(e.uid); } catch {}
    await admin.auth().createUser({ uid: UID, phoneNumber: PHONE });
  }
  const ct = await admin.auth().createCustomToken(UID);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token: ct, returnSecureToken:true}) });
  return (await r.json()).idToken;
}
const call = (p,t,o={}) => fetch(API+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`,...(o.headers||{})}});

(async () => {
  const t = await token();
  await call('/api/users/me', t);   // ensure user row exists

  // Clean slate for this test user
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE phone=$1)`, [PHONE]);

  const menu = await (await fetch(API+'/api/menu')).json();
  const item = menu[0].items[0];                       // Shawarma sandwich, 14 SAR
  const variantSandwich = item.variants.find(v=>v.nameEn==='Sandwich');  // 14
  const variantPlate    = item.variants.find(v=>v.nameEn==='Plate');     // 26

  const addr = await (await call('/api/addresses', t, { method:'POST',
    body: JSON.stringify({ line1:'Test', city:'Medina', isDefault:true }) })).json();

  // Build an order whose subtotal is close to a target, using qty of sandwiches (14 each)
  async function order(qty, variant) {
    const r = await call('/api/orders', t, { method:'POST', body: JSON.stringify({
      fulfillmentType:'pickup',
      branchId: (await (await fetch(API+'/api/branches')).json())[0].id,
      items:[{ itemId:item.id, variantId:variant.id, quantity:qty, extraIds:[] }],
    })});
    return r.json();
  }
  async function pay(orderId) {
    return (await call('/api/payments/charge', t, { method:'POST',
      body: JSON.stringify({ orderId, token:'tok_simulated_success' }) })).json();
  }

  console.log('50% off first 3 orders, capped at 15 SAR (pickup, no delivery fee)\n');
  console.log('order#  subtotal  discount  total   expected-discount  result');

  const scenarios = [
    { qty:1, variant:variantSandwich, sub:14,  expect:7  },   // 50% of 14 = 7 (under cap)
    { qty:1, variant:variantPlate,    sub:26,  expect:13 },   // 50% of 26 = 13 (under cap)
    { qty:4, variant:variantSandwich, sub:56,  expect:15 },   // 50% = 28 → capped to 15
    { qty:8, variant:variantSandwich, sub:112, expect:0  },   // 4th order → no promo left
  ];

  let n = 1;
  for (const s of scenarios) {
    const o = await order(s.qty, s.variant);
    const ok = Number(o.discountAmount) === s.expect && Number(o.subtotal) === s.sub;
    console.log(
      `  ${n}     ${String(o.subtotal).padEnd(8)} ${String(o.discountAmount).padEnd(9)} ${String(o.total).padEnd(7)} ${String(s.expect).padEnd(18)} ${ok?'✅':'❌ got '+o.discountAmount+' on subtotal '+o.subtotal}`
    );
    await pay(o.orderId);
    n++;
  }

  console.log('\nBanner endpoint:');
  const banner = await (await fetch(API+'/api/promotions/banner')).json();
  console.log(' ', banner.name_en, '|', banner.terms_en);
  console.log(' ', banner.name_ar, '|', banner.terms_ar);

  await db.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE phone=$1)`, [PHONE]);
  await db.end();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });

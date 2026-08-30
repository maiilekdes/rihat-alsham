// Places a realistic customer order so it can be watched arriving in the
// dashboard's live queue. Uses the simulated payment path.
const admin = require('firebase-admin');
const API = 'http://localhost:4000';
const WEB_KEY = 'AIzaSyCH4rG23alx4UpDoOxOiNdMu5_Iwbdw3Mc';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

async function idTokenFor(uid, phone, name) {
  try { await admin.auth().getUser(uid); }
  catch {
    try { const e = await admin.auth().getUserByPhoneNumber(phone); uid = e.uid; }
    catch { await admin.auth().createUser({ uid, phoneNumber: phone, displayName: name }); }
  }
  const ct = await admin.auth().createCustomToken(uid);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  return (await r.json()).idToken;
}

const call = (p, t, o={}) => fetch(API+p, { ...o, headers: {'Content-Type':'application/json', Authorization:`Bearer ${t}`, ...(o.headers||{})} });

(async () => {
  const token = await idTokenFor('demo-customer-ahmad', '+966512345678', 'Ahmad');
  await call('/api/users/me', token, { method:'PATCH', body: JSON.stringify({ fullName: 'Ahmad Al-Harbi' }) });

  const menu = await (await fetch(API + '/api/menu')).json();
  const pick = (cat, idx=0) => menu.find(c => c.nameEn === cat).items[idx];

  const shawarma = pick('Shawarma');
  const maajanat = pick('Maajanat', 1);   // Zaatar
  const drink    = pick('Beverages');

  const addr = await (await call('/api/addresses', token, {
    method:'POST',
    body: JSON.stringify({ label:'Home', line1:'Quba Road, Building 12, Apt 3', city:'Medina', isDefault:true }),
  })).json();

  const order = await (await call('/api/orders', token, {
    method:'POST',
    body: JSON.stringify({
      fulfillmentType:'delivery',
      addressId: addr.id,
      notes: 'Please ring the bell twice',
      items: [
        { itemId: shawarma.id, variantId: shawarma.variants.find(v=>v.isDefault).id, quantity: 2,
          extraIds: [shawarma.extras[0].id], spiceLevel: 2 },
        { itemId: maajanat.id, quantity: 3, extraIds: [] },
        { itemId: drink.id, quantity: 2, extraIds: [] },
      ],
    }),
  })).json();

  console.log(`Order #${order.orderNumber} created — ${order.total} SAR. Paying…`);
  const pay = await (await call('/api/payments/charge', token, {
    method:'POST', body: JSON.stringify({ orderId: order.orderId, token:'tok_simulated_success' }),
  })).json();

  console.log(`Payment: ${pay.status} → order #${order.orderNumber} is now LIVE in the dashboard.`);

  await call(`/api/orders/${order.orderId}/messages`, token, {
    method:'POST',
    body: JSON.stringify({ type:'text', body:'المبنى الأبيض بجانب المسجد، الشقة ٣' }),
  });
  console.log('Customer sent a delivery note (Arabic) — check "Delivery Notes" on the order card.');
})().catch(e => { console.error(e); process.exit(1); });

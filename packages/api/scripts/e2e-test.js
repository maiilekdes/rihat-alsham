// End-to-end test: customer signs in, browses menu, places an order, pays,
// and the order becomes visible to staff. Uses the Firebase test phone number.
const admin = require('firebase-admin');
const API = 'http://localhost:4000';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const WEB_KEY = 'AIzaSyCH4rG23alx4UpDoOxOiNdMu5_Iwbdw3Mc';

// Mint a real Firebase ID token for a test customer by creating a custom token
// and exchanging it, the same exchange the mobile app performs after OTP.
async function idTokenFor(uid, phone) {
  let resolvedUid = uid;
  try {
    await admin.auth().getUser(uid);
  } catch {
    // The phone may already belong to a different uid (e.g. the owner account
    // created by create-staff.js) — reuse that user rather than colliding.
    try {
      const existing = await admin.auth().getUserByPhoneNumber(phone);
      resolvedUid = existing.uid;
    } catch {
      await admin.auth().createUser({ uid, phoneNumber: phone });
    }
  }
  const customToken = await admin.auth().createCustomToken(resolvedUid);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const d = await r.json();
  if (!d.idToken) throw new Error('token exchange failed: ' + JSON.stringify(d));
  return d.idToken;
}

const call = (path, token, opts = {}) =>
  fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers||{}) },
  });

(async () => {
  const step = (n, m) => console.log(`\n[${n}] ${m}`);

  step(1, 'Customer signs in (phone +966511111111)');
  const custToken = await idTokenFor('e2e-test-customer', '+966511111111');
  const me = await (await call('/api/users/me', custToken)).json();
  console.log('    signed in as', me.phone, '| role:', me.role, '| verified:', me.phone_verified);

  step(2, 'Browse menu');
  const menu = await (await fetch(API + '/api/menu')).json();
  const shawarma = menu[0].items[0];
  const variant = shawarma.variants.find(v => v.isDefault);
  const extra = shawarma.extras[0];
  console.log(`    picked "${shawarma.nameEn}" (${variant.nameEn} ${variant.price} SAR) + ${extra.nameEn} ${extra.price} SAR`);

  step(3, 'Add a delivery address');
  const addr = await (await call('/api/addresses', custToken, {
    method: 'POST',
    body: JSON.stringify({ line1: 'Quba Road, Building 12', city: 'Medina', isDefault: true }),
  })).json();
  console.log('    address id', addr.id);

  step(4, 'Place order (server computes price)');
  const orderRes = await call('/api/orders', custToken, {
    method: 'POST',
    body: JSON.stringify({
      fulfillmentType: 'delivery',
      addressId: addr.id,
      items: [{ itemId: shawarma.id, variantId: variant.id, quantity: 2, extraIds: [extra.id] }],
    }),
  });
  const order = await orderRes.json();
  const subtotal = (variant.price + extra.price) * 2;
  // The welcome promotion (50% off first 3 orders, capped at 15 SAR) applies
  // to the food subtotal only — the delivery fee is never discounted.
  const expectedDiscount = Math.min(subtotal * 0.5, 15);
  const expected = subtotal - expectedDiscount + 8;
  console.log(
    `    order #${order.orderNumber}: subtotal ${order.subtotal} − discount ${order.discountAmount} + delivery 8 = ${order.total} SAR ` +
    `(expected ${expected}) — ${Number(order.total) === expected ? 'MATCH ✅' : 'MISMATCH ❌'}`
  );
  if (order.promotion) console.log(`    promotion applied: "${order.promotion.nameEn}"`);

  step(5, 'Verify unpaid order is NOT in the kitchen queue');
  const staffToken = await idTokenFor('e2e-owner-check', '+966500000000');
  let queue = await (await call('/api/orders', staffToken)).json();
  const leaked = Array.isArray(queue) && queue.some(o => o.id === order.orderId);
  console.log(`    unpaid order visible to staff? ${leaked ? 'YES ❌ LEAK' : 'NO ✅ correctly hidden'}`);

  step(6, 'Pay (simulated)');
  const payRes = await call('/api/payments/charge', custToken, {
    method: 'POST',
    body: JSON.stringify({ orderId: order.orderId, token: 'tok_simulated_success' }),
  });
  const pay = await payRes.json();
  console.log('    payment status:', pay.status, payRes.status === 200 ? '✅' : '❌');

  step(7, 'Order now appears in kitchen queue');
  queue = await (await call('/api/orders', staffToken)).json();
  const found = Array.isArray(queue) && queue.find(o => o.id === order.orderId);
  console.log(`    in queue: ${found ? 'YES ✅ status=' + found.status : 'NO ❌'}`);

  step(8, 'Staff advances status to preparing');
  const upd = await call(`/api/orders/${order.orderId}/status`, staffToken, {
    method: 'PATCH', body: JSON.stringify({ status: 'preparing' }),
  });
  console.log('    update:', upd.status === 200 ? 'OK ✅' : 'FAILED ❌ ' + await upd.text());

  step(9, 'Delivery chat both directions');
  await call(`/api/orders/${order.orderId}/messages`, custToken, {
    method: 'POST', body: JSON.stringify({ type: 'text', body: 'The white building next to the mosque' }),
  });
  await call(`/api/orders/${order.orderId}/messages`, staffToken, {
    method: 'POST', body: JSON.stringify({ type: 'text', body: 'Got it — driver leaving in 10 minutes' }),
  });
  const msgs = await (await call(`/api/orders/${order.orderId}/messages`, custToken)).json();
  console.log(`    ${msgs.length} messages:`);
  msgs.forEach(m => console.log(`      ${m.sender_role}: ${m.body}`));

  step(10, 'Declined payment must NOT reach kitchen');
  const o2 = await (await call('/api/orders', custToken, {
    method: 'POST',
    body: JSON.stringify({ fulfillmentType: 'delivery', addressId: addr.id,
      items: [{ itemId: shawarma.id, variantId: variant.id, quantity: 1, extraIds: [] }] }),
  })).json();
  const declineRes = await call('/api/payments/charge', custToken, {
    method: 'POST', body: JSON.stringify({ orderId: o2.orderId, token: 'tok_simulated_failure' }),
  });
  const q2 = await (await call('/api/orders', staffToken)).json();
  const declinedLeaked = q2.some(o => o.id === o2.orderId);
  console.log(`    declined (HTTP ${declineRes.status}), in kitchen queue? ${declinedLeaked ? 'YES ❌ LEAK' : 'NO ✅ correctly blocked'}`);

  console.log('\n=== done ===');
})().catch(e => { console.error('\n❌ TEST FAILED:', e.message); process.exit(1); });

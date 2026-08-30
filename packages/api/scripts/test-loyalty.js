// Verifies the full loyalty lifecycle: points earned on paid orders (1 SAR =
// 1 point, on the amount actually paid after discount), and points correctly
// deducted when a reward is redeemed — including that the reward item rides
// along in the order at 0 SAR.
const admin = require('firebase-admin');
const { Client } = require('pg');
const API = 'http://localhost:4000';
const WEB_KEY = 'AIzaSyCH4rG23alx4UpDoOxOiNdMu5_Iwbdw3Mc';

admin.initializeApp({ credential: admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n'),
})});

const UID = 'loyalty-test-user';
const PHONE = '+966588776655';

async function token() {
  try { const e = await admin.auth().getUserByPhoneNumber(PHONE); await admin.auth().deleteUser(e.uid); } catch {}
  await admin.auth().createUser({ uid: UID, phoneNumber: PHONE });
  const ct = await admin.auth().createCustomToken(UID);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token: ct, returnSecureToken:true}) });
  return (await r.json()).idToken;
}
const call = (p,t,o={}) => fetch(API+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`,...(o.headers||{})}});

(async () => {
  const t = await token();
  await call('/api/users/me', t);

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE phone=$1)`, [PHONE]);
  await db.query(`UPDATE users SET loyalty_points = 0 WHERE phone = $1`, [PHONE]);

  const branches = await (await fetch(API+'/api/branches')).json();
  const menu = await (await fetch(API+'/api/menu')).json();
  const kebab = menu.find(c=>c.nameEn==='Grills').items.find(i=>i.nameEn==='Fresh Meat Kebab');
  const kebabPortion = kebab.variants.find(v=>v.nameEn==='Portion'); // 30 SAR

  async function orderAndPay(qty) {
    const o = await (await call('/api/orders', t, { method:'POST', body: JSON.stringify({
      fulfillmentType:'pickup', branchId: branches[0].id,
      items:[{ itemId: kebab.id, variantId: kebabPortion.id, quantity: qty, extraIds:[] }],
    })})).json();
    await call('/api/payments/charge', t, { method:'POST', body: JSON.stringify({ orderId:o.orderId, token:'tok_simulated_success' })});
    return o;
  }

  console.log('--- Earning ---');
  // Order 1: 30 SAR, welcome promo 50% capped 15 -> pays 15 -> earns 15 pts
  let o = await orderAndPay(1);
  let bal = await (await call('/api/loyalty', t)).json();
  console.log(`Order #${o.orderNumber}: subtotal ${o.subtotal}, discount ${o.discountAmount}, paid ${o.total} -> balance ${bal.balance} (expect 15)`, bal.balance===15?'✅':'❌');

  // Order 2: 60 SAR (2x), welcome promo 50%=30 capped 15 -> pays 45 -> +45 pts = 60
  o = await orderAndPay(2);
  bal = await (await call('/api/loyalty', t)).json();
  console.log(`Order #${o.orderNumber}: paid ${o.total} -> balance ${bal.balance} (expect 60)`, bal.balance===60?'✅':'❌');

  // Order 3: still within first-3-orders promo, 30 SAR, discount 15 -> pays 15 -> +15 = 75
  o = await orderAndPay(1);
  bal = await (await call('/api/loyalty', t)).json();
  console.log(`Order #${o.orderNumber}: paid ${o.total} -> balance ${bal.balance} (expect 75)`, bal.balance===75?'✅':'❌');

  // Order 4: promo exhausted, full 30 SAR paid -> +30 = 105
  o = await orderAndPay(1);
  bal = await (await call('/api/loyalty', t)).json();
  console.log(`Order #${o.orderNumber}: paid ${o.total} -> balance ${bal.balance} (expect 105)`, bal.balance===105?'✅':'❌');

  console.log('\n--- Rewards catalog ---');
  const rewards = await (await call('/api/loyalty/rewards', t)).json();
  rewards.rewards.forEach(r => console.log(`  ${r.name_en}: ${r.points_cost} pts, canRedeem=${r.canRedeem}`));

  console.log('\n--- Redeeming the 100-pt reward ---');
  const target = rewards.rewards.find(r => r.points_cost === 100);
  const redeemOrder = await (await call('/api/orders', t, { method:'POST', body: JSON.stringify({
    fulfillmentType:'pickup', branchId: branches[0].id, redeemRewardId: target.id,
    items:[{ itemId: kebab.id, variantId: kebabPortion.id, quantity: 1, extraIds:[] }],
  })})).json();
  console.log('Order created with reward:', redeemOrder.reward?.nameEn, '| total (should NOT include reward item):', redeemOrder.total);
  await call('/api/payments/charge', t, { method:'POST', body: JSON.stringify({ orderId: redeemOrder.orderId, token:'tok_simulated_success' })});
  bal = await (await call('/api/loyalty', t)).json();
  // Was 105, redeem costs 100 -> 5 left, then this order's own payment (30 SAR, promo exhausted) earns +30 -> 35
  console.log(`After redeem+pay: balance ${bal.balance} (expect 35: 105 - 100 + 30)`, bal.balance===35?'✅':'❌');

  const items = await db.query(`SELECT name_en, unit_price, quantity FROM order_items WHERE order_id=$1`, [redeemOrder.orderId]);
  console.log('Order line items:');
  items.rows.forEach(i => console.log(`  ${i.name_en}: ${i.unit_price} SAR x${i.quantity}`));
  const rewardLine = items.rows.find(i => i.name_en.includes('Reward'));
  console.log('Reward line free (0 SAR)?', rewardLine && Number(rewardLine.unit_price)===0 ? '✅' : '❌');

  console.log('\n--- Ledger ---');
  const hist = await (await call('/api/loyalty', t)).json();
  hist.history.slice(0,3).forEach(h => console.log(`  ${h.type}: ${h.points > 0 ? '+' : ''}${h.points} — ${h.note}`));

  await db.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE phone=$1)`, [PHONE]);
  await db.end();
})().catch(e => { console.error('FAILED', e); process.exit(1); });

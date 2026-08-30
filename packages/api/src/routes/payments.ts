import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { createMoyasarPayment, fetchMoyasarPayment, mapCardBrandToMethod, MoyasarPayment } from '../utils/moyasar';
import { io } from '../server';
import { notifyOrderStatus } from '../utils/push';
import { settleLoyaltyForOrder } from '../utils/loyalty';

export const paymentsRouter = Router();

/**
 * Development-only payment simulator.
 *
 * Lets the full ordering flow be exercised end to end before real Moyasar
 * credentials are in place. Deliberately gated behind TWO independent
 * conditions so it can never be switched on in production by a single
 * misconfigured env var:
 *
 *   1. NODE_ENV must not be 'production'
 *   2. SIMULATE_PAYMENTS must be explicitly 'true'
 *
 * When active, a token of 'tok_simulated_success' marks the order paid and
 * 'tok_simulated_failure' exercises the decline path. Every other rule —
 * order ownership, status checks, server-computed totals — still applies
 * exactly as in the real flow, so what's tested is the real code path.
 */
const paymentsSimulated =
  process.env.NODE_ENV !== 'production' && process.env.SIMULATE_PAYMENTS === 'true';

if (paymentsSimulated) {
  console.warn(
    '⚠️  SIMULATE_PAYMENTS is on — payments are FAKE. Never enable this in production.'
  );
}

const chargeSchema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(1), // Moyasar hosted-fields token — raw card data never reaches us
});

/**
 * Charges a `pending_payment` order via Moyasar and, ONLY on a successful
 * authorization, flips it to `received` so it becomes visible in the admin
 * queue. This is the single choke point that guarantees an unpaid order can
 * never reach the kitchen — it re-validates order ownership and status
 * server-side rather than trusting anything the client asserts.
 */
paymentsRouter.post('/charge', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = chargeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { orderId, token } = parsed.data;

  const orderRes = await pool.query(
    `SELECT id, user_id, total, status FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, req.user!.id]
  );
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending_payment') {
    return res.status(409).json({ error: 'Order is not awaiting payment' });
  }

  try {
    // In simulation mode, stand in for Moyasar's response. Everything after
    // this point — the payment record, the order transition, the socket
    // emit, the push — runs through the identical real code path.
    const moyasarPayment = paymentsSimulated
      ? simulatePayment(token, Number(order.total), orderId)
      : await createMoyasarPayment({
          amountHalalas: Math.round(Number(order.total) * 100),
          currency: 'SAR',
          description: `Rihat Alsham order`,
          token,
          callbackUrl: `${process.env.PUBLIC_API_URL}/api/payments/callback`,
          metadata: { orderId },
        });

    const method = mapCardBrandToMethod(moyasarPayment.source.company);
    const succeeded = moyasarPayment.status === 'paid' || moyasarPayment.status === 'authorized';

    await pool.query(
      `INSERT INTO payments (order_id, gateway_payment_id, method, status, amount, card_last4, card_brand, raw_response)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        orderId,
        moyasarPayment.id,
        method,
        succeeded ? 'captured' : 'failed',
        order.total,
        moyasarPayment.source.number?.slice(-4) ?? null,
        moyasarPayment.source.company ?? null,
        moyasarPayment,
      ]
    );

    if (!succeeded) {
      return res.status(402).json({
        error: 'Payment declined',
        reason: moyasarPayment.source.message ?? 'Card declined',
      });
    }

    // 3D Secure sometimes requires a redirect before the bank confirms — if so,
    // send the client the URL and let /api/payments/callback finish the job.
    if (moyasarPayment.source.transaction_url) {
      return res.json({ status: 'requires_action', transactionUrl: moyasarPayment.source.transaction_url });
    }

    const client = await pool.connect();
    let updatedOrder;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE orders SET status = 'received' WHERE id = $1 RETURNING id, user_id, order_number, status, total`,
        [orderId]
      );
      updatedOrder = rows[0];
      await client.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'received')`, [orderId]);
      // Points are only ever earned/spent once payment has actually succeeded —
      // never at order creation, so an abandoned checkout can't move points.
      await settleLoyaltyForOrder(client, orderId);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    io.to('admin').emit('order:new', updatedOrder);
    await notifyOrderStatus(updatedOrder.user_id, updatedOrder.order_number, 'received');

    res.json({ status: 'paid', orderId, orderNumber: updatedOrder.order_number });
  } catch (err) {
    console.error('Payment charge failed', err);
    res.status(502).json({ error: 'Payment gateway error, please try again' });
  }
});

/**
 * Moyasar redirects here after 3D Secure. We re-fetch the payment status
 * directly from Moyasar's API (never trust query params from the redirect
 * itself) before releasing the order to the kitchen.
 */
paymentsRouter.get('/callback', async (req, res) => {
  const paymentId = req.query.id as string | undefined;
  if (!paymentId) return res.status(400).send('Missing payment id');

  const payment = await fetchMoyasarPayment(paymentId);
  const orderId = payment.metadata?.orderId;
  const succeeded = payment.status === 'paid' || payment.status === 'authorized';

  await pool.query(`UPDATE payments SET status = $2, raw_response = $3 WHERE gateway_payment_id = $1`, [
    paymentId,
    succeeded ? 'captured' : 'failed',
    payment,
  ]);

  if (succeeded && orderId) {
    const client = await pool.connect();
    let updatedOrder;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE orders SET status = 'received' WHERE id = $1 AND status = 'pending_payment' RETURNING id, user_id, order_number, status`,
        [orderId]
      );
      updatedOrder = rows[0];
      if (updatedOrder) {
        await client.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'received')`, [orderId]);
        await settleLoyaltyForOrder(client, orderId);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    if (updatedOrder) {
      io.to('admin').emit('order:new', updatedOrder);
      await notifyOrderStatus(updatedOrder.user_id, updatedOrder.order_number, 'received');
    }
  }

  // Deep link back into the mobile app; it polls /api/orders/:id to reflect the final state.
  const deepLink = succeeded
    ? `rihasham://checkout/success?orderId=${orderId}`
    : `rihasham://checkout/failed?orderId=${orderId}`;
  res.redirect(deepLink);
});

/**
 * Builds a Moyasar-shaped response for local testing. Only ever called when
 * `paymentsSimulated` is true (dev + explicit opt-in) — see the gate above.
 */
function simulatePayment(token: string, totalSar: number, orderId: string): MoyasarPayment {
  const declined = token === 'tok_simulated_failure';
  return {
    id: `sim_${Date.now()}`,
    status: declined ? ('failed' as const) : ('paid' as const),
    amount: Math.round(totalSar * 100),
    fee: 0,
    currency: 'SAR',
    source: {
      type: 'creditcard',
      company: 'mada',
      name: 'SIMULATED CARD',
      number: 'XXXX-XXXX-XXXX-0000',
      message: declined ? 'Simulated decline' : undefined,
    },
    metadata: { orderId },
  };
}

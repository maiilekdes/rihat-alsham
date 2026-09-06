import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, requireVerifiedPhone, requireRole, AuthedRequest } from '../middleware/auth';
import { io } from '../server';
import { notifyOrderStatus } from '../utils/push';
import { resolvePromotion } from '../utils/promotions';

export const ordersRouter = Router();

const DELIVERY_FEE = 8; // SAR flat fee; move to a config table if zones/tiers are needed later.

const cartItemSchema = z.object({
  itemId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(20),
  spiceLevel: z.number().int().min(0).max(5).optional(),
  notes: z.string().max(300).optional(),
  extraIds: z.array(z.string().uuid()).default([]),
});

const createOrderSchema = z.object({
  fulfillmentType: z.enum(['delivery', 'pickup']),
  addressId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  // Optional promo code. Automatic promotions (like the welcome offer) need no
  // code — and the discount itself is always computed server-side regardless.
  promoCode: z.string().max(40).optional(),
  redeemRewardId: z.string().uuid().optional(),
  items: z.array(cartItemSchema).min(1),
});

/**
 * Creates an order in `pending_payment` status with **server-computed** pricing —
 * the client never gets to dictate a price. This order is invisible to the admin
 * queue until a successful payment flips it to `received` (see routes/payments.ts).
 */
ordersRouter.post('/', requireAuth, requireVerifiedPhone, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  if (d.fulfillmentType === 'delivery' && !d.addressId) {
    return res.status(400).json({ error: 'addressId required for delivery' });
  }
  if (d.fulfillmentType === 'pickup' && !d.branchId) {
    return res.status(400).json({ error: 'branchId required for pickup' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const resolvedItems: any[] = [];

    for (const line of d.items) {
      const itemRes = await client.query(
        `SELECT id, name_ar, name_en, base_price, is_available FROM menu_items WHERE id = $1`,
        [line.itemId]
      );
      const item = itemRes.rows[0];
      if (!item) throw new HttpError(400, `Unknown item ${line.itemId}`);
      if (!item.is_available) throw new HttpError(409, `${item.name_en} is currently out of stock`);

      let unitPrice = Number(item.base_price);
      let nameAr = item.name_ar;
      let nameEn = item.name_en;

      if (line.variantId) {
        const vRes = await client.query(
          `SELECT name_ar, name_en, price FROM item_variants WHERE id = $1 AND item_id = $2`,
          [line.variantId, line.itemId]
        );
        const variant = vRes.rows[0];
        if (!variant) throw new HttpError(400, `Unknown variant ${line.variantId}`);
        unitPrice = Number(variant.price);
        nameAr = `${item.name_ar} - ${variant.name_ar}`;
        nameEn = `${item.name_en} - ${variant.name_en}`;
      }

      const extras: any[] = [];
      let extrasTotal = 0;
      for (const extraId of line.extraIds) {
        const eRes = await client.query(
          `SELECT name_ar, name_en, price, is_available FROM item_extras WHERE id = $1 AND item_id = $2`,
          [extraId, line.itemId]
        );
        const extra = eRes.rows[0];
        if (!extra || !extra.is_available) throw new HttpError(400, `Unavailable extra ${extraId}`);
        extras.push(extra);
        extrasTotal += Number(extra.price);
      }

      const lineTotal = (unitPrice + extrasTotal) * line.quantity;
      subtotal += lineTotal;
      resolvedItems.push({ ...line, nameAr, nameEn, unitPrice, extras, lineTotal });
    }

    const deliveryFee = d.fulfillmentType === 'delivery' ? DELIVERY_FEE : 0;

    // Discount applies to the food subtotal only, never to the delivery fee.
    const promotion = await resolvePromotion(client, req.user!.id, subtotal, d.promoCode);
    const discountAmount = promotion?.discountAmount ?? 0;
    const total = subtotal - discountAmount + deliveryFee;

    // Points reward: validated against the CURRENT balance server-side — the
    // client only sends which reward it wants, never a price or a point cost.
    // The redemption is only actually consumed (points deducted) once payment
    // succeeds, mirroring how promotions only count paid orders — see
    // routes/payments.ts.
    let reward: { id: string; nameAr: string; nameEn: string; pointsCost: number; itemId: string; variantId: string | null } | null = null;
    if (d.redeemRewardId) {
      // Lock this customer's row for the rest of the transaction, so two
      // checkouts running at once can't both clear the balance check below.
      const balRes = await client.query(`SELECT loyalty_points FROM users WHERE id = $1 FOR UPDATE`, [
        req.user!.id,
      ]);

      const rRes = await client.query(
        `SELECT id, name_ar, name_en, points_cost, menu_item_id, variant_id
         FROM loyalty_rewards WHERE id = $1 AND is_active = TRUE`,
        [d.redeemRewardId]
      );
      const row = rRes.rows[0];
      if (!row) throw new HttpError(400, 'Unknown or inactive reward');

      // Because points are only deducted once payment succeeds, checking the
      // raw balance here let a single balance fund several orders: redeem the
      // same 100-point reward on five unpaid orders, pay all five, and only the
      // first deduction found points to take. Count what pending orders have
      // already claimed so each point can only be promised once.
      const pendingRes = await client.query(
        `SELECT COALESCE(SUM(r.points_cost), 0) AS earmarked
         FROM orders o
         JOIN loyalty_rewards r ON r.id = o.redeemed_reward_id
         WHERE o.user_id = $1 AND o.status = 'pending_payment'`,
        [req.user!.id]
      );
      const available = Number(balRes.rows[0].loyalty_points) - Number(pendingRes.rows[0].earmarked);
      if (available < row.points_cost) {
        throw new HttpError(409, `Not enough points — need ${row.points_cost}, have ${available}`);
      }
      reward = {
        id: row.id,
        nameAr: row.name_ar,
        nameEn: row.name_en,
        pointsCost: row.points_cost,
        itemId: row.menu_item_id,
        variantId: row.variant_id,
      };
    }

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, status, fulfillment_type, address_id, branch_id, subtotal, delivery_fee, promotion_id, discount_amount, redeemed_reward_id, total, notes)
       VALUES ($1, 'pending_payment', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, order_number, created_at`,
      [
        req.user!.id,
        d.fulfillmentType,
        d.addressId ?? null,
        d.branchId ?? null,
        subtotal,
        deliveryFee,
        promotion?.promotionId ?? null,
        discountAmount,
        reward?.id ?? null,
        total,
        d.notes ?? null,
      ]
    );
    const order = orderRes.rows[0];

    if (reward) {
      const itemRes = await client.query(`SELECT name_ar, name_en FROM menu_items WHERE id = $1`, [reward.itemId]);
      const item = itemRes.rows[0];
      let nameAr = item.name_ar;
      let nameEn = item.name_en;
      if (reward.variantId) {
        const vRes = await client.query(`SELECT name_ar, name_en FROM item_variants WHERE id = $1`, [reward.variantId]);
        nameAr = `${nameAr} - ${vRes.rows[0].name_ar}`;
        nameEn = `${nameEn} - ${vRes.rows[0].name_en}`;
      }
      await client.query(
        `INSERT INTO order_items (order_id, item_id, variant_id, name_ar, name_en, unit_price, quantity, line_total, notes)
         VALUES ($1,$2,$3,$4,$5,0,1,0,$6)`,
        [order.id, reward.itemId, reward.variantId, `${nameAr} (مكافأة)`, `${nameEn} (Reward)`, 'Redeemed with loyalty points']
      );
    }

    for (const line of resolvedItems) {
      const oiRes = await client.query(
        `INSERT INTO order_items (order_id, item_id, variant_id, name_ar, name_en, unit_price, quantity, spice_level, notes, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [order.id, line.itemId, line.variantId ?? null, line.nameAr, line.nameEn, line.unitPrice, line.quantity, line.spiceLevel ?? null, line.notes ?? null, line.lineTotal]
      );
      for (const extra of line.extras) {
        await client.query(
          `INSERT INTO order_item_extras (order_item_id, name_ar, name_en, price) VALUES ($1,$2,$3,$4)`,
          [oiRes.rows[0].id, extra.name_ar, extra.name_en, extra.price]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      orderId: order.id,
      orderNumber: order.order_number,
      subtotal,
      deliveryFee,
      discountAmount,
      promotion: promotion ? { nameAr: promotion.nameAr, nameEn: promotion.nameEn } : null,
      reward: reward ? { nameAr: reward.nameAr, nameEn: reward.nameEn, pointsCost: reward.pointsCost } : null,
      total,
      currency: 'SAR',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Order creation failed', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

ordersRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT o.*, json_agg(json_build_object(
        'id', oi.id, 'nameAr', oi.name_ar, 'nameEn', oi.name_en, 'unitPrice', oi.unit_price,
        'quantity', oi.quantity, 'lineTotal', oi.line_total
      )) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1 AND o.status != 'pending_payment'
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [req.user!.id]
  );
  res.json(rows);
});

ordersRouter.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ============ Admin/staff endpoints ============

ordersRouter.get('/', requireAuth, requireRole('staff', 'owner'), async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const { rows } = await pool.query(
    `SELECT o.*, u.full_name, u.phone,
        json_agg(json_build_object('nameAr', oi.name_ar, 'nameEn', oi.name_en, 'quantity', oi.quantity)) AS items
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status != 'pending_payment' AND ($1::order_status IS NULL OR o.status = $1)
     GROUP BY o.id, u.full_name, u.phone
     ORDER BY o.created_at DESC
     LIMIT 200`,
    [status ?? null]
  );
  res.json(rows);
});

const statusUpdateSchema = z.object({
  status: z.enum(['preparing', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled']),
});

ordersRouter.patch('/:id/status', requireAuth, requireRole('staff', 'owner'), async (req: AuthedRequest, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { rows } = await pool.query(
    `UPDATE orders SET status = $2 WHERE id = $1 AND status != 'pending_payment' RETURNING id, user_id, order_number, status`,
    [req.params.id, parsed.data.status]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

  await pool.query(`INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1,$2,$3)`, [
    req.params.id,
    parsed.data.status,
    req.user!.id,
  ]);

  // Notify the admin dashboard(s) and — via a push-notification worker listening
  // on this same event — the customer's device.
  io.to('admin').emit('order:status', rows[0]);
  io.to(`user:${rows[0].user_id}`).emit('order:status', rows[0]);
  await notifyOrderStatus(rows[0].user_id, rows[0].order_number, rows[0].status);

  res.json({ ok: true });
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

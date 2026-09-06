import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { io } from '../server';
import { notifyNewMessage } from '../utils/push';

export const messagesRouter = Router({ mergeParams: true });

/**
 * Resolves the order and confirms the caller may see it: the customer who
 * placed it, or any staff/owner. Threads on a `pending_payment` order don't
 * exist yet — chat only opens once payment succeeds and the order is real.
 */
export async function loadAuthorizedOrder(orderId: string, req: AuthedRequest) {
  const { rows } = await pool.query(
    `SELECT id, user_id, status FROM orders WHERE id = $1 AND status != 'pending_payment'`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return null;
  const isOwnerCustomer = order.user_id === req.user!.id;
  const isStaff = req.user!.role === 'staff' || req.user!.role === 'owner';
  if (!isOwnerCustomer && !isStaff) return null;
  return order;
}

messagesRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const order = await loadAuthorizedOrder(req.params.orderId, req);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { rows } = await pool.query(
    `SELECT id, sender_id, sender_role, type, body, media_url, created_at
     FROM order_messages WHERE order_id = $1 ORDER BY created_at ASC`,
    [order.id]
  );
  res.json(rows);
});

const sendMessageSchema = z
  .object({
    type: z.enum(['text', 'image', 'video']),
    body: z.string().max(1000).optional(),
    mediaUrl: z.string().url().optional(),
  })
  .refine((d) => (d.type === 'text' ? !!d.body : !!d.mediaUrl), {
    message: 'text messages need a body; image/video messages need a mediaUrl',
  });

messagesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const order = await loadAuthorizedOrder(req.params.orderId, req);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const senderRole = req.user!.role === 'customer' ? 'customer' : 'staff';

  const { rows } = await pool.query(
    `INSERT INTO order_messages (order_id, sender_id, sender_role, type, body, media_url)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, sender_id, sender_role, type, body, media_url, created_at`,
    [order.id, req.user!.id, senderRole, d.type, d.body ?? null, d.mediaUrl ?? null]
  );
  const message = rows[0];

  // Push to whichever side didn't send it: the admin room if the customer
  // sent it, or that customer's personal room if staff sent it.
  const payload = { orderId: order.id, ...message };
  if (senderRole === 'customer') {
    io.to('admin').emit('order:message', payload);
  } else {
    io.to(`user:${order.user_id}`).emit('order:message', payload);
    await notifyNewMessage(order.user_id, d.type, d.body);
  }

  res.status(201).json(message);
});

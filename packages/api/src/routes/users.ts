import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { firebaseAuth } from '../utils/firebase';
import { MEDIA_ROOT } from './media';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT id, phone, phone_verified, full_name, email, role, preferred_lang FROM users WHERE id = $1`,
    [req.user!.id]
  );
  res.json(rows[0]);
});

const updateMeSchema = z.object({
  fullName: z.string().max(120).optional(),
  preferredLang: z.enum(['ar', 'en']).optional(),
  pushToken: z.string().optional(),
});

usersRouter.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  await pool.query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       preferred_lang = COALESCE($3, preferred_lang),
       push_token = COALESCE($4, push_token)
     WHERE id = $1`,
    [req.user!.id, d.fullName ?? null, d.preferredLang ?? null, d.pushToken ?? null]
  );
  res.json({ ok: true });
});

/**
 * Called after the client links a phone number + completes Firebase phone-OTP
 * verification on a Google/Facebook account. We re-verify via a fresh ID token
 * (requireAuth already did that) and just confirm the phone field is present —
 * Firebase itself is the source of truth that the OTP was correct.
 */
usersRouter.post('/me/confirm-phone', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.user!.phone) {
    return res.status(400).json({ error: 'No verified phone on the Firebase account' });
  }
  await pool.query(`UPDATE users SET phone = $2, phone_verified = TRUE WHERE id = $1`, [
    req.user!.id,
    req.user!.phone,
  ]);
  res.json({ ok: true });
});

/**
 * Account deletion — App Store Guideline 5.1.1(v) requires any app offering
 * account creation to let the customer delete that account from inside the app.
 * It is also a right under the Saudi Personal Data Protection Law.
 *
 * This ANONYMISES rather than DELETEs, deliberately. Saudi tax and commercial
 * law require invoices and order records to be retained, and `orders.user_id`
 * carries no ON DELETE CASCADE, so a hard delete would either fail outright or
 * destroy financial records we are obliged to keep. Instead every personal
 * field on the row is cleared, the Firebase account is removed so nobody can
 * sign back into it, and the genuinely personal extras — saved addresses,
 * loyalty history, and the photos of their own homes that customers upload to
 * order chats — are destroyed outright.
 *
 * What survives is an order with no name, no phone, no address and no login.
 */
usersRouter.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  let providerUid: string | null = null;
  let phone: string | null = null;
  let orderIds: string[] = [];

  try {
    await client.query('BEGIN');

    // Read the Firebase uid before it is cleared below. Looked up here rather
    // than taken from the request so this does not depend on the auth
    // middleware's shape.
    const { rows: userRows } = await client.query(
      `SELECT provider_uid, phone FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    if (userRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    providerUid = userRows[0].provider_uid;
    phone = userRows[0].phone;

    const { rows: orderRows } = await client.query(
      `SELECT id FROM orders WHERE user_id = $1`,
      [userId]
    );
    orderIds = orderRows.map((r: { id: string }) => r.id);

    // Remove operational text that is unnecessary for financial retention.
    // The address reference must be cleared first because orders.address_id
    // deliberately has no cascading delete.
    await client.query(
      `DELETE FROM order_messages
       WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)`,
      [userId]
    );
    await client.query(
      `UPDATE order_items SET notes = NULL
       WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)`,
      [userId]
    );
    await client.query(`UPDATE orders SET address_id = NULL, notes = NULL WHERE user_id = $1`, [
      userId,
    ]);
    await client.query(`DELETE FROM addresses WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM loyalty_ledger WHERE user_id = $1`, [userId]);
    if (phone) await client.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
    await client.query(
      `UPDATE users
          SET phone = NULL, phone_verified = FALSE, full_name = NULL, email = NULL,
              push_token = NULL, provider_uid = NULL, loyalty_points = 0,
              deleted_at = now(), updated_at = now()
        WHERE id = $1`,
      [userId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Best-effort cleanup, outside the transaction: a failure here must not roll
  // back a deletion the customer has already been told succeeded.
  for (const id of orderIds) {
    await fs.promises
      .rm(path.join(MEDIA_ROOT, 'order-chat', id), { recursive: true, force: true })
      .catch(() => {});
  }
  if (providerUid) {
    await firebaseAuth.deleteUser(providerUid).catch((e: unknown) => {
      console.warn(`[account-deletion] user ${userId}: Firebase account not removed:`, e);
    });
  }

  res.json({ ok: true });
});

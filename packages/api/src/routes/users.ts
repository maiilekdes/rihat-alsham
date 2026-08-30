import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';

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

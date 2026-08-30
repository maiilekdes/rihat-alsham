import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const addressesRouter = Router();

addressesRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [req.user!.id]
  );
  res.json(rows);
});

const addressSchema = z.object({
  label: z.string().max(60).optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().default('Medina'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().default(false),
});

addressesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  if (d.isDefault) {
    await pool.query(`UPDATE addresses SET is_default = FALSE WHERE user_id = $1`, [req.user!.id]);
  }
  const { rows } = await pool.query(
    `INSERT INTO addresses (user_id, label, line1, line2, city, lat, lng, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.user!.id, d.label ?? null, d.line1, d.line2 ?? null, d.city, d.lat ?? null, d.lng ?? null, d.isDefault]
  );
  res.status(201).json({ id: rows[0].id });
});

addressesRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  await pool.query(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  res.json({ ok: true });
});

import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const loyaltyRouter = Router();

loyaltyRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(`SELECT loyalty_points FROM users WHERE id = $1`, [req.user!.id]);
  const history = await pool.query(
    `SELECT type, points, note, order_id, created_at FROM loyalty_ledger
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id]
  );
  res.json({ balance: rows[0]?.loyalty_points ?? 0, history: history.rows });
});

loyaltyRouter.get('/rewards', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(`SELECT loyalty_points FROM users WHERE id = $1`, [req.user!.id]);
  const balance = rows[0]?.loyalty_points ?? 0;

  const rewards = await pool.query(
    `SELECT r.id, r.name_ar, r.name_en, r.points_cost,
            mi.name_ar AS item_name_ar, mi.name_en AS item_name_en, mi.image_url
     FROM loyalty_rewards r
     JOIN menu_items mi ON mi.id = r.menu_item_id
     WHERE r.is_active = TRUE AND mi.is_available = TRUE
     ORDER BY r.sort_order`
  );

  res.json({
    balance,
    rewards: rewards.rows.map((r) => ({ ...r, canRedeem: balance >= r.points_cost })),
  });
});

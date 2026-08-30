import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', requireAuth, requireRole('staff', 'owner'), async (req, res) => {
  const range = req.query.range === 'weekly' ? '7 days' : '1 day';

  const sales = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS order_count
     FROM orders
     WHERE status = 'completed' AND created_at >= now() - $1::interval`,
    [range]
  );

  const byPaymentType = await pool.query(
    `SELECT p.method, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS revenue
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'captured' AND o.created_at >= now() - $1::interval
     GROUP BY p.method`,
    [range]
  );

  const bestSellers = await pool.query(
    `SELECT oi.name_en, oi.name_ar, SUM(oi.quantity) AS units_sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'completed' AND o.created_at >= now() - $1::interval
     GROUP BY oi.name_en, oi.name_ar
     ORDER BY units_sold DESC
     LIMIT 10`,
    [range]
  );

  res.json({
    revenue: Number(sales.rows[0].revenue),
    orderCount: Number(sales.rows[0].order_count),
    byPaymentType: byPaymentType.rows,
    bestSellers: bestSellers.rows,
  });
});

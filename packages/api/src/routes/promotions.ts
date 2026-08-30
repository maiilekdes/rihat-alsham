import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { resolvePromotion } from '../utils/promotions';

export const promotionsRouter = Router();

/**
 * Public: the promotion to advertise on the app's home/login screen.
 * Returns the headline plus its fine print (the discount cap), so the banner
 * can show "50% off your first 3 orders" with "max 15 SAR" underneath.
 */
promotionsRouter.get('/banner', async (_req, res) => {
  // Must apply the same day-of-week and date gating as resolvePromotion —
  // otherwise the app advertises an offer the customer can't actually get
  // (e.g. showing "Weekend Offer" on a Sunday).
  const { rows } = await pool.query(
    `WITH local_now AS (SELECT (now() AT TIME ZONE 'Asia/Riyadh') AS ts)
     SELECT p.name_ar, p.name_en, p.terms_ar, p.terms_en, p.first_n_orders
     FROM promotions p, local_now
     WHERE p.is_active = TRUE
       AND p.code IS NULL
       AND (p.days_of_week IS NULL OR EXTRACT(DOW FROM local_now.ts)::int = ANY(p.days_of_week))
       AND (
         CASE WHEN p.recurs_yearly THEN
           (p.starts_at IS NULL OR to_char(local_now.ts, 'MM-DD') >= to_char(p.starts_at, 'MM-DD'))
           AND (p.ends_at IS NULL OR to_char(local_now.ts, 'MM-DD') <= to_char(p.ends_at, 'MM-DD'))
         ELSE
           (p.starts_at IS NULL OR p.starts_at <= now())
           AND (p.ends_at IS NULL OR p.ends_at >= now())
         END
       )
     -- Prefer a limited-time/holiday offer over the evergreen welcome one,
     -- then the largest headline number.
     ORDER BY (p.first_n_orders IS NULL) DESC, p.discount_value DESC
     LIMIT 1`
  );
  res.json(rows[0] ?? null);
});

/**
 * Authenticated: what discount THIS customer would get on a given subtotal.
 * Lets the cart show the real number before checkout. The value shown here is
 * advisory — the order endpoint recomputes it independently at purchase time,
 * so nothing here can be used to fix a discount in advance.
 */
promotionsRouter.get('/preview', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    subtotal: z.coerce.number().positive(),
    code: z.string().max(40).optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const client = await pool.connect();
  try {
    const promo = await resolvePromotion(client, req.user!.id, parsed.data.subtotal, parsed.data.code);
    res.json(
      promo
        ? { discountAmount: promo.discountAmount, nameAr: promo.nameAr, nameEn: promo.nameEn }
        : { discountAmount: 0, nameAr: null, nameEn: null }
    );
  } finally {
    client.release();
  }
});

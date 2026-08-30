import { PoolClient } from 'pg';

export interface AppliedPromotion {
  promotionId: string;
  discountAmount: number;
  nameAr: string;
  nameEn: string;
}

/**
 * Finds the best promotion this customer currently qualifies for and returns
 * the discount it yields on the given subtotal.
 *
 * Runs entirely server-side during order creation — the client never sends a
 * discount, only (optionally) a promo code to look up. Eligibility is derived
 * from the database, so a customer can't replay a first-order offer by editing
 * a request.
 *
 * The cap is the important bit: a "50% off" headline is bounded by
 * `max_discount`, so a 200 SAR order still only ever discounts by 15 SAR.
 */
export async function resolvePromotion(
  client: PoolClient,
  userId: string,
  subtotal: number,
  code?: string
): Promise<AppliedPromotion | null> {
  // "First N orders" counts orders that actually got paid for — anything still
  // in pending_payment was never completed and shouldn't consume the offer.
  const countRes = await client.query(
    `SELECT COUNT(*)::int AS paid_orders
     FROM orders
     WHERE user_id = $1 AND status NOT IN ('pending_payment', 'cancelled')`,
    [userId]
  );
  const paidOrders: number = countRes.rows[0].paid_orders;

  // All date/day logic is evaluated in Asia/Riyadh, never UTC. A Friday
  // promotion must follow the customer's local calendar day — an order placed
  // at 01:00 Friday in Medina is still Thursday 22:00 UTC, and would otherwise
  // get the wrong promotion (or miss one entirely).
  const { rows } = await client.query(
    `WITH local_now AS (SELECT (now() AT TIME ZONE 'Asia/Riyadh') AS ts)
     SELECT p.id, p.name_ar, p.name_en, p.discount_type, p.discount_value,
            p.max_discount, p.min_order_total, p.first_n_orders
     FROM promotions p, local_now
     WHERE p.is_active = TRUE
       AND ($2::numeric >= p.min_order_total)
       AND (p.first_n_orders IS NULL OR $3::int < p.first_n_orders)
       AND (
         -- automatic promotions (no code), or the specific code supplied
         p.code IS NULL OR ($1::text IS NOT NULL AND lower(p.code) = lower($1::text))
       )
       -- Day-of-week gate (0=Sunday … 6=Saturday), e.g. Thursday+Friday offers
       AND (
         p.days_of_week IS NULL
         OR EXTRACT(DOW FROM local_now.ts)::int = ANY(p.days_of_week)
       )
       -- Date window. Yearly-recurring promos (National Day, Foundation Day)
       -- compare month/day only so they fire again every year; one-off promos
       -- (Eid, which moves with the lunar calendar) compare full timestamps.
       AND (
         CASE WHEN p.recurs_yearly THEN
           (p.starts_at IS NULL OR to_char(local_now.ts, 'MM-DD') >= to_char(p.starts_at, 'MM-DD'))
           AND
           (p.ends_at IS NULL OR to_char(local_now.ts, 'MM-DD') <= to_char(p.ends_at, 'MM-DD'))
         ELSE
           (p.starts_at IS NULL OR p.starts_at <= now())
           AND
           (p.ends_at IS NULL OR p.ends_at >= now())
         END
       )`,
    [code ?? null, subtotal, paidOrders]
  );

  if (rows.length === 0) return null;

  // If several apply, give the customer the best one.
  let best: AppliedPromotion | null = null;
  for (const promo of rows) {
    const raw =
      promo.discount_type === 'percentage'
        ? (subtotal * Number(promo.discount_value)) / 100
        : Number(promo.discount_value);

    const capped = promo.max_discount != null ? Math.min(raw, Number(promo.max_discount)) : raw;
    // Never discount below zero, and never more than the subtotal itself.
    const discount = Math.max(0, Math.min(capped, subtotal));
    const rounded = Math.round(discount * 100) / 100;

    if (!best || rounded > best.discountAmount) {
      best = {
        promotionId: promo.id,
        discountAmount: rounded,
        nameAr: promo.name_ar,
        nameEn: promo.name_en,
      };
    }
  }

  return best && best.discountAmount > 0 ? best : null;
}

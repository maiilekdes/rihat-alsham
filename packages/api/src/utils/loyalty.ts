import { PoolClient } from 'pg';

/**
 * Settles loyalty points for an order once payment has actually succeeded —
 * never at order creation, so an abandoned or declined checkout never moves
 * points. Two things happen, both logged to the ledger rather than just
 * mutating the balance, so every change is traceable:
 *
 *   1. Award points on the amount actually paid (1 SAR = 1 point per the
 *      owner's chosen rate) — never on the pre-discount subtotal.
 *   2. If this order redeemed a reward, deduct its points cost. Clamped at
 *      zero rather than allowed to go negative — if the customer's balance
 *      already dropped below the cost (e.g. they redeemed twice before either
 *      order paid), we still honor the order they already paid for rather
 *      than blocking a completed payment over a points race condition.
 */
export async function settleLoyaltyForOrder(client: PoolClient, orderId: string) {
  const { rows } = await client.query(
    `SELECT user_id, total, redeemed_reward_id FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return;

  const earned = Math.floor(Number(order.total));
  if (earned > 0) {
    await client.query(`UPDATE users SET loyalty_points = loyalty_points + $2 WHERE id = $1`, [order.user_id, earned]);
    await client.query(
      `INSERT INTO loyalty_ledger (user_id, order_id, type, points, note) VALUES ($1,$2,'earned',$3,'1 SAR = 1 point')`,
      [order.user_id, orderId, earned]
    );
  }

  if (order.redeemed_reward_id) {
    const rewardRes = await client.query(`SELECT points_cost, name_en FROM loyalty_rewards WHERE id = $1`, [
      order.redeemed_reward_id,
    ]);
    const reward = rewardRes.rows[0];
    if (reward) {
      // Deduct the full cost or nothing, decided inside the UPDATE itself so no
      // stale read can sit between the check and the write. The previous version
      // read the balance, then took Math.min(cost, balance) — which quietly
      // deducted zero when the balance had already been spent, handing out the
      // reward for free instead of refusing it. Order creation now reserves
      // points against pending orders, so this should not trigger; it stays as
      // the last line of defence, and records what happened either way.
      const deductRes = await client.query(
        `UPDATE users SET loyalty_points = loyalty_points - $2
         WHERE id = $1 AND loyalty_points >= $2
         RETURNING loyalty_points`,
        [order.user_id, reward.points_cost]
      );
      const settled = deductRes.rowCount === 1;
      if (!settled) {
        console.warn(
          `[loyalty] order ${orderId}: could not deduct ${reward.points_cost} points from user ${order.user_id} — balance too low. Reward honoured, not charged.`
        );
      }
      await client.query(
        `INSERT INTO loyalty_ledger (user_id, order_id, type, points, note) VALUES ($1,$2,'redeemed',$3,$4)`,
        [
          order.user_id,
          orderId,
          settled ? -reward.points_cost : 0,
          settled
            ? `Redeemed: ${reward.name_en}`
            : `Redeemed: ${reward.name_en} (unsettled — balance too low at payment)`,
        ]
      );
    }
  }
}

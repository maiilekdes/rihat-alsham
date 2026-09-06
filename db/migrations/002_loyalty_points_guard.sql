-- Backstop for the points balance. Application code reserves points at order
-- creation and deducts them atomically at payment, but a balance that can go
-- negative is the kind of thing that should be impossible at the storage layer
-- too, not only in the code path that happens to be correct today.
BEGIN;

-- Any row already negative would block the constraint. There should be none;
-- clamp defensively so applying this is never a surprise outage.
UPDATE users SET loyalty_points = 0 WHERE loyalty_points < 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_loyalty_points_non_negative;
ALTER TABLE users ADD CONSTRAINT users_loyalty_points_non_negative
  CHECK (loyalty_points >= 0);

COMMIT;

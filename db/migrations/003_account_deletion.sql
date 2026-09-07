-- Account deletion (App Store Guideline 5.1.1(v) + PDPL right to erasure).
-- The row is anonymised rather than deleted because orders.user_id has no
-- cascade and invoices must be retained under Saudi tax law; deleted_at marks
-- which rows are tombstones so they are never treated as live accounts.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
COMMIT;

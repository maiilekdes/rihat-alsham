-- Apply before deploying the UID-based authentication middleware.
BEGIN;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
UPDATE users SET phone = NULL WHERE phone = '';
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_uid_unique ON users(provider_uid);
COMMIT;

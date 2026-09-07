-- Rihasham (ريحا الشام) database schema
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ USERS ============
CREATE TYPE user_role AS ENUM ('customer', 'staff', 'owner');

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             VARCHAR(20) UNIQUE,                -- NULL until verified; E.164, e.g. +9665XXXXXXXX
  phone_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  full_name         VARCHAR(120),
  email             VARCHAR(160),
  auth_provider     VARCHAR(20) NOT NULL DEFAULT 'phone', -- phone | google | facebook
  provider_uid      VARCHAR(160) UNIQUE,                       -- external auth uid, if any
  role              user_role NOT NULL DEFAULT 'customer',
  preferred_lang    VARCHAR(5) NOT NULL DEFAULT 'ar',    -- ar | en
  push_token        VARCHAR(255),
  loyalty_points    INT NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),   -- see loyalty_ledger below for the auditable history behind this number
  deleted_at        TIMESTAMPTZ,             -- account deleted by the customer: the row is anonymised, not removed, because orders must be retained for tax
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) NOT NULL,
  code_hash     VARCHAR(255) NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  attempts      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone ON otp_codes(phone);

CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(60),           -- e.g. "Home", "Work"
  line1         VARCHAR(200) NOT NULL,
  line2         VARCHAR(200),
  city          VARCHAR(80) NOT NULL DEFAULT 'Medina',
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ BRANCHES (for pickup) ============
CREATE TABLE branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar       VARCHAR(120) NOT NULL,
  name_en       VARCHAR(120) NOT NULL,
  address_ar    VARCHAR(255),
  address_en    VARCHAR(255),
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  phone         VARCHAR(20),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============ MENU ============
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar       VARCHAR(120) NOT NULL,
  name_en       VARCHAR(120) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE menu_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name_ar           VARCHAR(160) NOT NULL,
  name_en           VARCHAR(160) NOT NULL,
  description_ar    TEXT,
  description_en    TEXT,
  base_price        NUMERIC(10,2) NOT NULL,   -- SAR, used when no variants
  image_url         TEXT,
  spice_level_max   INT NOT NULL DEFAULT 0,    -- 0 = not applicable
  calories          INT,                       -- per default size; see item_variants.calories for per-size overrides
  is_combo          BOOLEAN NOT NULL DEFAULT FALSE,  -- see combo_slots below
  is_available      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);

-- Variants, e.g. "Sandwich" vs "Plate"
CREATE TABLE item_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name_ar       VARCHAR(80) NOT NULL,
  name_en       VARCHAR(80) NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INT NOT NULL DEFAULT 0,
  calories      INT   -- overrides the item's calories for this size, when they genuinely differ (e.g. a rice plate at 1/2kg vs 1kg vs 2kg)
);

-- Add-ons / extras, e.g. "Extra cheese", "Garlic sauce"
CREATE TABLE item_extras (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name_ar       VARCHAR(80) NOT NULL,
  name_en       VARCHAR(80) NOT NULL,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_available  BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============ MEAL COMBOS ============
-- A combo is a menu_item flagged is_combo, composed of ordered "slots"
-- ("Choose your sandwich", "Choose your drink"), each offering options.
-- base_price covers the default choices; options may carry an upcharge.
CREATE TABLE combo_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id      UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name_ar       VARCHAR(120) NOT NULL,
  name_en       VARCHAR(120) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_required   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_combo_slots_combo ON combo_slots(combo_id, sort_order);

CREATE TABLE combo_slot_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       UUID NOT NULL REFERENCES combo_slots(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  variant_id    UUID REFERENCES item_variants(id) ON DELETE CASCADE,
  extra_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_combo_options_slot ON combo_slot_options(slot_id, sort_order);

-- order_item_selections (snapshot of a combo's chosen slot options) is
-- declared further below, right after order_items — it references that
-- table, which doesn't exist yet at this point in the file.

-- ============ PROMOTIONS ============
-- Capped percentage discounts, e.g. "50% off your first 3 orders, max 15 SAR".
-- The cap is what makes this safe to advertise: a 50% headline reads well, but
-- max_discount bounds the cost of any single order regardless of its size.
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE promotions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(40) UNIQUE,        -- NULL = automatic (no code to type)
  name_ar           VARCHAR(160) NOT NULL,
  name_en           VARCHAR(160) NOT NULL,
  terms_ar          VARCHAR(255),              -- the fine print shown under the banner
  terms_en          VARCHAR(255),
  discount_type     discount_type NOT NULL DEFAULT 'percentage',
  discount_value    NUMERIC(10,2) NOT NULL,    -- 50 = 50% (or a flat SAR amount if 'fixed')
  max_discount      NUMERIC(10,2),             -- SAR cap; NULL = uncapped
  min_order_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
  first_n_orders    INT,                       -- e.g. 3 = only a customer's first 3 orders
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  days_of_week      INT[],                     -- 0=Sunday…6=Saturday, evaluated in Asia/Riyadh; NULL = any day (see utils/promotions.ts)
  recurs_yearly     BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE: starts_at/ends_at compared by month-day only (fixed-date holidays); FALSE: full timestamp (Eid, which moves yearly)
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ LOYALTY POINTS ============
-- 1 SAR paid = 1 point (owner's chosen rate — see loyalty_ledger for the
-- earning/redemption logic that maintains users.loyalty_points).
-- Rewards swap points for a specific menu item at 0 SAR rather than a cash
-- discount — ties rewards to real dishes instead of becoming a discount code.
CREATE TABLE loyalty_rewards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar         VARCHAR(160) NOT NULL,
  name_en         VARCHAR(160) NOT NULL,
  points_cost     INT NOT NULL,
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id),
  variant_id      UUID REFERENCES item_variants(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0
);

-- ============ ORDERS ============
CREATE TYPE order_status AS ENUM (
  'pending_payment',  -- created, awaiting gateway confirmation
  'received',         -- paid, sent to kitchen
  'preparing',
  'out_for_delivery',
  'ready_for_pickup',
  'completed',
  'cancelled'
);

CREATE TYPE fulfillment_type AS ENUM ('delivery', 'pickup');
CREATE TYPE payment_method AS ENUM ('mada', 'visa', 'mastercard');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded');

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        SERIAL UNIQUE,               -- human-friendly, e.g. #1042
  user_id             UUID NOT NULL REFERENCES users(id),
  status              order_status NOT NULL DEFAULT 'pending_payment',
  fulfillment_type    fulfillment_type NOT NULL,
  address_id          UUID REFERENCES addresses(id),
  branch_id           UUID REFERENCES branches(id),
  subtotal            NUMERIC(10,2) NOT NULL,
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  promotion_id        UUID REFERENCES promotions(id),
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  redeemed_reward_id  UUID REFERENCES loyalty_rewards(id),
  total               NUMERIC(10,2) NOT NULL,   -- subtotal - discount_amount + delivery_fee
  currency             VARCHAR(3) NOT NULL DEFAULT 'SAR',
  notes               TEXT,
  estimated_ready_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES menu_items(id),
  variant_id    UUID REFERENCES item_variants(id),
  name_ar       VARCHAR(160) NOT NULL,   -- snapshot at order time
  name_en       VARCHAR(160) NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  spice_level   INT,
  notes         TEXT,
  line_total    NUMERIC(10,2) NOT NULL
);

CREATE TABLE order_item_extras (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  name_ar           VARCHAR(80) NOT NULL,
  name_en           VARCHAR(80) NOT NULL,
  price             NUMERIC(10,2) NOT NULL
);

-- Snapshot of a combo's chosen slot options, frozen at order time.
CREATE TABLE order_item_selections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  slot_name_ar      VARCHAR(120) NOT NULL,
  slot_name_en      VARCHAR(120) NOT NULL,
  choice_name_ar    VARCHAR(160) NOT NULL,
  choice_name_en    VARCHAR(160) NOT NULL,
  extra_price       NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_order_item_selections ON order_item_selections(order_item_id);

-- Ledger of every points movement — never mutate users.loyalty_points
-- directly, so there's always an audit trail explaining how a balance got
-- where it is. order_id is nullable and ON DELETE SET NULL: a ledger entry
-- is a permanent financial record and must survive even if the order row
-- it references were ever removed.
CREATE TYPE loyalty_entry_type AS ENUM ('earned', 'redeemed', 'expired', 'adjusted');

CREATE TABLE loyalty_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  type          loyalty_entry_type NOT NULL,
  points        INT NOT NULL,   -- positive for earned, negative for redeemed/expired
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_ledger_user ON loyalty_ledger(user_id, created_at DESC);

-- Status history, for audit + push-notification triggers
CREATE TABLE order_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status        order_status NOT NULL,
  changed_by    UUID REFERENCES users(id),  -- staff/owner who made the change; null = system
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order-scoped delivery chat: one thread per order, closed once the order
-- completes. Customer and staff can both send text and photo/video notes
-- (e.g. a photo of the building/door) to coordinate delivery.
CREATE TYPE message_type AS ENUM ('text', 'image', 'video');
CREATE TYPE message_sender_role AS ENUM ('customer', 'staff');

CREATE TABLE order_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES users(id),
  sender_role   message_sender_role NOT NULL,
  type          message_type NOT NULL DEFAULT 'text',
  body          TEXT,        -- text content, or a caption alongside media
  media_url     TEXT,        -- Firebase Storage download URL for image/video
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_messages_order ON order_messages(order_id, created_at);

-- ============ PAYMENTS ============
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gateway           VARCHAR(30) NOT NULL DEFAULT 'moyasar',
  gateway_payment_id VARCHAR(120),
  method            payment_method NOT NULL,
  status            payment_status NOT NULL DEFAULT 'pending',
  amount            NUMERIC(10,2) NOT NULL,
  currency          VARCHAR(3) NOT NULL DEFAULT 'SAR',
  card_last4        VARCHAR(4),
  card_brand        VARCHAR(20),
  raw_response      JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE UNIQUE INDEX idx_payments_gateway_id ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

-- ============ TRIGGERS: updated_at ============
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

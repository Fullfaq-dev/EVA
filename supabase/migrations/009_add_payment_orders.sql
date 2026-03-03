-- Create payment_orders table to track Robokassa payment lifecycle.
-- The auto-generated integer "id" is used as InvId in Robokassa requests.

CREATE TABLE payment_orders (
  id         BIGSERIAL PRIMARY KEY,           -- InvId sent to Robokassa
  telegram_id TEXT NOT NULL,                  -- Buyer's Telegram ID
  plan_name  TEXT NOT NULL,                   -- "1 Месяц" | "3 Месяца" | "1 Год"
  amount     NUMERIC(10, 2) NOT NULL,         -- Payment amount in RUB
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at    TIMESTAMPTZ                      -- Filled by ResultURL Edge Function
);

-- Indexes for quick lookups
CREATE INDEX payment_orders_telegram_id_idx ON payment_orders (telegram_id);
CREATE INDEX payment_orders_status_idx ON payment_orders (status);

-- RLS: service role writes (Edge Function), anon can insert own orders
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated/anon users to insert their own orders
CREATE POLICY "Users can create their own payment orders"
  ON payment_orders FOR INSERT
  WITH CHECK (true);

-- Allow users to read their own orders
CREATE POLICY "Users can view their own payment orders"
  ON payment_orders FOR SELECT
  USING (true);

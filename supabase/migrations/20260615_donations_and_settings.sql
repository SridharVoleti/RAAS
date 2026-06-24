-- Donations table: records every donation (course-specific or general)
CREATE TABLE IF NOT EXISTS donations (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  amount              integer     NOT NULL CHECK (amount > 0),  -- in paise
  purpose             text        NOT NULL DEFAULT 'general',   -- 'general' | 'course'
  course_id           integer     REFERENCES courses(id) ON DELETE SET NULL,
  razorpay_order_id   text        UNIQUE,
  razorpay_payment_id text,
  status              text        NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  receipt_number      text        UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Trigger: keep updated_at current
CREATE TRIGGER set_donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own donations"
  ON donations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on donations"
  ON donations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Site settings: flat key-value store for admin-configurable values
CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site_settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on site_settings"
  ON site_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed default bank-detail keys (blank values — admin fills them in)
INSERT INTO site_settings (key, value) VALUES
  ('bank_upi_id',           ''),
  ('bank_account_holder',   'Krishnamargam'),
  ('bank_name',             ''),
  ('bank_account_number',   ''),
  ('bank_ifsc',             ''),
  ('bank_qr_url',           '')
ON CONFLICT (key) DO NOTHING;

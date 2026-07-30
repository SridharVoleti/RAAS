-- International (non-Indian) course purchases: a genuine sale of course access,
-- not a donation — sidesteps FCRA entirely. Paid via manual bank transfer/QR
-- (no international payment gateway wired yet) and confirmed by admin after
-- matching the transfer to the student's submitted details.
CREATE TABLE IF NOT EXISTS course_purchases (
  id                 serial PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id          int NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount_usd         numeric(10,2) NOT NULL DEFAULT 25,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  payment_reference  text,
  receipt_number     text UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  confirmed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id ON course_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_status  ON course_purchases(status);

ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own course purchases" ON course_purchases;
CREATE POLICY "Users can view own course purchases"
  ON course_purchases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own course purchases" ON course_purchases;
CREATE POLICY "Users can insert own course purchases"
  ON course_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on course_purchases" ON course_purchases;
CREATE POLICY "Service role full access on course_purchases"
  ON course_purchases FOR ALL
  USING (true)
  WITH CHECK (true);

-- International payment details (admin-configurable, mirrors the bank_* keys used for domestic donations)
INSERT INTO site_settings (key, value) VALUES
  ('intl_bank_account_holder',   ''),
  ('intl_bank_name',             ''),
  ('intl_account_number',        ''),
  ('intl_swift_bic',             ''),
  ('intl_iban',                  ''),
  ('intl_qr_url',                ''),
  ('intl_payment_instructions',  '')
ON CONFLICT (key) DO NOTHING;

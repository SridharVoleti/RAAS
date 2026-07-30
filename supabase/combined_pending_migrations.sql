-- ============================================================
-- Combined: 4 pending migrations, run in the Supabase SQL Editor
-- Safe to run as a single paste — every statement is idempotent
-- (IF NOT EXISTS / ON CONFLICT), so re-running is harmless.
-- ============================================================

-- 1) 20260727_donations_donor_state.sql
-- Records the donor's self-declared state/location and FCRA declaration acceptance
-- at time of donation, as evidence that the Trust only accepted eligible
-- Indian-domestic contributions from donors who affirmed the compliance declaration.
ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_state text;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS declaration_accepted boolean NOT NULL DEFAULT false;

-- 2) 20260728_course_purchases.sql
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

-- 3) 20260730_certificate_numbers.sql
-- ============================================================
-- Global certificate counter: one row per (student, course) certificate
-- ever earned, independent of course or path. The bigserial id IS the
-- printed certificate number — starts at 1 and only ever goes up, so the
-- trust can see how many certificates it has issued in total.
--
-- Numbers are assigned lazily (get-or-create) the first time a genuine
-- certificate is confirmed earned, via the service role only. Admin
-- certificate *previews* never touch this table, so test/demo PDFs don't
-- burn real numbers.
--
-- Run in Supabase SQL Editor (as postgres / service role).
-- Idempotent — safe to run more than once.
-- ============================================================

create table if not exists certificate_numbers (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  int  not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table certificate_numbers enable row level security;

drop policy if exists "certificate_numbers_own_read" on certificate_numbers;
create policy "certificate_numbers_own_read" on certificate_numbers
  for select using (auth.uid() = user_id);

-- No insert/update policy for regular roles: numbers are only ever assigned
-- server-side via the service role client, which bypasses RLS entirely.

-- 4) 20260730_donation_qr_default.sql
-- Set the default UPI QR code image shown on the donation page for Indian donations.
-- Image is served as a static asset from /public (see public/donationaccount.jpeg).
INSERT INTO site_settings (key, value) VALUES
  ('bank_qr_url', '/donationaccount.jpeg')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

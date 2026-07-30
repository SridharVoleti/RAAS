-- Set the default UPI QR code image shown on the donation page for Indian donations.
-- Image is served as a static asset from /public (see public/donationaccount.jpeg).
INSERT INTO site_settings (key, value) VALUES
  ('bank_qr_url', '/donationaccount.jpeg')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

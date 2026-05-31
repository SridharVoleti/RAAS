-- ============================================================
-- One-time setup: promote sridhar.voleti@gmail.com to admin
-- and set password to Krishnamargam
--
-- Run this in the Supabase SQL Editor (as postgres / service role)
-- ============================================================

-- 1. Promote to admin
SELECT promote_to_admin('sridhar.voleti@gmail.com');

-- 2. Set password
UPDATE auth.users
SET encrypted_password = crypt('Krishnamargam', gen_salt('bf'))
WHERE email = 'sridhar.voleti@gmail.com';

-- 3. Confirm the result
SELECT
  u.email,
  p.is_admin,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'sridhar.voleti@gmail.com';

-- ============================================================
-- One-time setup: promote sridhar.voleti@gmail.com to admin
-- and set password to Krishnamargam
--
-- Run this in the Supabase SQL Editor (as postgres / service role)
-- ============================================================

-- 1. Ensure a profile row exists (creates one if the trigger never ran)
INSERT INTO public.profiles (id, full_name, avatar_initials, is_admin, profile_complete)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  UPPER(LEFT(COALESCE(raw_user_meta_data->>'full_name', email), 1)) ||
  UPPER(LEFT(SPLIT_PART(COALESCE(raw_user_meta_data->>'full_name', '  '), ' ', 2), 1)),
  true,
  true
FROM auth.users
WHERE email = 'sridhar.voleti@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET is_admin        = true,
      profile_complete = true;

-- 2. Set password
UPDATE auth.users
SET encrypted_password = crypt('Krishnamargam', gen_salt('bf'))
WHERE email = 'sridhar.voleti@gmail.com';

-- 3. Confirm the result
SELECT
  u.email,
  p.is_admin,
  p.profile_complete,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'sridhar.voleti@gmail.com';

-- ============================================================
-- Promote any registered user to admin for testing purposes.
-- Uses the promote_to_admin() function (already in the DB).
--
-- Usage: replace the email below and run in the Supabase SQL Editor.
-- ============================================================

-- Test account roles:
--   Admin:   sridhar.voleti@gmail.com  (already promoted via promote_sridhar_admin.sql)
--   Student: voletis17@gmail.com       (regular user — do NOT promote this one)

-- Step 1: Promote admin account (skip if already done)
UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'testadmin5@gmail.com');

-- Step 2: Confirm both accounts
SELECT
  u.email,
  p.full_name,
  p.is_admin,
  p.profile_complete,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email IN ('sridhar.voleti@gmail.com', 'voletis17@gmail.com')
ORDER BY p.is_admin DESC;

-- ── To promote a DIFFERENT account ──
-- SELECT promote_to_admin('other@example.com');

-- ── To REVOKE admin (restore to student) ──
-- UPDATE profiles SET is_admin = false
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'voletis17@gmail.com');

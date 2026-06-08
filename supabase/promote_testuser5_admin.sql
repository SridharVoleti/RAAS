-- Promote testuser5@gmail.com to admin.
-- Uses a direct UPDATE — no function dependency.

UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'testuser5@gmail.com'
);

-- Verify all test accounts and their roles
SELECT
  u.email,
  p.full_name,
  p.is_admin,
  p.profile_complete,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email IN (
  'voletis17@gmail.com',
  'sridhar.voleti@gmail.com',
  'testuser1@gmail.com',
  'testuser2@gmail.com',
  'testuser3@gmail.com',
  'testuser4@gmail.com',
  'testuser5@gmail.com'
)
ORDER BY p.is_admin DESC, u.email;

-- ============================================================
-- Create 5 test users for regression / parallel testing.
-- Run this in the Supabase SQL Editor (as postgres / service role).
--
-- Password for all accounts: KrishnaMargam
-- The on_auth_user_created trigger auto-creates each profile row.
-- ============================================================

DO $$
DECLARE
  u RECORD;
  new_id UUID;
BEGIN
  FOR u IN
    SELECT *
    FROM (VALUES
      ('testuser1@gmail.com', 'Test User 1', 'TU'),
      ('testuser2@gmail.com', 'Test User 2', 'TU'),
      ('testuser3@gmail.com', 'Test User 3', 'TU'),
      ('testuser4@gmail.com', 'Test User 4', 'TU'),
      ('testuser5@gmail.com', 'Test User 5', 'TU')
    ) AS t(email, full_name, initials)
  LOOP
    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = u.email) THEN
      RAISE NOTICE 'SKIP  % — already exists', u.email;
      CONTINUE;
    END IF;

    new_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_id,
      'authenticated',
      'authenticated',
      u.email,
      crypt('KrishnaMargam', gen_salt('bf')),
      NOW(),                                            -- email pre-confirmed
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'full_name',       u.full_name,
        'avatar_initials', u.initials,
        'city',            'Hyderabad',
        'referral_source', 'other'
      ),
      NOW(),
      NOW()
    );

    -- profile_complete is set to true by the on_auth_user_created trigger,
    -- so users go straight to the app without hitting /onboarding.
    RAISE NOTICE 'OK    % created (id: %)', u.email, new_id;
  END LOOP;
END;
$$;

-- ── Verify ──────────────────────────────────────────────────
SELECT
  u.email,
  p.full_name,
  p.is_admin,
  p.profile_complete,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email LIKE 'testuser%@gmail.com'
ORDER BY u.email;

-- ── Cleanup (run only when you want to DELETE these accounts) ──
-- DELETE FROM auth.users WHERE email LIKE 'testuser%@gmail.com';

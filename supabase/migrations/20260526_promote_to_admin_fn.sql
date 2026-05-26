-- Helper function to promote a user to admin by email.
-- Run once in Supabase SQL editor after first registration:
--   SELECT promote_to_admin('your@email.com');

create or replace function promote_to_admin(admin_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from auth.users
  where email = lower(trim(admin_email));

  if target_id is null then
    return 'ERROR: No user found with email ' || admin_email || '. Register first, then run this.';
  end if;

  update profiles set is_admin = true where id = target_id;
  return 'OK: ' || admin_email || ' is now an admin.';
end;
$$;

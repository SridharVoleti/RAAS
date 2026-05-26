-- Migration: Add username, fathers_name, address, referral_source to profiles
-- Run in Supabase SQL Editor

-- 1. Add new columns
alter table profiles
  add column if not exists username       text,
  add column if not exists fathers_name   text,
  add column if not exists address        text,
  add column if not exists referral_source text;

-- 2. Unique index on username (partial – allows NULL for existing rows)
create unique index if not exists idx_profiles_username
  on profiles(username) where username is not null;

-- 3. Public RPC so the register page can check username availability with the anon key
create or replace function check_username_available(uname text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles where username = lower(trim(uname))
  );
$$;

grant execute on function check_username_available(text) to anon, authenticated;

-- 4. Update the trigger so new sign-ups get all fields saved automatically
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_name   text;
  initials   text;
  words      text[];
  raw_mobile text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  raw_mobile := new.raw_user_meta_data->>'mobile';

  words := string_to_array(trim(raw_name), ' ');
  if array_length(words, 1) >= 2 then
    initials := upper(left(words[1], 1)) || upper(left(words[array_length(words,1)], 1));
  else
    initials := upper(left(raw_name, 2));
  end if;

  insert into profiles (
    id,
    full_name,
    avatar_initials,
    mobile,
    city,
    username,
    fathers_name,
    address,
    referral_source,
    profile_complete
  )
  values (
    new.id,
    raw_name,
    initials,
    raw_mobile,
    new.raw_user_meta_data->>'city',
    lower(trim(new.raw_user_meta_data->>'username')),
    new.raw_user_meta_data->>'fathers_name',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'referral_source',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

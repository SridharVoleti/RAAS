-- ============================================================
-- Krishnamargam – Full Database Schema v1.0
-- Run this in Supabase SQL Editor (as postgres / service role)
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── ENUM types ─────────────────────────────────────────────
do $$ begin
  create type level_type as enum ('Beginner', 'Intermediate', 'Advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type badge_type as enum ('Popular', 'New', 'Free');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('created', 'paid', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lang_type as enum ('en', 'te');
exception when duplicate_object then null; end $$;

-- ─── PATHS ──────────────────────────────────────────────────
create table if not exists paths (
  id            serial primary key,
  slug          text not null unique,
  name          text not null,
  emoji         text not null default '🕉️',
  tagline_en    text not null,
  tagline_te    text not null,
  description_en text not null,
  description_te text not null,
  is_active     boolean not null default true,
  order_index   int not null default 0,
  created_at    timestamptz not null default now()
);

-- ─── COURSES ────────────────────────────────────────────────
create table if not exists courses (
  id             serial primary key,
  path_id        int not null references paths(id) on delete restrict,
  slug           text not null unique,
  emoji          text not null default '📖',
  bg_color       text not null default '#1a0f00',
  title_en       text not null,
  title_te       text not null,
  description_en text not null,
  description_te text not null,
  instructor_en  text not null,
  instructor_te  text not null,
  category       text not null,
  level          level_type not null default 'Beginner',
  badge          badge_type,
  duration       text not null default '4 weeks',
  is_free        boolean not null default false,
  price          numeric(10,2) not null default 0,
  rating         numeric(3,2) not null default 4.5,
  review_count   int not null default 0,
  student_count  int not null default 0,
  has_quiz       boolean not null default false,
  order_index    int not null default 0,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_courses_path_id on courses(path_id);
create index if not exists idx_courses_slug on courses(slug);
create index if not exists idx_courses_published on courses(is_published) where is_published = true;

-- ─── LESSONS ────────────────────────────────────────────────
create table if not exists lessons (
  id               serial primary key,
  course_id        int not null references courses(id) on delete cascade,
  section_title    text,
  title_en         text not null,
  title_te         text,
  youtube_video_id text not null,
  duration         text,
  order_index      int not null default 0,
  is_preview       boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists idx_lessons_course_id on lessons(course_id);

-- ─── PROFILES ───────────────────────────────────────────────
-- Mirrors auth.users; created via trigger on signup
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null default '',
  mobile          text,
  isd_code        text not null default '+91',
  avatar_initials text not null default '?',
  is_admin        boolean not null default false,
  preferred_lang  lang_type not null default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── ENROLLMENTS ────────────────────────────────────────────
create table if not exists enrollments (
  id           serial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    int not null references courses(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  is_active    boolean not null default false,
  activated_at timestamptz,
  unique (user_id, course_id)
);

create index if not exists idx_enrollments_user_id on enrollments(user_id);
create index if not exists idx_enrollments_course_id on enrollments(course_id);

-- ─── USER PROGRESS ──────────────────────────────────────────
create table if not exists user_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    int not null references courses(id) on delete cascade,
  lesson_id    int not null references lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  unique (user_id, lesson_id)
);

create index if not exists idx_user_progress_user_course on user_progress(user_id, course_id);

-- ─── USER NOTES ─────────────────────────────────────────────
create table if not exists user_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  int not null references courses(id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- ─── PAYMENT LOGS ───────────────────────────────────────────
create table if not exists payment_logs (
  id                   serial primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  course_id            int not null references courses(id) on delete cascade,
  razorpay_order_id    text,
  razorpay_payment_id  text,
  amount               numeric(10,2) not null,
  status               payment_status not null default 'created',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_payment_logs_user_id on payment_logs(user_id);
create index if not exists idx_payment_logs_status on payment_logs(status);

-- ─── TESTIMONIALS ───────────────────────────────────────────
create table if not exists testimonials (
  id            serial primary key,
  reviewer_name text not null,
  content_en    text not null,
  content_te    text,
  rating        int not null default 5 check (rating between 1 and 5),
  course_id     int references courses(id) on delete set null,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── TRIGGER: auto-create profile on signup ─────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_name  text;
  initials  text;
  words     text[];
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Build initials (up to 2 chars)
  words := string_to_array(trim(raw_name), ' ');
  if array_length(words, 1) >= 2 then
    initials := upper(left(words[1], 1)) || upper(left(words[array_length(words,1)], 1));
  else
    initials := upper(left(raw_name, 2));
  end if;

  insert into profiles (id, full_name, avatar_initials)
  values (new.id, raw_name, initials)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── TRIGGER: updated_at for courses ────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists courses_updated_at on courses;
create trigger courses_updated_at
  before update on courses
  for each row execute function set_updated_at();

drop trigger if exists payment_logs_updated_at on payment_logs;
create trigger payment_logs_updated_at
  before update on payment_logs
  for each row execute function set_updated_at();

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists user_notes_updated_at on user_notes;
create trigger user_notes_updated_at
  before update on user_notes
  for each row execute function set_updated_at();

-- ─── TRIGGER: auto-activate free course on enrollment ───────
create or replace function auto_activate_free_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  course_is_free boolean;
begin
  select is_free into course_is_free from courses where id = new.course_id;
  if course_is_free then
    new.is_active := true;
    new.activated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_activate_free on enrollments;
create trigger auto_activate_free
  before insert on enrollments
  for each row execute function auto_activate_free_enrollment();

-- ─── VIEW: vw_my_courses ────────────────────────────────────
create or replace view vw_my_courses as
select
  e.user_id,
  c.id              as course_id,
  c.slug,
  c.emoji,
  c.bg_color,
  c.title_en,
  c.title_te,
  c.description_en,
  c.description_te,
  c.instructor_en,
  c.instructor_te,
  c.category,
  c.level::text     as level,
  c.badge::text     as badge,
  c.duration,
  c.is_free,
  c.price,
  c.rating,
  c.review_count,
  c.student_count,
  c.has_quiz,
  c.order_index,
  c.is_published,
  e.enrolled_at,
  e.activated_at,
  e.is_active,
  -- Progress
  (select count(*) from lessons l where l.course_id = c.id)                          as total_lessons,
  (select count(*) from user_progress up
   where up.user_id = e.user_id and up.course_id = c.id)                             as completed_lessons,
  case
    when (select count(*) from lessons l where l.course_id = c.id) = 0 then 0
    else round(
      (select count(*) from user_progress up
       where up.user_id = e.user_id and up.course_id = c.id)::numeric
      / (select count(*) from lessons l where l.course_id = c.id)::numeric * 100
    )
  end                                                                                  as progress_pct
from enrollments e
join courses c on c.id = e.course_id
where e.is_active = true
  and c.is_published = true;

-- ─── VIEW: vw_course_progress ───────────────────────────────
create or replace view vw_course_progress as
select
  up.user_id,
  up.course_id,
  count(*)                                                      as completed_lessons,
  (select count(*) from lessons l where l.course_id = up.course_id) as total_lessons,
  case
    when (select count(*) from lessons l where l.course_id = up.course_id) = 0 then 0
    else round(
      count(*)::numeric
      / (select count(*) from lessons l where l.course_id = up.course_id)::numeric * 100
    )
  end                                                           as progress_pct
from user_progress up
group by up.user_id, up.course_id;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────

-- Enable RLS on all tables
alter table paths         enable row level security;
alter table courses       enable row level security;
alter table lessons       enable row level security;
alter table profiles      enable row level security;
alter table enrollments   enable row level security;
alter table user_progress enable row level security;
alter table user_notes    enable row level security;
alter table payment_logs  enable row level security;
alter table testimonials  enable row level security;

-- paths: public read
drop policy if exists "paths_public_read" on paths;
create policy "paths_public_read" on paths for select using (true);

-- courses: public read (published only enforced at app layer)
drop policy if exists "courses_public_read" on courses;
create policy "courses_public_read" on courses for select using (true);

-- lessons: public read
drop policy if exists "lessons_public_read" on lessons;
create policy "lessons_public_read" on lessons for select using (true);

-- testimonials: public read
drop policy if exists "testimonials_public_read" on testimonials;
create policy "testimonials_public_read" on testimonials for select using (is_published = true);

-- profiles: user reads/updates own row
drop policy if exists "profiles_own_read" on profiles;
create policy "profiles_own_read" on profiles for select using (auth.uid() = id);

drop policy if exists "profiles_own_update" on profiles;
create policy "profiles_own_update" on profiles for update using (auth.uid() = id);

-- enrollments: user reads own rows
drop policy if exists "enrollments_own_read" on enrollments;
create policy "enrollments_own_read" on enrollments for select using (auth.uid() = user_id);

drop policy if exists "enrollments_own_insert" on enrollments;
create policy "enrollments_own_insert" on enrollments for insert with check (auth.uid() = user_id);

-- user_progress: user reads/inserts own rows
drop policy if exists "progress_own_read" on user_progress;
create policy "progress_own_read" on user_progress for select using (auth.uid() = user_id);

drop policy if exists "progress_own_insert" on user_progress;
create policy "progress_own_insert" on user_progress for insert with check (auth.uid() = user_id);

-- user_notes: user reads/upserts own rows
drop policy if exists "notes_own_read" on user_notes;
create policy "notes_own_read" on user_notes for select using (auth.uid() = user_id);

drop policy if exists "notes_own_upsert" on user_notes;
create policy "notes_own_upsert" on user_notes for insert with check (auth.uid() = user_id);

drop policy if exists "notes_own_update" on user_notes;
create policy "notes_own_update" on user_notes for update using (auth.uid() = user_id);

-- payment_logs: user reads own rows; insert via authenticated
drop policy if exists "payments_own_read" on payment_logs;
create policy "payments_own_read" on payment_logs for select using (auth.uid() = user_id);

drop policy if exists "payments_own_insert" on payment_logs;
create policy "payments_own_insert" on payment_logs for insert with check (auth.uid() = user_id);

-- Admin policies (service_role bypasses RLS by default — no extra policies needed)
-- vw_my_courses and vw_course_progress: grant select via service_role in API routes
grant select on vw_my_courses to authenticated;
grant select on vw_course_progress to authenticated;

-- ============================================================
-- Quiz feature tables
-- Run in Supabase SQL Editor (as postgres / service role)
-- ============================================================

-- ─── QUIZ QUESTIONS ─────────────────────────────────────────
create table if not exists quiz_questions (
  id             serial primary key,
  course_id      int not null references courses(id) on delete cascade,
  question_en    text not null,
  question_te    text,
  option_a_en    text not null,
  option_a_te    text,
  option_b_en    text not null,
  option_b_te    text,
  option_c_en    text not null,
  option_c_te    text,
  option_d_en    text not null,
  option_d_te    text,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  order_index    int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_quiz_questions_course_id on quiz_questions(course_id);

alter table quiz_questions enable row level security;

drop policy if exists "quiz_questions_authenticated_read" on quiz_questions;
create policy "quiz_questions_authenticated_read" on quiz_questions
  for select using (auth.role() = 'authenticated');

-- ─── QUIZ SUBMISSIONS ───────────────────────────────────────
create table if not exists quiz_submissions (
  id              serial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       int not null references courses(id) on delete cascade,
  score           int not null,
  total_questions int not null,
  submitted_at    timestamptz not null default now()
);

create index if not exists idx_quiz_submissions_user_course on quiz_submissions(user_id, course_id);

alter table quiz_submissions enable row level security;

drop policy if exists "quiz_submissions_own_read" on quiz_submissions;
create policy "quiz_submissions_own_read" on quiz_submissions
  for select using (auth.uid() = user_id);

drop policy if exists "quiz_submissions_own_insert" on quiz_submissions;
create policy "quiz_submissions_own_insert" on quiz_submissions
  for insert with check (auth.uid() = user_id);

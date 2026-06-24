-- ============================================================
-- Adaptive Certification Exam System
-- Run in Supabase SQL Editor (as postgres / service role)
-- ============================================================

-- ─── Add exam support flag to courses ───────────────────────
alter table courses add column if not exists has_exam boolean not null default false;

-- ─── Add exam_only flag to enrollments ──────────────────────
alter table enrollments add column if not exists exam_only boolean not null default false;

-- ─── EXAM QUESTIONS ─────────────────────────────────────────
-- Course-level question bank (separate from per-lesson quiz_questions)
-- difficulty: 1=easy, 2=medium, 3=hard
create table if not exists exam_questions (
  id             serial primary key,
  course_id      int not null references courses(id) on delete cascade,
  difficulty     int not null default 2 check (difficulty in (1, 2, 3)),
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
  created_at     timestamptz not null default now()
);

create index if not exists idx_exam_questions_course_difficulty
  on exam_questions(course_id, difficulty);

alter table exam_questions enable row level security;

-- Admin reads all; students never read directly (server-side selection only)
drop policy if exists "exam_questions_admin_all" on exam_questions;
create policy "exam_questions_admin_all" on exam_questions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ─── EXAM SESSIONS ──────────────────────────────────────────
-- One row per exam attempt per student per course
-- question_sequence: ordered array of question IDs selected so far
-- answers: { "question_id": "a"|"b"|"c"|"d" }
-- status: 'in_progress' | 'submitted'
-- session_type: 'course' (enrolled) | 'exam_only'
create table if not exists exam_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  course_id           int not null references courses(id) on delete cascade,
  session_type        text not null default 'course' check (session_type in ('course', 'exam_only')),
  status              text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  question_sequence   int[] not null default '{}',
  answers             jsonb not null default '{}',
  current_difficulty  int not null default 2 check (current_difficulty in (1, 2, 3)),
  questions_answered  int not null default 0,
  score               int,
  passed              boolean,
  started_at          timestamptz not null default now(),
  submitted_at        timestamptz
);

create index if not exists idx_exam_sessions_user_course
  on exam_sessions(user_id, course_id);
create index if not exists idx_exam_sessions_status
  on exam_sessions(user_id, course_id, status);

alter table exam_sessions enable row level security;

drop policy if exists "exam_sessions_own_read" on exam_sessions;
create policy "exam_sessions_own_read" on exam_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "exam_sessions_own_insert" on exam_sessions;
create policy "exam_sessions_own_insert" on exam_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "exam_sessions_own_update" on exam_sessions;
create policy "exam_sessions_own_update" on exam_sessions
  for update using (auth.uid() = user_id);

drop policy if exists "exam_sessions_admin_all" on exam_sessions;
create policy "exam_sessions_admin_all" on exam_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

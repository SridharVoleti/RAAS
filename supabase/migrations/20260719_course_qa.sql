-- Per-lesson Q&A: students ask questions on a lesson, any enrolled student can answer.
-- Deletion of inappropriate content is admin-only, done via the service-role client
-- in the app layer, so no delete RLS policy is needed here.

create table if not exists course_questions (
  id         serial primary key,
  course_id  int not null references courses(id) on delete cascade,
  lesson_id  int not null references lessons(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_questions_course_id on course_questions(course_id);
create index if not exists idx_course_questions_lesson_id on course_questions(lesson_id);

create table if not exists course_answers (
  id          serial primary key,
  question_id int not null references course_questions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_course_answers_question_id on course_answers(question_id);

alter table course_questions enable row level security;
alter table course_answers   enable row level security;

drop policy if exists "course_questions_authenticated_read" on course_questions;
create policy "course_questions_authenticated_read" on course_questions
  for select using (auth.role() = 'authenticated');

drop policy if exists "course_questions_own_insert" on course_questions;
create policy "course_questions_own_insert" on course_questions
  for insert with check (auth.uid() = user_id);

drop policy if exists "course_answers_authenticated_read" on course_answers;
create policy "course_answers_authenticated_read" on course_answers
  for select using (auth.role() = 'authenticated');

drop policy if exists "course_answers_own_insert" on course_answers;
create policy "course_answers_own_insert" on course_answers
  for insert with check (auth.uid() = user_id);

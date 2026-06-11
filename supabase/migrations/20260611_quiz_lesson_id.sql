-- ============================================================
-- Move quizzes from course-level to lesson-level keys
--
-- The live quiz_questions / quiz_submissions tables were created
-- with course_id only (older course-level quiz feature). The app
-- now keys quizzes by lesson_id, so those queries fail and any
-- previously added questions are invisible.
--
-- Run in Supabase SQL Editor (as postgres / service role).
-- Idempotent — safe to run more than once.
-- ============================================================

-- 1. Add lesson_id columns
alter table quiz_questions   add column if not exists lesson_id int references lessons(id) on delete cascade;
alter table quiz_submissions add column if not exists lesson_id int references lessons(id) on delete cascade;

-- 2. Backfill: attach existing course-level rows to the first lesson
--    of their course (admins can move questions to another lesson
--    from Admin → Course → Lessons → quiz panel afterwards)
update quiz_questions q
set lesson_id = (
  select l.id from lessons l
  where l.course_id = q.course_id
  order by l.order_index, l.id
  limit 1
)
where q.lesson_id is null and q.course_id is not null;

update quiz_submissions s
set lesson_id = (
  select l.id from lessons l
  where l.course_id = s.course_id
  order by l.order_index, l.id
  limit 1
)
where s.lesson_id is null and s.course_id is not null;

-- 3. New rows are inserted with lesson_id only — a NOT NULL course_id
--    would block them
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'quiz_questions' and column_name = 'course_id') then
    alter table quiz_questions alter column course_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name = 'quiz_submissions' and column_name = 'course_id') then
    alter table quiz_submissions alter column course_id drop not null;
  end if;
end $$;

-- 4. Indexes
create index if not exists idx_quiz_questions_lesson_id on quiz_questions(lesson_id);
create index if not exists idx_quiz_submissions_user_lesson on quiz_submissions(user_id, lesson_id);

-- ── Security hardening ──────────────────────────────────────────────────────

-- 1. OTP attempt tracking: lock a token after 5 wrong guesses
alter table otp_tokens
  add column if not exists attempts int not null default 0;

-- 2. quiz_questions: restrict direct DB reads to enrolled users only.
--    The API (service role) is unaffected; this only limits anon/user-key access.
drop policy if exists "quiz_questions_authenticated_read" on quiz_questions;

create policy "quiz_questions_enrolled_read" on quiz_questions
  for select using (
    exists (
      select 1 from enrollments e
      inner join lessons l on l.id = quiz_questions.lesson_id
      where e.user_id    = auth.uid()
        and e.course_id  = l.course_id
        and e.is_active  = true
    )
  );

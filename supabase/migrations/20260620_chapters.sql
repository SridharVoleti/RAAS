-- ============================================================
-- chapters: stable per-course scope for chapter-end quizzes
--
-- quiz_questions.chapter_id replaces lesson_id as the quiz scope.
-- lesson_id is made nullable so existing rows are preserved;
-- new chapter-scoped questions use chapter_id only.
--
-- Run in Supabase SQL Editor (as postgres / service role).
-- Idempotent — safe to run more than once.
-- ============================================================

-- ─── CHAPTERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapters (
  id          SERIAL PRIMARY KEY,
  course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_en    TEXT NOT NULL,
  title_te    TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapters_course_id ON chapters(course_id);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chapters_authenticated_read" ON chapters;
CREATE POLICY "chapters_authenticated_read" ON chapters
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "chapters_admin_all" ON chapters;
CREATE POLICY "chapters_admin_all" ON chapters
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── LESSONS: chapter assignment ─────────────────────────────
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS chapter_id INT REFERENCES chapters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_chapter_id ON lessons(chapter_id);

-- ─── QUIZ QUESTIONS: chapter scope ───────────────────────────
-- Drop NOT NULL on lesson_id so new chapter-scoped questions
-- can be inserted without a lesson_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_questions'
      AND column_name = 'lesson_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE quiz_questions ALTER COLUMN lesson_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS chapter_id INT REFERENCES chapters(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quiz_questions_chapter_id ON quiz_questions(chapter_id);

-- ─── QUIZ SUBMISSIONS: chapter scope ─────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_submissions'
      AND column_name = 'lesson_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE quiz_submissions ALTER COLUMN lesson_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS chapter_id INT REFERENCES chapters(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user_chapter ON quiz_submissions(user_id, chapter_id);

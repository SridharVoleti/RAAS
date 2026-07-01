-- Replace the chapter_id FK with a free-text chapter_name field.
-- This lets admins label exam questions with any chapter name without
-- requiring chapters to exist in the chapters table first.
ALTER TABLE exam_questions
  DROP COLUMN IF EXISTS chapter_id,
  ADD COLUMN IF NOT EXISTS chapter_name TEXT;

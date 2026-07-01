-- Add chapter_id to exam_questions so questions can be scoped per chapter.
-- Nullable: existing questions and questions without a chapter remain valid.
ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL;

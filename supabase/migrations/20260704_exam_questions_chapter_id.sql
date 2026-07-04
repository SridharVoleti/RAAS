-- Add chapter_id FK to exam_questions so questions link to course chapters
-- (chapter_name kept for the final-exam chapter-grouping flow)
ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_questions_chapter_id ON exam_questions(chapter_id);

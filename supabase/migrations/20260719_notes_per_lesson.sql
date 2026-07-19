-- Student notes move from one blob per course to one note per lesson (video).
ALTER TABLE user_notes ADD COLUMN IF NOT EXISTS lesson_id int REFERENCES lessons(id) ON DELETE CASCADE;

-- Best-effort migration of existing course-level notes: attach them to the first
-- lesson of their course (by order_index) so content isn't silently discarded.
UPDATE user_notes un
SET lesson_id = (
  SELECT l.id FROM lessons l WHERE l.course_id = un.course_id ORDER BY l.order_index ASC LIMIT 1
)
WHERE lesson_id IS NULL;

-- Rows whose course has no lessons at all have nothing to attach to.
DELETE FROM user_notes WHERE lesson_id IS NULL;

ALTER TABLE user_notes ALTER COLUMN lesson_id SET NOT NULL;
ALTER TABLE user_notes DROP CONSTRAINT IF EXISTS user_notes_pkey;
ALTER TABLE user_notes DROP COLUMN IF EXISTS course_id;
ALTER TABLE user_notes ADD PRIMARY KEY (user_id, lesson_id);

-- Prior-learning final test: re-key declarations by course_id, add exam session expiry
-- The original prior_learning_declarations (20260624) was keyed by category_key and
-- never wired into the app — safe to drop and recreate keyed by course_id.

DROP TABLE IF EXISTS prior_learning_declarations;

CREATE TABLE prior_learning_declarations (
  id             BIGSERIAL    PRIMARY KEY,
  user_id        UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id      INT          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  book_name      TEXT         NOT NULL,
  teacher_name   TEXT         NOT NULL,
  teacher_mobile TEXT         NOT NULL,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE prior_learning_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own declarations"
  ON prior_learning_declarations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own declarations"
  ON prior_learning_declarations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own declarations"
  ON prior_learning_declarations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all declarations"
  ON prior_learning_declarations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 100-minute timer for exam-only (prior-learning) sessions; NULL for regular course exams
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

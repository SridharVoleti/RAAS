-- Prior learning declarations — stores when a student has already studied a subject outside the platform
CREATE TABLE IF NOT EXISTS prior_learning_declarations (
  id             BIGSERIAL    PRIMARY KEY,
  user_id        UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key   TEXT         NOT NULL,
  book_name      TEXT         NOT NULL,
  teacher_name   TEXT         NOT NULL,
  teacher_mobile TEXT         NOT NULL,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, category_key)
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

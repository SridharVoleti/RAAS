-- Question bank for prior learning exams (keyed by category_key, not course_id)
CREATE TABLE IF NOT EXISTS prior_learning_exam_questions (
  id             BIGSERIAL   PRIMARY KEY,
  category_key   TEXT        NOT NULL,
  difficulty     SMALLINT    NOT NULL DEFAULT 2 CHECK (difficulty IN (1, 2, 3)),
  question_en    TEXT        NOT NULL,
  question_te    TEXT,
  option_a_en    TEXT        NOT NULL,
  option_a_te    TEXT,
  option_b_en    TEXT        NOT NULL,
  option_b_te    TEXT,
  option_c_en    TEXT        NOT NULL,
  option_c_te    TEXT,
  option_d_en    TEXT        NOT NULL,
  option_d_te    TEXT,
  correct_option TEXT        NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pleq_category ON prior_learning_exam_questions(category_key, is_active);

ALTER TABLE prior_learning_exam_questions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active questions (correct_option stripped at API layer)
CREATE POLICY "Auth users read active pl exam questions"
  ON prior_learning_exam_questions FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage pl exam questions"
  ON prior_learning_exam_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Exam sessions — question_ids pre-selected at start, answers accumulated per question
CREATE TABLE IF NOT EXISTS prior_learning_exam_sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key   TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'in_progress'
                             CHECK (status IN ('in_progress', 'submitted', 'expired')),
  question_ids   INTEGER[]   NOT NULL DEFAULT '{}',
  answers        JSONB       NOT NULL DEFAULT '{}',
  score          INTEGER,
  total          INTEGER,
  passed         BOOLEAN,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,          -- started_at + 1 hour
  submitted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ples_user_cat ON prior_learning_exam_sessions(user_id, category_key);

ALTER TABLE prior_learning_exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own pl exam sessions"
  ON prior_learning_exam_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pl exam sessions"
  ON prior_learning_exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all pl exam sessions"
  ON prior_learning_exam_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

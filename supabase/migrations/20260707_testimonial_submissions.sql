-- Student Voices submissions: track the submitting user and hide new
-- testimonials until an admin publishes them on the home page.

ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON testimonials(user_id);

-- New submissions default to hidden; admin toggles visibility
ALTER TABLE testimonials ALTER COLUMN is_published SET DEFAULT false;

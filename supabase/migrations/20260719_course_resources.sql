-- Per-course "Additional Resources" links (e.g. supplementary books), admin-managed
-- on the course edit page and shown to enrolled students on the watch page.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS resources jsonb NOT NULL DEFAULT '[]'::jsonb;

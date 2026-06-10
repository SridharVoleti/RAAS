-- Text widgets: admin-managed content blocks shown on the home page
CREATE TABLE IF NOT EXISTS text_widgets (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,                       -- admin label, not shown publicly
  content    TEXT NOT NULL,                       -- display text (supports plain text or simple HTML)
  position   TEXT NOT NULL DEFAULT 'announcement', -- 'announcement' | 'home-section'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE text_widgets ENABLE ROW LEVEL SECURITY;
-- Service role key (used by admin panel and server-side home data fetch) bypasses RLS entirely.
-- No explicit policies needed; anon/authenticated users have no direct access.

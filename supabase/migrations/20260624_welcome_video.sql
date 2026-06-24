-- Add welcome video URL to site_settings
INSERT INTO site_settings (key, value) VALUES
  ('welcome_video_url', '')
ON CONFLICT (key) DO NOTHING;

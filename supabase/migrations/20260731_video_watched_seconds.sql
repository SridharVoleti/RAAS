-- Tracks cumulative genuinely-watched seconds per lesson (not just last
-- position), so resuming a video after closing the app credits time already
-- watched instead of resetting the anti-skip counter to zero and wrongly
-- failing the "did you actually watch this" completion check.
alter table video_playback_progress add column if not exists watched_seconds int not null default 0;

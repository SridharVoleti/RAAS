-- Per-lesson playback position, so a student can resume a video where they
-- left off (and the watch page can default to the last lesson they viewed).
create table if not exists video_playback_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  course_id        int not null references courses(id) on delete cascade,
  lesson_id        int not null references lessons(id) on delete cascade,
  position_seconds int not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists idx_video_playback_progress_user_course
  on video_playback_progress(user_id, course_id);

drop trigger if exists video_playback_progress_updated_at on video_playback_progress;
create trigger video_playback_progress_updated_at
  before update on video_playback_progress
  for each row execute function set_updated_at();

alter table video_playback_progress enable row level security;

drop policy if exists "playback_progress_own_read" on video_playback_progress;
create policy "playback_progress_own_read" on video_playback_progress
  for select using (auth.uid() = user_id);

drop policy if exists "playback_progress_own_upsert" on video_playback_progress;
create policy "playback_progress_own_upsert" on video_playback_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "playback_progress_own_update" on video_playback_progress;
create policy "playback_progress_own_update" on video_playback_progress
  for update using (auth.uid() = user_id);

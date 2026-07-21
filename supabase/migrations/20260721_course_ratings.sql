-- ============================================================
-- Course ratings: one 5-star rating per student per completed course.
-- courses.rating / courses.review_count are kept as live aggregates
-- via trigger instead of being admin-set static values.
-- ============================================================

create table if not exists course_ratings (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  int  not null references courses(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists idx_course_ratings_course_id on course_ratings(course_id);

alter table course_ratings enable row level security;

drop policy if exists "course_ratings_own_read" on course_ratings;
create policy "course_ratings_own_read" on course_ratings
  for select using (auth.uid() = user_id);

drop policy if exists "course_ratings_own_insert" on course_ratings;
create policy "course_ratings_own_insert" on course_ratings
  for insert with check (auth.uid() = user_id);

drop policy if exists "course_ratings_own_update" on course_ratings;
create policy "course_ratings_own_update" on course_ratings
  for update using (auth.uid() = user_id);

-- Recompute the owning course's rating/review_count whenever a rating
-- row is inserted, updated, or deleted.
create or replace function sync_course_rating_aggregate() returns trigger as $$
declare
  affected_course_id int;
begin
  affected_course_id := coalesce(new.course_id, old.course_id);

  update courses set
    rating = coalesce((
      select round(avg(rating)::numeric, 1) from course_ratings where course_id = affected_course_id
    ), 0),
    review_count = (
      select count(*) from course_ratings where course_id = affected_course_id
    )
  where id = affected_course_id;

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_course_ratings_sync on course_ratings;
create trigger trg_course_ratings_sync
  after insert or update or delete on course_ratings
  for each row execute function sync_course_rating_aggregate();

-- Existing courses.rating values were an admin-set static placeholder (4.5
-- everywhere, review_count 0) rather than real data. Zero them out so the
-- column reflects "no ratings yet" until real course_ratings rows exist,
-- and stop defaulting new courses to a fake rating.
alter table courses alter column rating set default 0;
update courses set rating = 0 where review_count = 0;

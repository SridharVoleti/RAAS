-- Remove the admin-selectable course badge (Popular/New/Free/Coming Soon).
-- It's no longer captured or displayed anywhere in the app.

drop view if exists vw_my_courses;

alter table courses drop column if exists badge;

drop type if exists badge_type;

create or replace view vw_my_courses as
select
  e.user_id,
  c.id              as course_id,
  c.slug,
  c.emoji,
  c.bg_color,
  c.title_en,
  c.title_te,
  c.description_en,
  c.description_te,
  c.instructor_en,
  c.instructor_te,
  c.category,
  c.level::text     as level,
  c.duration,
  c.is_free,
  c.price,
  c.rating,
  c.review_count,
  c.student_count,
  c.has_quiz,
  c.order_index,
  c.is_published,
  e.enrolled_at,
  e.activated_at,
  e.is_active,
  -- Progress
  (select count(*) from lessons l where l.course_id = c.id)                          as total_lessons,
  (select count(*) from user_progress up
   where up.user_id = e.user_id and up.course_id = c.id)                             as completed_lessons,
  case
    when (select count(*) from lessons l where l.course_id = c.id) = 0 then 0
    else round(
      (select count(*) from user_progress up
       where up.user_id = e.user_id and up.course_id = c.id)::numeric
      / (select count(*) from lessons l where l.course_id = c.id)::numeric * 100
    )
  end                                                                                  as progress_pct
from enrollments e
join courses c on c.id = e.course_id
where e.is_active = true
  and c.is_published = true;

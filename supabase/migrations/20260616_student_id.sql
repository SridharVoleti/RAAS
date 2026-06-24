-- Student ID sequence and column
-- Every registered student gets a unique sequential number starting at 100001.

create sequence if not exists student_id_seq start 100001;

alter table profiles add column if not exists student_id bigint unique;

-- Assign student_id automatically on new profile insert
create or replace function assign_student_id()
returns trigger
language plpgsql
as $$
begin
  if new.student_id is null then
    new.student_id := nextval('student_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_student_id on profiles;
create trigger trg_assign_student_id
  before insert on profiles
  for each row
  execute function assign_student_id();

-- Backfill existing profiles in chronological order so older accounts get lower IDs
do $$
declare
  r record;
begin
  for r in select id from profiles where student_id is null order by created_at asc
  loop
    update profiles set student_id = nextval('student_id_seq') where id = r.id;
  end loop;
end;
$$;

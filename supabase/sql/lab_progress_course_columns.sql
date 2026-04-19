-- Run after lab_progress exists. Links step completions to a course lab for aggregate %.

alter table public.lab_progress
  add column if not exists course_id text,
  add column if not exists course_lab_id text;

create index if not exists lab_progress_course_user_idx
  on public.lab_progress (course_id, user_id)
  where course_id is not null;

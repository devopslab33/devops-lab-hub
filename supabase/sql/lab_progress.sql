-- Run in Supabase SQL Editor (or via migration).
-- Server uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).

create table if not exists public.lab_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_id text not null,
  step_id text not null,
  status text not null default 'passed',
  completed_at timestamptz not null default now(),
  constraint lab_progress_user_session_step unique (user_id, session_id, step_id)
);

create index if not exists lab_progress_session_id_idx on public.lab_progress (session_id);
create index if not exists lab_progress_user_id_idx on public.lab_progress (user_id);

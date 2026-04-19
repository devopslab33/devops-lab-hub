-- Run in Supabase SQL Editor. Server: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan text not null default 'free',
  status text not null default 'active',
  expires_at timestamptz,
  constraint subscriptions_user_id_key unique (user_id)
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

-- Styrkeloggen cloud sync
-- Run this once in Supabase Dashboard -> SQL Editor.
-- Each signed-in user can only read/write their own row.

create table if not exists public.training_logs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.training_logs enable row level security;

revoke all on table public.training_logs from anon;
grant select, insert, update, delete on table public.training_logs to authenticated;

drop policy if exists "Users manage their own training log" on public.training_logs;
create policy "Users manage their own training log"
on public.training_logs
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

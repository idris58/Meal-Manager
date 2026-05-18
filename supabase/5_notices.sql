create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists notices_user_expires_idx
  on public.notices(user_id, expires_at desc, created_at desc);

alter table public.notices enable row level security;

drop policy if exists "owner can manage notices" on public.notices;
create policy "owner can manage notices"
  on public.notices
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

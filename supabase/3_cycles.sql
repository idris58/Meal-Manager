create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  status text not null check (status in ('active', 'pending', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  finalized_at timestamptz,
  members_snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.cycles add column if not exists name text;

create index if not exists cycles_user_id_idx on public.cycles(user_id);
create unique index if not exists cycles_one_active_per_user_idx
  on public.cycles(user_id)
  where status = 'active';
create unique index if not exists cycles_one_pending_per_user_idx
  on public.cycles(user_id)
  where status = 'pending';

create table if not exists public.cycle_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cycle_deposits_user_id_idx on public.cycle_deposits(user_id);
create index if not exists cycle_deposits_cycle_id_idx on public.cycle_deposits(cycle_id);

alter table public.expenses add column if not exists cycle_id uuid references public.cycles(id) on delete cascade;
alter table public.meal_logs add column if not exists cycle_id uuid references public.cycles(id) on delete cascade;

alter table public.cycles enable row level security;
alter table public.cycle_deposits enable row level security;

drop policy if exists own_cycles on public.cycles;
create policy own_cycles
on public.cycles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists own_cycle_deposits on public.cycle_deposits;
create policy own_cycle_deposits
on public.cycle_deposits
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
declare
  user_record record;
  cycle_record record;
  active_cycle_id uuid;
  base_name text;
  candidate_name text;
  season_name text;
  suffix integer;
  cycle_year text;
begin
  for user_record in
    select user_id
    from public.cycles
    where user_id is not null
    union
    select user_id
    from public.members
    where user_id is not null
  loop
    select id
    into active_cycle_id
    from public.cycles
    where user_id = user_record.user_id
      and status = 'active'
    limit 1;

    if active_cycle_id is null then
      case extract(month from now())
        when 3 then season_name := 'Spring';
        when 4 then season_name := 'Spring';
        when 5 then season_name := 'Spring';
        when 6 then season_name := 'Summer';
        when 7 then season_name := 'Summer';
        when 8 then season_name := 'Summer';
        when 9 then season_name := 'Fall';
        when 10 then season_name := 'Fall';
        when 11 then season_name := 'Fall';
        else season_name := 'Winter';
      end case;

      cycle_year := to_char(now(), 'YY');
      base_name := 'Meal_' || season_name || '-' || cycle_year;
      candidate_name := base_name;
      suffix := 0;

      while exists (
        select 1
        from public.cycles
        where user_id = user_record.user_id
          and lower(name) = lower(candidate_name)
      ) loop
        suffix := suffix + 1;
        candidate_name := base_name || '_' || suffix;
      end loop;

      insert into public.cycles (user_id, name, status)
      values (user_record.user_id, candidate_name, 'active')
      returning id into active_cycle_id;
    end if;

    update public.expenses
    set cycle_id = active_cycle_id
    where user_id = user_record.user_id
      and cycle_id is null;

    update public.meal_logs
    set cycle_id = active_cycle_id
    where user_id = user_record.user_id
      and cycle_id is null;

    for cycle_record in
      select id, started_at
      from public.cycles
      where user_id = user_record.user_id
        and nullif(trim(name), '') is null
      order by started_at, created_at, id
    loop
      case extract(month from cycle_record.started_at)
        when 3 then season_name := 'Spring';
        when 4 then season_name := 'Spring';
        when 5 then season_name := 'Spring';
        when 6 then season_name := 'Summer';
        when 7 then season_name := 'Summer';
        when 8 then season_name := 'Summer';
        when 9 then season_name := 'Fall';
        when 10 then season_name := 'Fall';
        when 11 then season_name := 'Fall';
        else season_name := 'Winter';
      end case;

      cycle_year := to_char(cycle_record.started_at, 'YY');
      base_name := 'Meal_' || season_name || '-' || cycle_year;
      candidate_name := base_name;
      suffix := 0;

      while exists (
        select 1
        from public.cycles
        where user_id = user_record.user_id
          and id <> cycle_record.id
          and lower(name) = lower(candidate_name)
      ) loop
        suffix := suffix + 1;
        candidate_name := base_name || '_' || suffix;
      end loop;

      update public.cycles
      set name = candidate_name
      where id = cycle_record.id;
    end loop;
  end loop;
end $$;

alter table public.cycles alter column name set not null;

create unique index if not exists cycles_user_name_unique_idx
  on public.cycles(user_id, lower(name));

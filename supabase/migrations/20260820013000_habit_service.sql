create table if not exists public.pet_habits (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  kind text not null check (kind in ('walk','feeding','medication','grooming','training','custom')),
  title text not null check (length(trim(title)) between 1 and 120),
  cadence text not null default 'daily' check (cadence in ('daily','weekly')),
  target_per_period integer not null default 1 check (target_per_period between 1 and 12),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.pet_habits(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  request_fingerprint text not null check (length(request_fingerprint) = 64),
  completed_at timestamptz not null default now(),
  note text,
  source text not null default 'manual' check (source in ('manual','assistant','import')),
  created_at timestamptz not null default now(),
  unique (habit_id, idempotency_key)
);

create index if not exists pet_habits_pet_status_idx on public.pet_habits(pet_id, status, created_at);
create index if not exists habit_checkins_habit_completed_idx on public.habit_checkins(habit_id, completed_at desc);

alter table public.pet_habits enable row level security;
alter table public.habit_checkins enable row level security;

drop policy if exists "pet_habits owner" on public.pet_habits;
create policy "pet_habits owner" on public.pet_habits for all
  using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "habit_checkins owner" on public.habit_checkins;
create policy "habit_checkins owner" on public.habit_checkins for all
  using (exists (
    select 1 from public.pet_habits h join public.pets p on p.id = h.pet_id
    where h.id = habit_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.pet_habits h join public.pets p on p.id = h.pet_id
    where h.id = habit_id and p.owner_id = auth.uid()
  ));

drop trigger if exists pet_habits_touch_updated_at on public.pet_habits;
create trigger pet_habits_touch_updated_at before update on public.pet_habits
for each row execute function public.touch_updated_at();

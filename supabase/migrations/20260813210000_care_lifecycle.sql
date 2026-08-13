alter table public.pet_observations
  add column if not exists deleted_at timestamptz;

create index if not exists pet_observations_active_pet_observed_idx
  on public.pet_observations(pet_id, observed_at desc)
  where deleted_at is null;

create table if not exists public.care_mutations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  operation text not null,
  request_fingerprint text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

alter table public.care_mutations enable row level security;

drop policy if exists "care mutations owner" on public.care_mutations;
create policy "care mutations owner" on public.care_mutations for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop trigger if exists care_mutations_touch_updated_at on public.care_mutations;
create trigger care_mutations_touch_updated_at
  before update on public.care_mutations
  for each row execute function public.touch_updated_at();

alter table public.reminder_events
  add column if not exists idempotency_key text;

create unique index if not exists reminder_events_idempotent_operation_idx
  on public.reminder_events(reminder_id, event_type, idempotency_key)
  where idempotency_key is not null;

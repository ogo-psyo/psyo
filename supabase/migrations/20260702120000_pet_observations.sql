create table if not exists public.pet_observations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check (type in (
    'mood',
    'energy',
    'appetite',
    'stool',
    'sleep',
    'weight',
    'activity',
    'fear_trigger',
    'dog_reaction',
    'people_reaction',
    'walk',
    'training',
    'medication',
    'procedure',
    'symptom',
    'behavior_change',
    'note'
  )),
  value text not null,
  note text,
  observed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'assistant', 'import', 'demo')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pet_observations_pet_observed_idx on public.pet_observations(pet_id, observed_at desc);
create index if not exists pet_observations_pet_type_observed_idx on public.pet_observations(pet_id, type, observed_at desc);

alter table public.pet_observations enable row level security;

drop policy if exists "observations owner" on public.pet_observations;
create policy "observations owner" on public.pet_observations for all
using (exists (
  select 1 from public.pets p
  where p.id = pet_id and p.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.pets p
  where p.id = pet_id and p.owner_id = auth.uid()
));

drop trigger if exists observations_touch_updated_at on public.pet_observations;
create trigger observations_touch_updated_at
  before update on public.pet_observations
  for each row execute function public.touch_updated_at();

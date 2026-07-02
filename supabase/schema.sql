-- Псё MVP backend schema
-- Run in Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_identities (
  psyo_user_id text primary key,
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text not null default 'dog' check (species = 'dog'),
  breed_id text,
  breed_group_id text,
  custom_breed text,
  sex text,
  life_stage text,
  weight_kg numeric,
  avatar_url text,
  photo_urls text[] not null default '{}',
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_passports (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  microchip text,
  vet_clinic text,
  vet_contact text,
  diet text,
  allergies text,
  medication text,
  health_notes text,
  vaccine_status text check (vaccine_status in ('actual','due_soon','overdue','unknown')),
  parasite_status text check (parasite_status in ('actual','needs_reminder','overdue','unknown')),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_profiles (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  social_mode text check (social_mode in ('ok','ask_first','calm_dogs_only','do_not_approach','known_only')),
  temperament text,
  energy_level text,
  play_style text,
  trainability text,
  child_friendly text check (child_friendly in ('yes','careful','no','unknown')),
  dog_friendly text check (dog_friendly in ('yes','careful','no','unknown')),
  cat_friendly text check (cat_friendly in ('yes','careful','no','unknown')),
  triggers text[] not null default '{}',
  alone_time_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check (type in ('vaccine','parasite','medication','grooming','food','training','vet','custom')),
  title text not null,
  due_at timestamptz not null,
  recurrence text default 'none' check (recurrence in ('none','daily','weekly','monthly','quarterly','yearly')),
  status text not null default 'active' check (status in ('active','done','snoozed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_zones (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check (type in ('home_area','walk_route','safe_place','risk_zone','clinic','shop','grooming')),
  title text not null,
  approximate_lat numeric,
  approximate_lng numeric,
  radius_meters integer,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  title text not null,
  category text not null default 'other' check (category in ('food','treats','toy','gear','health','grooming','course','service','other')),
  reason text,
  url text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'wanted' check (status in ('wanted','bought','not_suitable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_observations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check (type in ('mood','energy','appetite','stool','sleep','weight','activity','fear_trigger','dog_reaction','people_reaction','walk','training','medication','procedure','symptom','behavior_change','note')),
  value text not null,
  note text,
  observed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','assistant','import','demo')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  kind text not null check (kind in ('training','care','health_triage','shopping','travel','general')),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.telegram_identities enable row level security;
alter table public.pets enable row level security;
alter table public.pet_passports enable row level security;
alter table public.social_profiles enable row level security;
alter table public.reminders enable row level security;
alter table public.map_zones enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.pet_observations enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;

create policy "profiles owner" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "pets owner" on public.pets for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "passports owner" on public.pet_passports for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "social owner" on public.social_profiles for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "reminders owner" on public.reminders for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "zones owner" on public.map_zones for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "wishlist owner" on public.wishlist_items for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "observations owner" on public.pet_observations for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "threads owner" on public.assistant_threads for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
create policy "messages owner" on public.assistant_messages for all using (exists (select 1 from public.assistant_threads t join public.pets p on p.id = t.pet_id where t.id = thread_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.assistant_threads t join public.pets p on p.id = t.pet_id where t.id = thread_id and p.owner_id = auth.uid()));

create index if not exists pet_observations_pet_observed_idx on public.pet_observations(pet_id, observed_at desc);
create index if not exists pet_observations_pet_type_observed_idx on public.pet_observations(pet_id, type, observed_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pets_touch_updated_at on public.pets;
create trigger pets_touch_updated_at before update on public.pets for each row execute function public.touch_updated_at();
drop trigger if exists telegram_identities_touch_updated_at on public.telegram_identities;
create trigger telegram_identities_touch_updated_at before update on public.telegram_identities for each row execute function public.touch_updated_at();
drop trigger if exists reminders_touch_updated_at on public.reminders;
create trigger reminders_touch_updated_at before update on public.reminders for each row execute function public.touch_updated_at();
drop trigger if exists wishlist_touch_updated_at on public.wishlist_items;
create trigger wishlist_touch_updated_at before update on public.wishlist_items for each row execute function public.touch_updated_at();
drop trigger if exists observations_touch_updated_at on public.pet_observations;
create trigger observations_touch_updated_at before update on public.pet_observations for each row execute function public.touch_updated_at();

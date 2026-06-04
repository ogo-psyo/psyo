-- Псё Top App preparation schema draft
-- Safe intent: additive tables only. Review before applying.

create extension if not exists "pgcrypto";

create table if not exists public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  local_key_hash text unique,
  migrated_to_user_id uuid references auth.users(id) on delete set null,
  migrated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.avatar_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  guest_profile_id uuid references public.guest_profiles(id) on delete set null,
  pet_id uuid references public.pets(id) on delete cascade,
  style_id text not null,
  status text not null default 'queued' check (status in ('queued','validating','generating','postprocessing','ready','failed_input','failed_moderation','failed_provider','failed_timeout','fallback_ready')),
  provider text,
  failure_reason text,
  cost_cents integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.avatar_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.avatar_jobs(id) on delete set null,
  owner_id uuid references auth.users(id) on delete cascade,
  guest_profile_id uuid references public.guest_profiles(id) on delete set null,
  pet_id uuid references public.pets(id) on delete cascade,
  asset_type text not null check (asset_type in ('reference_photo','avatar_image','hero_card_png','thumbnail')),
  style_id text,
  storage_bucket text,
  storage_path text,
  public_url text,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','not_required')),
  visibility text not null default 'private' check (visibility in ('private','signed','public')),
  created_at timestamptz not null default now()
);

create table if not exists public.dog_cards (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade,
  guest_profile_id uuid references public.guest_profiles(id) on delete set null,
  avatar_asset_id uuid references public.avatar_assets(id) on delete set null,
  title text not null,
  subtitle text,
  traits text[] not null default '{}',
  style_id text,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('park','safe_walk','risk_zone','clinic','emergency_clinic','vet_pharmacy','pet_shop','grooming','training','pet_friendly_place')),
  title text not null,
  address text,
  phone text,
  website text,
  approximate_lat numeric,
  approximate_lng numeric,
  trust_level text not null default 'open_source' check (trust_level in ('open_source','manual_checked','profile_expanded','user_reviewed','curated_recommended','partner')),
  partner_status text not null default 'none' check (partner_status in ('none','partner','sponsored')),
  tags text[] not null default '{}',
  source_note text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  report_type text not null,
  note text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.dog_friendships (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  friend_pet_id uuid references public.pets(id) on delete cascade,
  invite_token text unique,
  status text not null default 'invited' check (status in ('invited','accepted','blocked','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete cascade,
  partner_type text not null check (partner_type in ('clinic','shop','grooming','training','service','affiliate')),
  disclosure text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partner_profiles(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  event_name text not null,
  category text,
  sponsored_bool boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  guest_profile_id uuid references public.guest_profiles(id) on delete cascade,
  platform text not null check (platform in ('web','ios','android')),
  token text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform, token)
);

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'new' check (status in ('new','reviewing','resolved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.guest_profiles enable row level security;
alter table public.avatar_jobs enable row level security;
alter table public.avatar_assets enable row level security;
alter table public.dog_cards enable row level security;
alter table public.places enable row level security;
alter table public.place_reports enable row level security;
alter table public.dog_friendships enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.affiliate_events enable row level security;
alter table public.push_devices enable row level security;
alter table public.moderation_reports enable row level security;

-- Public places are readable; writes should be service/admin only initially.
drop policy if exists "places public read" on public.places;
create policy "places public read" on public.places for select using (true);

-- Owner policies for authenticated rows. Guest rows are not directly trusted via RLS until migration design is finalized.
drop policy if exists "avatar jobs owner" on public.avatar_jobs;
create policy "avatar jobs owner" on public.avatar_jobs for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "avatar assets owner" on public.avatar_assets;
create policy "avatar assets owner" on public.avatar_assets for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "dog cards owner" on public.dog_cards;
create policy "dog cards owner" on public.dog_cards for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "dog cards public read" on public.dog_cards;
create policy "dog cards public read" on public.dog_cards for select using (visibility in ('unlisted','public'));

drop policy if exists "place reports owner insert" on public.place_reports;
create policy "place reports owner insert" on public.place_reports for insert with check (auth.uid() = owner_id);

drop policy if exists "friendships owner" on public.dog_friendships;
create policy "friendships owner" on public.dog_friendships for all using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "push devices owner" on public.push_devices;
create policy "push devices owner" on public.push_devices for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

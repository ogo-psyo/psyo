create table if not exists public.dog_cards (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  title text not null,
  subtitle text,
  traits text[] not null default '{}',
  style_id text,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  public_slug text unique,
  fields jsonb not null default '{}',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dog_cards add column if not exists fields jsonb not null default '{}';
alter table public.dog_cards add column if not exists revoked_at timestamptz;
update public.dog_cards
set public_slug = 'dog-card-' || substring(id::text from 1 for 8)
where public_slug is null;
alter table public.dog_cards alter column public_slug set not null;
create unique index if not exists dog_cards_public_slug_key on public.dog_cards(public_slug);

alter table public.dog_cards enable row level security;

drop policy if exists "dog cards owner" on public.dog_cards;
create policy "dog cards owner" on public.dog_cards
  for all
  using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "dog cards public read" on public.dog_cards;

drop trigger if exists dog_cards_touch_updated_at on public.dog_cards;
create trigger dog_cards_touch_updated_at
  before update on public.dog_cards
  for each row execute function public.touch_updated_at();

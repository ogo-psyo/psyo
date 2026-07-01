create table if not exists public.telegram_identities (
  psyo_user_id text primary key,
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_identities enable row level security;

drop trigger if exists telegram_identities_touch_updated_at on public.telegram_identities;
create trigger telegram_identities_touch_updated_at
before update on public.telegram_identities
for each row execute function public.touch_updated_at();

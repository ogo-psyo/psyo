-- Phase 8 entitlement foundation.
-- Additive only: billing remains disabled unless release gates enable it.

create table if not exists public.subscriptions (
  user_id uuid references auth.users(id) on delete cascade primary key,
  tier text not null default 'free' check (tier in ('free','plus')),
  status text not null default 'inactive' check (status in ('active','inactive','cancelled')),
  provider text,
  provider_charge_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status);
create unique index if not exists subscriptions_provider_charge_uidx
  on public.subscriptions(provider, provider_charge_id)
  where provider is not null and provider_charge_id is not null;

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage subscriptions" on public.subscriptions;
create policy "Service role can manage subscriptions" on public.subscriptions
  for all using (auth.role() = 'service_role');

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

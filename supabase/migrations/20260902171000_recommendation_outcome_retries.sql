create table if not exists public.recommendation_outcome_failures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  outcome_key text not null check (char_length(outcome_key) between 8 and 128),
  recommendation_id text not null check (char_length(trim(recommendation_id)) between 1 and 160),
  domain_type text not null check (domain_type in ('reminder','habit','route','wishlist')),
  domain_id text not null check (char_length(trim(domain_id)) between 1 and 160),
  result text not null check (result in ('completed','failed')),
  occurred_at timestamptz not null,
  error_code text not null check (char_length(trim(error_code)) between 1 and 80),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, outcome_key)
);

create index if not exists recommendation_outcome_failures_retry_idx
  on public.recommendation_outcome_failures(next_retry_at, created_at)
  where attempt_count < 10;

drop trigger if exists recommendation_outcome_failures_touch_updated_at on public.recommendation_outcome_failures;
create trigger recommendation_outcome_failures_touch_updated_at
before update on public.recommendation_outcome_failures
for each row execute function public.touch_updated_at();

alter table public.recommendation_outcome_failures enable row level security;
revoke all on public.recommendation_outcome_failures from anon, authenticated;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.pets add column if not exists is_public boolean not null default false;
alter table public.reminders add column if not exists completed_at timestamptz;
alter table public.reminders add column if not exists snoozed_until timestamptz;
alter table public.reminders add column if not exists next_due_at timestamptz;
alter table public.reminders add column if not exists metadata jsonb not null default '{}';
alter table public.reminders add column if not exists last_notified_at timestamptz;
alter table public.map_zones add column if not exists visibility text not null default 'private' check (visibility in ('private','shared','public'));
alter table public.map_zones add column if not exists is_active boolean not null default true;
alter table public.map_zones add column if not exists updated_at timestamptz not null default now();
alter table public.assistant_messages add column if not exists metadata jsonb not null default '{}';
alter table public.assistant_messages add column if not exists tokens_in integer;
alter table public.assistant_messages add column if not exists tokens_out integer;
alter table public.assistant_messages add column if not exists model text;

create index if not exists pets_owner_created_idx on public.pets(owner_id, created_at);
create index if not exists reminders_pet_due_idx on public.reminders(pet_id, due_at);
create index if not exists reminders_status_due_idx on public.reminders(status, due_at);

create table if not exists public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  event_type text not null check (event_type in ('created','completed','snoozed','notified','rescheduled','updated','deleted')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.reminder_events enable row level security;

drop policy if exists "reminder events owner" on public.reminder_events;
create policy "reminder events owner" on public.reminder_events for all
using (exists (
  select 1 from public.reminders r join public.pets p on p.id = r.pet_id
  where r.id = reminder_id and p.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.reminders r join public.pets p on p.id = r.pet_id
  where r.id = reminder_id and p.owner_id = auth.uid()
));

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists passports_touch_updated_at on public.pet_passports;
create trigger passports_touch_updated_at before update on public.pet_passports for each row execute function public.touch_updated_at();
drop trigger if exists social_touch_updated_at on public.social_profiles;
create trigger social_touch_updated_at before update on public.social_profiles for each row execute function public.touch_updated_at();
drop trigger if exists zones_touch_updated_at on public.map_zones;
create trigger zones_touch_updated_at before update on public.map_zones for each row execute function public.touch_updated_at();
drop trigger if exists threads_touch_updated_at on public.assistant_threads;
create trigger threads_touch_updated_at before update on public.assistant_threads for each row execute function public.touch_updated_at();

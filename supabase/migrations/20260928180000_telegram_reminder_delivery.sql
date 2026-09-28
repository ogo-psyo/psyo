begin;

-- Telegram chat identifiers are delivery addresses, not product data. They are
-- stored only as application-encrypted ciphertext and remain service-role only.
create table if not exists public.telegram_delivery_targets (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  chat_id_ciphertext text not null,
  time_zone text not null default 'Europe/Moscow' check (length(time_zone) between 1 and 64),
  enabled boolean not null default true,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_delivery_targets enable row level security;

drop trigger if exists telegram_delivery_targets_touch_updated_at on public.telegram_delivery_targets;
create trigger telegram_delivery_targets_touch_updated_at
before update on public.telegram_delivery_targets
for each row execute function public.touch_updated_at();

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  occurrence_due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  sent_at timestamptz,
  telegram_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reminder_id, occurrence_due_at)
);

alter table public.reminder_deliveries enable row level security;

create index if not exists reminder_deliveries_owner_status_idx
  on public.reminder_deliveries(owner_id, status, updated_at desc);

drop trigger if exists reminder_deliveries_touch_updated_at on public.reminder_deliveries;
create trigger reminder_deliveries_touch_updated_at
before update on public.reminder_deliveries
for each row execute function public.touch_updated_at();

create or replace function public.claim_telegram_reminder_delivery(
  p_reminder_id uuid,
  p_occurrence_due_at timestamptz,
  p_now timestamptz default pg_catalog.now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reminder public.reminders%rowtype;
  v_owner uuid;
  v_effective_due timestamptz;
  v_scheduled_for timestamptz;
  v_delivery public.reminder_deliveries%rowtype;
begin
  select r.* into v_reminder
  from public.reminders r
  join public.pets p on p.id = r.pet_id
  join public.telegram_delivery_targets t on t.owner_id = p.owner_id and t.enabled = true
  where r.id = p_reminder_id
  for update of r;
  if not found then return null; end if;
  select p.owner_id into v_owner from public.pets p where p.id = v_reminder.pet_id;

  if v_reminder.status not in ('active','snoozed')
     or coalesce(v_reminder.metadata->>'reminderPreference','off') = 'off' then
    return null;
  end if;
  v_effective_due := coalesce(v_reminder.snoozed_until, v_reminder.due_at);
  if abs(extract(epoch from (v_effective_due - p_occurrence_due_at))) > 1 then return null; end if;
  v_scheduled_for := case v_reminder.metadata->>'reminderPreference'
    when 'before' then v_effective_due - interval '1 day'
    else v_effective_due
  end;
  if v_scheduled_for > p_now + interval '1 minute' then return null; end if;

  insert into public.reminder_deliveries(reminder_id, owner_id, occurrence_due_at)
  values (p_reminder_id, v_owner, v_effective_due)
  on conflict (reminder_id, occurrence_due_at) do nothing;

  select * into v_delivery from public.reminder_deliveries
  where reminder_id = p_reminder_id and occurrence_due_at = v_effective_due
  for update;
  if v_delivery.status in ('sent','cancelled') then return null; end if;
  if v_delivery.status = 'sending' and v_delivery.locked_at > p_now - interval '10 minutes' then return null; end if;
  if v_delivery.attempts >= 4 then return null; end if;

  update public.reminder_deliveries set
    status = 'sending', attempts = attempts + 1, locked_at = p_now,
    last_error_code = null, updated_at = p_now
  where id = v_delivery.id;
  return v_delivery.id;
end;
$$;

create or replace function public.finish_telegram_reminder_delivery(
  p_delivery_id uuid,
  p_telegram_message_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_delivery public.reminder_deliveries%rowtype;
begin
  select * into v_delivery from public.reminder_deliveries where id = p_delivery_id for update;
  if not found then return false; end if;
  if v_delivery.status = 'sent' then return true; end if;
  if v_delivery.status <> 'sending' then return false; end if;
  update public.reminder_deliveries set
    status = 'sent', sent_at = pg_catalog.now(), locked_at = null,
    telegram_message_id = p_telegram_message_id, updated_at = pg_catalog.now()
  where id = p_delivery_id;
  update public.reminders set last_notified_at = pg_catalog.now()
  where id = v_delivery.reminder_id;
  insert into public.reminder_events(reminder_id,event_type,idempotency_key,payload)
  values(v_delivery.reminder_id,'notified','telegram:'||v_delivery.id::text,
    jsonb_build_object('deliveryId',v_delivery.id,'occurrenceDueAt',v_delivery.occurrence_due_at))
  on conflict (reminder_id,event_type,idempotency_key) where idempotency_key is not null do nothing;
  return true;
end;
$$;

create or replace function public.fail_telegram_reminder_delivery(
  p_delivery_id uuid,
  p_error_code text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reminder_deliveries set
    status = 'failed', locked_at = null,
    last_error_code = left(coalesce(p_error_code,'SEND_FAILED'),80),
    updated_at = pg_catalog.now()
  where id = p_delivery_id and status = 'sending';
  return found;
end;
$$;

revoke all on table public.telegram_delivery_targets from public, anon, authenticated;
revoke all on table public.reminder_deliveries from public, anon, authenticated;
revoke all on function public.claim_telegram_reminder_delivery(uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.finish_telegram_reminder_delivery(uuid,text) from public,anon,authenticated;
revoke all on function public.fail_telegram_reminder_delivery(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_telegram_reminder_delivery(uuid,timestamptz,timestamptz) to service_role;
grant execute on function public.finish_telegram_reminder_delivery(uuid,text) to service_role;
grant execute on function public.fail_telegram_reminder_delivery(uuid,text) to service_role;

commit;

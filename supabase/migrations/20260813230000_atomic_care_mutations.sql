create or replace function public.care_claim_mutation_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_operation text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mutation public.care_mutations%rowtype;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_request_fingerprint is null or length(p_request_fingerprint) <> 64 then
    raise exception 'INVALID_REQUEST_FINGERPRINT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0)
  );

  select * into v_mutation
  from public.care_mutations
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_mutation.operation <> p_operation
      or v_mutation.request_fingerprint <> p_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if v_mutation.response is not null then
      return v_mutation.response;
    end if;
    -- A null response can only be left by the retired non-atomic protocol.
    delete from public.care_mutations where id = v_mutation.id;
  end if;

  insert into public.care_mutations (
    owner_id, idempotency_key, operation, request_fingerprint, response
  ) values (
    p_owner_id, p_idempotency_key, p_operation, p_request_fingerprint, null
  );
  return null;
end;
$$;

create or replace function public.care_finish_mutation_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_response jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.care_mutations
  set response = p_response, updated_at = pg_catalog.now()
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;
  if not found then raise exception 'CARE_MUTATION_NOT_CLAIMED'; end if;
  return p_response;
end;
$$;

create or replace function public.care_owned_reminder_atomic(p_owner_id uuid, p_reminder_id uuid)
returns public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare v_reminder public.reminders%rowtype;
begin
  select r.* into v_reminder
  from public.reminders r
  join public.pets p on p.id = r.pet_id
  where r.id = p_reminder_id and p.owner_id = p_owner_id
  for update of r;
  if not found then raise exception 'REMINDER_NOT_FOUND'; end if;
  return v_reminder;
end;
$$;

create or replace function public.care_next_due_at_atomic(
  p_due_at timestamptz,
  p_recurrence text
) returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_due timestamp := p_due_at at time zone 'UTC';
  v_months integer;
  v_month_start timestamp;
  v_last_day integer;
begin
  if p_recurrence = 'none' then return null; end if;
  if p_recurrence = 'daily' then return p_due_at + interval '1 day'; end if;
  if p_recurrence = 'weekly' then return p_due_at + interval '7 days'; end if;
  v_months := case p_recurrence when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 else null end;
  if v_months is null then raise exception 'INVALID_RECURRENCE'; end if;
  v_month_start := date_trunc('month', v_due) + make_interval(months => v_months);
  v_last_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;
  return (
    v_month_start
    + make_interval(days => least(extract(day from v_due)::integer, v_last_day) - 1)
    + (v_due - date_trunc('day', v_due))
  ) at time zone 'UTC';
end;
$$;

create or replace function public.care_create_reminder_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_pet_id uuid,
  p_type text,
  p_title text,
  p_due_at timestamptz,
  p_recurrence text,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_reminder public.reminders%rowtype;
  v_response jsonb;
begin
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:create', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id) then
    raise exception 'PET_NOT_FOUND';
  end if;
  insert into public.reminders (pet_id, type, title, due_at, recurrence, status, metadata)
  values (p_pet_id, p_type, p_title, p_due_at, p_recurrence, 'active', jsonb_build_object('source', p_source))
  returning * into v_reminder;
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (v_reminder.id, 'created', p_idempotency_key, jsonb_build_object('source', p_source));
  v_response := jsonb_build_object(
    'reminder', jsonb_build_object(
      'id', v_reminder.id, 'petId', v_reminder.pet_id, 'type', v_reminder.type,
      'title', v_reminder.title, 'dueAt', v_reminder.due_at,
      'recurrence', v_reminder.recurrence, 'status', v_reminder.status,
      'completedAt', v_reminder.completed_at, 'snoozedUntil', v_reminder.snoozed_until,
      'nextDueAt', v_reminder.next_due_at
    ),
    'mode', 'user'
  );
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

create or replace function public.care_update_reminder_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_reminder_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_current public.reminders%rowtype;
  v_updated public.reminders%rowtype;
  v_response jsonb;
begin
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:update', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  update public.reminders set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    due_at = case when p_patch ? 'due_at' then (p_patch->>'due_at')::timestamptz else due_at end,
    type = case when p_patch ? 'type' then p_patch->>'type' else type end,
    recurrence = case when p_patch ? 'recurrence' then p_patch->>'recurrence' else recurrence end,
    updated_at = pg_catalog.now()
  where id = p_reminder_id returning * into v_updated;
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (p_reminder_id, 'updated', p_idempotency_key, p_patch);
  v_response := jsonb_build_object('reminder', to_jsonb(v_updated));
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

create or replace function public.care_delete_reminder_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_reminder_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_current public.reminders%rowtype;
  v_response jsonb := jsonb_build_object('ok', true);
begin
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:delete', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (p_reminder_id, 'deleted', p_idempotency_key, '{}'::jsonb);
  delete from public.reminders where id = p_reminder_id;
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

create or replace function public.care_complete_reminder_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_reminder_id uuid,
  p_completed_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_current public.reminders%rowtype;
  v_updated public.reminders%rowtype;
  v_completed_at timestamptz := coalesce(p_completed_at, pg_catalog.now());
  v_occurrence_due_at timestamptz;
  v_next_due_at timestamptz;
  v_response jsonb;
begin
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:complete', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  v_occurrence_due_at := v_current.due_at;
  v_next_due_at := public.care_next_due_at_atomic(v_current.due_at, coalesce(v_current.recurrence, 'none'));
  update public.reminders set
    status = case when v_next_due_at is null then 'done' else 'active' end,
    due_at = coalesce(v_next_due_at, v_current.due_at),
    completed_at = case when v_next_due_at is null then v_completed_at else null end,
    snoozed_until = null,
    next_due_at = v_next_due_at,
    updated_at = pg_catalog.now()
  where id = p_reminder_id returning * into v_updated;
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (
    p_reminder_id, 'completed', p_idempotency_key,
    jsonb_build_object(
      'reminderId', p_reminder_id, 'dueAt', v_occurrence_due_at,
      'completedAt', v_completed_at, 'nextDueAt', v_next_due_at
    )
  );
  v_response := jsonb_build_object(
    'reminder', to_jsonb(v_updated),
    'historyOccurrence', jsonb_build_object(
      'reminderId', p_reminder_id, 'dueAt', v_occurrence_due_at, 'completedAt', v_completed_at
    ),
    'nextOccurrence', case when v_next_due_at is null then null else jsonb_build_object('dueAt', v_next_due_at) end
  );
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

create or replace function public.care_snooze_reminder_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_reminder_id uuid,
  p_snoozed_until timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_current public.reminders%rowtype;
  v_updated public.reminders%rowtype;
  v_until timestamptz := coalesce(p_snoozed_until, pg_catalog.now() + interval '1 day');
  v_response jsonb;
begin
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:snooze', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  update public.reminders
  set status = 'snoozed', snoozed_until = v_until, updated_at = pg_catalog.now()
  where id = p_reminder_id returning * into v_updated;
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (p_reminder_id, 'snoozed', p_idempotency_key, jsonb_build_object('snoozedUntil', v_until));
  v_response := jsonb_build_object('reminder', to_jsonb(v_updated));
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

revoke all on function public.care_claim_mutation_atomic(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.care_finish_mutation_atomic(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.care_owned_reminder_atomic(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_next_due_at_atomic(timestamptz, text) from public, anon, authenticated;
revoke all on function public.care_create_reminder_atomic(uuid, text, text, uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.care_update_reminder_atomic(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.care_delete_reminder_atomic(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.care_complete_reminder_atomic(uuid, text, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.care_snooze_reminder_atomic(uuid, text, text, uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.care_create_reminder_atomic(uuid, text, text, uuid, text, text, timestamptz, text, text) to service_role;
grant execute on function public.care_update_reminder_atomic(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.care_delete_reminder_atomic(uuid, text, text, uuid) to service_role;
grant execute on function public.care_complete_reminder_atomic(uuid, text, text, uuid, timestamptz) to service_role;
grant execute on function public.care_snooze_reminder_atomic(uuid, text, text, uuid, timestamptz) to service_role;

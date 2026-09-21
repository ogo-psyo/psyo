begin;
-- Additive metadata only; no existing reminders are rewritten. Same owner/ledger protections.
create or replace function public.care_validate_details(p jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p)<>'object' or (p-'careDomain'-'note'-'recurrenceBasis'-'reminderPreference')<>'{}'::jsonb then raise exception 'INVALID_FIELDS';end if;
 if p ? 'careDomain' and p->'careDomain'<>'null'::jsonb and (jsonb_typeof(p->'careDomain')<>'string' or p->>'careDomain' not in ('health','activity','food','care','behavior')) then raise exception 'INVALID_FIELDS';end if;
 if p ? 'note' and (jsonb_typeof(p->'note')<>'string' or length(p->>'note')>2000) then raise exception 'INVALID_FIELDS';end if;
 if p ? 'recurrenceBasis' and (jsonb_typeof(p->'recurrenceBasis')<>'string' or p->>'recurrenceBasis' not in ('planned','completed')) then raise exception 'INVALID_FIELDS';end if;
 if p ? 'reminderPreference' and (jsonb_typeof(p->'reminderPreference')<>'string' or p->>'reminderPreference' not in ('off','day','before')) then raise exception 'INVALID_FIELDS';end if;
end $$;
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
  if p_patch ? 'time_mode' and (p_patch->>'time_mode' is null or p_patch->>'time_mode' not in ('exact','flexible','approximate')) then raise exception 'INVALID_TIME_MODE';end if;
  if p_patch ? 'care_details' then perform public.care_validate_details(p_patch->'care_details');end if;
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:update', p_request_fingerprint);
  if v_replay is not null then perform public.care_owned_reminder_atomic(p_owner_id,p_reminder_id);return v_replay;end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  update public.reminders set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    due_at = case when p_patch ? 'due_at' then (p_patch->>'due_at')::timestamptz else due_at end,
    type = case when p_patch ? 'type' then p_patch->>'type' else type end,
    recurrence = case when p_patch ? 'recurrence' then p_patch->>'recurrence' else recurrence end,
    metadata = (case when p_patch ? 'time_mode' then coalesce(metadata,'{}'::jsonb)||jsonb_build_object('timeMode',p_patch->>'time_mode') else coalesce(metadata,'{}'::jsonb) end) || coalesce(p_patch->'care_details','{}'::jsonb),
    snoozed_until = case when p_patch ? 'due_at' then null else snoozed_until end,
    next_due_at = case when p_patch ? 'due_at' or p_patch ? 'recurrence' then null else next_due_at end,
    status = case when p_patch ? 'due_at' and status='snoozed' then 'active' else status end,
    updated_at = pg_catalog.now()
  where id = p_reminder_id returning * into v_updated;
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (p_reminder_id, 'updated', p_idempotency_key, p_patch);
  v_response := jsonb_build_object('reminder', to_jsonb(v_updated));
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

-- Completion undo is conditional on the exact still-current occurrence.
-- Later edits/completions are never overwritten. Audit events remain retained.
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
  v_wishlist_before public.wishlist_items%rowtype;
  v_wishlist_after public.wishlist_items%rowtype;
begin
  if v_completed_at > pg_catalog.now()+interval '1 minute' then raise exception 'INVALID_DATE';end if;
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:complete', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  if v_current.status = 'done' then raise exception 'REMINDER_ALREADY_DONE'; end if;
  select * into v_wishlist_before from public.wishlist_items where reminder_id=p_reminder_id for update;
  v_occurrence_due_at := v_current.due_at;
  v_next_due_at := public.care_next_due_at_atomic(case when v_current.metadata->>'recurrenceBasis'='completed' then v_completed_at else v_current.due_at end, coalesce(v_current.recurrence, 'none'));
  update public.reminders set
    status = case when v_next_due_at is null then 'done' else 'active' end,
    due_at = coalesce(v_next_due_at, v_current.due_at),
    completed_at = case when v_next_due_at is null then v_completed_at else null end,
    snoozed_until = null,
    next_due_at = v_next_due_at,
    updated_at = pg_catalog.now()
  where id = p_reminder_id returning * into v_updated;
  select * into v_wishlist_after from public.wishlist_items where reminder_id=p_reminder_id;
  insert into public.reminder_events (reminder_id, event_type, idempotency_key, payload)
  values (
    p_reminder_id, 'completed', p_idempotency_key,
    jsonb_build_object(
      'reminderId', p_reminder_id, 'dueAt', v_occurrence_due_at,
      'completedAt', v_completed_at, 'nextDueAt', v_next_due_at,
      'before', to_jsonb(v_current), 'after', to_jsonb(v_updated),
      'wishlistBefore', to_jsonb(v_wishlist_before), 'wishlistAfter', to_jsonb(v_wishlist_after)
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


create function public.care_create_reminder_v3(
 p_owner_id uuid,p_idempotency_key text,p_request_fingerprint text,p_pet_id uuid,p_type text,p_title text,
 p_due_at timestamptz,p_recurrence text,p_source text,p_time_mode text,p_details jsonb,p_completed_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_replay jsonb;v_saved public.reminders;v_response jsonb;
begin
 perform public.care_validate_details(p_details);
 if p_time_mode not in ('exact','flexible','approximate') or p_time_mode is null then raise exception 'INVALID_TIME_MODE';end if;
 if p_completed_at is not null and (p_recurrence<>'none' or p_completed_at>pg_catalog.now()+interval '1 minute') then raise exception 'INVALID_DATE';end if;
 v_replay:=public.care_claim_mutation_atomic(p_owner_id,p_idempotency_key,'reminder:create-v3',p_request_fingerprint);
 if v_replay is not null then
  perform public.care_owned_reminder_atomic(p_owner_id,(v_replay->'reminder'->>'id')::uuid);
  return v_replay;
 end if;
 perform 1 from public.pets where id=p_pet_id and owner_id=p_owner_id for share;
 if not found then raise exception 'PET_NOT_FOUND';end if;
 insert into public.reminders(pet_id,type,title,due_at,recurrence,status,metadata)
 values(p_pet_id,p_type,p_title,p_due_at,p_recurrence,'active',jsonb_build_object('source',p_source,'timeMode',p_time_mode)||p_details) returning * into v_saved;
 insert into public.reminder_events(reminder_id,event_type,idempotency_key,payload)
 values(v_saved.id,'created',p_idempotency_key,jsonb_build_object('source',p_source));
 if p_completed_at is not null then
  -- Within this transaction; the temporary active state is never visible to a dispatcher.
  v_response:=public.care_complete_reminder_atomic(p_owner_id,'past:'||v_saved.id::text,p_request_fingerprint,v_saved.id,p_completed_at);
 else v_response:=jsonb_build_object('reminder',to_jsonb(v_saved),'mode','user');end if;
 return public.care_finish_mutation_atomic(p_owner_id,p_idempotency_key,v_response);
end $$;
revoke all on function public.care_validate_details(jsonb) from public,anon,authenticated;
grant execute on function public.care_validate_details(jsonb) to service_role;
revoke all on function public.care_create_reminder_v3(uuid,text,text,uuid,text,text,timestamptz,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.care_create_reminder_v3(uuid,text,text,uuid,text,text,timestamptz,text,text,text,jsonb,timestamptz) to service_role;
commit;

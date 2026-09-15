begin;
-- Uses the existing care transaction/receipt; old callers keep the original signature.
create function public.care_create_reminder_v2(p_owner_id uuid,p_idempotency_key text,p_request_fingerprint text,p_pet_id uuid,p_type text,p_title text,p_due_at timestamptz,p_recurrence text,p_source text,p_time_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare response jsonb; saved public.reminders;
begin
 if p_time_mode is null or p_time_mode not in ('exact','flexible','approximate') then raise exception 'INVALID_TIME_MODE';end if;
 perform 1 from public.pets where id=p_pet_id and owner_id=p_owner_id for share;
 if not found then raise exception 'PET_NOT_FOUND';end if;
 response:=public.care_create_reminder_atomic(p_owner_id,p_idempotency_key,p_request_fingerprint,p_pet_id,p_type,p_title,p_due_at,p_recurrence,p_source);
 saved:=public.care_owned_reminder_atomic(p_owner_id,(response->'reminder'->>'id')::uuid);
 if response->'reminder' ? 'timeMode' then return response;end if;
 update public.reminders set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('timeMode',p_time_mode) where id=saved.id;
 response:=jsonb_set(response,'{reminder,timeMode}',to_jsonb(p_time_mode));
 return public.care_finish_mutation_atomic(p_owner_id,p_idempotency_key,response);
end $$;
revoke all on function public.care_create_reminder_v2(uuid,text,text,uuid,text,text,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.care_create_reminder_v2(uuid,text,text,uuid,text,text,timestamptz,text,text,text) to service_role;

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
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:update', p_request_fingerprint);
  if v_replay is not null then perform public.care_owned_reminder_atomic(p_owner_id,p_reminder_id);return v_replay;end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  update public.reminders set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    due_at = case when p_patch ? 'due_at' then (p_patch->>'due_at')::timestamptz else due_at end,
    type = case when p_patch ? 'type' then p_patch->>'type' else type end,
    recurrence = case when p_patch ? 'recurrence' then p_patch->>'recurrence' else recurrence end,
    metadata = case when p_patch ? 'time_mode' then coalesce(metadata,'{}'::jsonb)||jsonb_build_object('timeMode',p_patch->>'time_mode') else metadata end,
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

commit;

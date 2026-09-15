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
  v_replay := public.care_claim_mutation_atomic(p_owner_id, p_idempotency_key, 'reminder:complete', p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  v_current := public.care_owned_reminder_atomic(p_owner_id, p_reminder_id);
  if v_current.status = 'done' then raise exception 'REMINDER_ALREADY_DONE'; end if;
  select * into v_wishlist_before from public.wishlist_items where reminder_id=p_reminder_id for update;
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

create or replace function public.care_undo_reminder_completion_atomic(
 p_owner_id uuid, p_idempotency_key text, p_request_fingerprint text,
 p_reminder_id uuid, p_completed_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_replay jsonb;
 v_current public.reminders%rowtype;
 v_event public.reminder_events%rowtype;
 v_before jsonb;
 v_updated public.reminders%rowtype;
 v_response jsonb;
begin
 v_replay := public.care_claim_mutation_atomic(p_owner_id,p_idempotency_key,'reminder:undo-complete',p_request_fingerprint);
 if v_replay is not null then return v_replay; end if;
 v_current := public.care_owned_reminder_atomic(p_owner_id,p_reminder_id);
 select * into v_event from public.reminder_events
 where reminder_id=p_reminder_id and event_type='completed'
 and (payload->>'completedAt')::timestamptz=p_completed_at
 order by created_at desc limit 1 for update;
 if not found or v_event.payload->'before' is null or v_event.payload ? 'undoneAt'
 or to_jsonb(v_current) is distinct from v_event.payload->'after' then
  raise exception 'COMPLETION_CHANGED';
 end if;
 v_before := v_event.payload->'before';
 update public.reminders set
  status=v_before->>'status', due_at=(v_before->>'due_at')::timestamptz,
  completed_at=(v_before->>'completed_at')::timestamptz,
  snoozed_until=(v_before->>'snoozed_until')::timestamptz,
  next_due_at=(v_before->>'next_due_at')::timestamptz,
  updated_at=pg_catalog.now()
 where id=p_reminder_id returning * into v_updated;
 -- Only purchases automatically completed by that same transaction are reverted.
 update public.wishlist_items w set status='wanted',updated_at=pg_catalog.now()
 where reminder_id=p_reminder_id and status='bought'
 and v_event.payload->'wishlistBefore'->>'status'='wanted'
 and to_jsonb(w)=v_event.payload->'wishlistAfter';
 update public.reminder_events set payload=payload||jsonb_build_object('undoneAt',pg_catalog.now()) where id=v_event.id;
 insert into public.reminder_events(reminder_id,event_type,idempotency_key,payload)
 values(p_reminder_id,'updated',p_idempotency_key,jsonb_build_object('action','undo-completion','completionEventId',v_event.id));
 v_response:=jsonb_build_object('reminder',to_jsonb(v_updated),'undoneCompletedAt',p_completed_at);
 return public.care_finish_mutation_atomic(p_owner_id,p_idempotency_key,v_response);
end $$;
revoke all on function public.care_undo_reminder_completion_atomic(uuid,text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.care_undo_reminder_completion_atomic(uuid,text,text,uuid,timestamptz) to service_role;

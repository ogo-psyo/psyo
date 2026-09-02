alter table public.recommendations
  add column if not exists subject_id text not null default 'legacy'
  check (char_length(trim(subject_id)) between 1 and 160);

create index if not exists recommendations_active_subject_idx
  on public.recommendations(owner_id, pet_id, scenario_key, subject_id)
  where status in ('candidate','eligible','shown','accepted','snoozed');

create or replace function public.recommendation_persist_evaluation_atomic(
  p_owner_id uuid,
  p_pet_id uuid,
  p_evaluated_at timestamptz,
  p_supersede_ids uuid[],
  p_recommendations jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_evidence jsonb;
  v_recommendation_id uuid;
  v_superseded record;
  v_reactivated record;
  v_expired record;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.pets p where p.id = p_pet_id and p.owner_id = p_owner_id
  ) then raise exception 'PET_NOT_FOUND'; end if;
  if p_evaluated_at is null or jsonb_typeof(p_recommendations) is distinct from 'array' then
    raise exception 'INVALID_RECOMMENDATION_EVALUATION';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_pet_id::text || ':recommendations', 0)
  );

  for v_expired in
    select id, status from public.recommendations
    where owner_id = p_owner_id and pet_id = p_pet_id
      and status in ('candidate','eligible','shown','snoozed')
      and expires_at <= p_evaluated_at
    for update
  loop
    update public.recommendations
    set status = 'expired', resolved_at = p_evaluated_at
    where id = v_expired.id;
    insert into public.recommendation_events (
      recommendation_id, event_type, from_status, to_status, payload, created_at
    ) values (
      v_expired.id, 'expire', v_expired.status, 'expired', '{}'::jsonb, p_evaluated_at
    );
  end loop;

  for v_reactivated in
    select id from public.recommendations
    where owner_id = p_owner_id and pet_id = p_pet_id
      and status = 'snoozed' and snoozed_until <= p_evaluated_at and expires_at > p_evaluated_at
    for update
  loop
    update public.recommendations
    set status = 'eligible', snoozed_until = null
    where id = v_reactivated.id;
    insert into public.recommendation_events (
      recommendation_id, event_type, from_status, to_status, payload, created_at
    ) values (
      v_reactivated.id, 'reactivate', 'snoozed', 'eligible', '{}'::jsonb, p_evaluated_at
    );
  end loop;

  for v_superseded in
    select id, status from public.recommendations
    where owner_id = p_owner_id and pet_id = p_pet_id
      and id = any(coalesce(p_supersede_ids, '{}'::uuid[]))
      and status in ('candidate','eligible','shown','accepted','snoozed')
    for update
  loop
    update public.recommendations
    set status = 'superseded', resolved_at = p_evaluated_at
    where id = v_superseded.id;
    insert into public.recommendation_events (
      recommendation_id, event_type, from_status, to_status, payload, created_at
    ) values (
      v_superseded.id, 'supersede', v_superseded.status, 'superseded', '{}'::jsonb, p_evaluated_at
    );
  end loop;

  for v_item in select value from jsonb_array_elements(p_recommendations)
  loop
    if coalesce(v_item->>'petId', '') <> p_pet_id::text
      or coalesce(v_item->>'subjectId', '') = ''
      or coalesce(v_item->>'fingerprint', '') !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(v_item->'evidence') is distinct from 'array'
    then raise exception 'INVALID_RECOMMENDATION_EVALUATION'; end if;

    insert into public.recommendations (
      owner_id, pet_id, subject_id, scenario_key, policy_version, category, risk, status,
      fingerprint, title, why_now, limitation, primary_action, confidence, rank,
      suppression_reasons, fresh_until, expires_at, created_at
    ) values (
      p_owner_id, p_pet_id, v_item->>'subjectId', v_item->>'scenarioKey', v_item->>'policyVersion',
      v_item->>'category', v_item->>'risk', 'eligible', v_item->>'fingerprint', v_item->>'title',
      v_item->'whyNow', nullif(v_item->>'limitation', ''), v_item->'primaryAction',
      v_item->'confidence', v_item->'rank',
      coalesce(array(select jsonb_array_elements_text(v_item->'suppressionReasons')), '{}'::text[]),
      (v_item->>'freshUntil')::timestamptz, (v_item->>'expiresAt')::timestamptz,
      coalesce((v_item->>'createdAt')::timestamptz, p_evaluated_at)
    )
    on conflict (pet_id, fingerprint)
      where status in ('candidate','eligible','shown','accepted','snoozed')
    do update set
      subject_id = excluded.subject_id,
      scenario_key = excluded.scenario_key,
      policy_version = excluded.policy_version,
      category = excluded.category,
      risk = excluded.risk,
      title = excluded.title,
      why_now = excluded.why_now,
      limitation = excluded.limitation,
      primary_action = excluded.primary_action,
      confidence = excluded.confidence,
      rank = excluded.rank,
      suppression_reasons = excluded.suppression_reasons,
      fresh_until = excluded.fresh_until,
      expires_at = excluded.expires_at
    returning id into v_recommendation_id;

    delete from public.recommendation_evidence where recommendation_id = v_recommendation_id;
    for v_evidence in select value from jsonb_array_elements(v_item->'evidence')
    loop
      insert into public.recommendation_evidence (
        recommendation_id, source_type, source_id, captured_at, observed_at, due_at,
        source_updated_at, owner_confirmed, input_confidence, excerpt
      ) values (
        v_recommendation_id, v_evidence->>'sourceType', v_evidence->>'sourceId',
        (v_evidence->>'capturedAt')::timestamptz,
        nullif(v_evidence->>'observedAt', '')::timestamptz,
        nullif(v_evidence->>'dueAt', '')::timestamptz,
        nullif(v_evidence->>'updatedAt', '')::timestamptz,
        coalesce((v_evidence->>'ownerConfirmed')::boolean, false),
        nullif(v_evidence->>'inputConfidence', '')::numeric,
        nullif(v_evidence->>'excerpt', '')
      );
    end loop;
  end loop;

  select coalesce(jsonb_agg(
    to_jsonb(r) || jsonb_build_object('recommendation_evidence', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.source_type, e.source_id)
      from public.recommendation_evidence e where e.recommendation_id = r.id
    ), '[]'::jsonb)) order by r.id
  ), '[]'::jsonb) into v_result
  from public.recommendations r
  where r.owner_id = p_owner_id and r.pet_id = p_pet_id
    and r.fingerprint in (
      select value->>'fingerprint' from jsonb_array_elements(p_recommendations)
    )
    and r.status in ('candidate','eligible','shown','accepted','snoozed');
  return v_result;
end
$$;

create or replace function public.recommendation_outcome_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_recommendation_id uuid,
  p_result text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mutation public.recommendation_mutations%rowtype;
  v_recommendation public.recommendations%rowtype;
  v_to_status text;
  v_response jsonb;
  v_event_payload jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_REQUEST_FINGERPRINT';
  end if;
  if p_result not in ('complete','fail') or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'INVALID_RECOMMENDATION_OUTCOME';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0)
  );
  select * into v_mutation from public.recommendation_mutations
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_mutation.request_fingerprint <> p_request_fingerprint then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_mutation.response is not null then return v_mutation.response; end if;
    delete from public.recommendation_mutations where id = v_mutation.id;
  end if;
  insert into public.recommendation_mutations (owner_id, idempotency_key, request_fingerprint)
  values (p_owner_id, p_idempotency_key, p_request_fingerprint);

  select * into v_recommendation from public.recommendations
  where id = p_recommendation_id and owner_id = p_owner_id for update;
  if not found then raise exception 'RECOMMENDATION_NOT_FOUND'; end if;
  if v_recommendation.status not in ('shown','accepted') then raise exception 'INVALID_RECOMMENDATION_TRANSITION'; end if;
  v_to_status := case p_result when 'complete' then 'completed' else 'failed' end;
  v_event_payload := jsonb_strip_nulls(jsonb_build_object(
    'domainType', p_payload->>'domainType', 'domainId', p_payload->>'domainId',
    'occurredAt', p_payload->>'occurredAt',
    'reason', case when p_payload->>'reason' = 'already_done' then 'already_done' end
  ));
  update public.recommendations set status = v_to_status, resolved_at = now()
  where id = p_recommendation_id;
  insert into public.recommendation_events (recommendation_id, event_type, from_status, to_status, payload)
  values (p_recommendation_id, p_result, v_recommendation.status, v_to_status, v_event_payload);
  v_response := jsonb_build_object('recommendationId', p_recommendation_id, 'status', v_to_status, 'replayed', false);
  update public.recommendation_mutations set response = v_response
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.recommendation_delete_history_for_owner(
  p_owner_id uuid,
  p_pet_id uuid
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id) then
    raise exception 'PET_NOT_FOUND';
  end if;
  delete from public.recommendations where owner_id = p_owner_id and pet_id = p_pet_id;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.recommendation_persist_evaluation_atomic(uuid, uuid, timestamptz, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.recommendation_persist_evaluation_atomic(uuid, uuid, timestamptz, uuid[], jsonb) to service_role;
revoke all on function public.recommendation_outcome_atomic(uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.recommendation_outcome_atomic(uuid, text, text, uuid, text, jsonb) to service_role;
revoke all on function public.recommendation_delete_history_for_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.recommendation_delete_history_for_owner(uuid, uuid) to service_role;

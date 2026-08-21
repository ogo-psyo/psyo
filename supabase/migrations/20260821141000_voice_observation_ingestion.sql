create table if not exists public.stt_usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists stt_usage_events_owner_created_idx
  on public.stt_usage_events(owner_id, created_at desc);

alter table public.stt_usage_events enable row level security;
revoke all on table public.stt_usage_events from public, anon, authenticated;
grant select, insert, delete on table public.stt_usage_events to service_role;
grant usage, select on sequence public.stt_usage_events_id_seq to service_role;

create or replace function public.claim_stt_request(p_owner_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit constant integer := 20;
  v_used integer;
begin
  if p_owner_id is null or not exists (select 1 from auth.users where id = p_owner_id) then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('stt:' || p_owner_id::text, 0));
  delete from public.stt_usage_events where created_at < now() - interval '24 hours';
  select count(*)::integer into v_used
  from public.stt_usage_events
  where owner_id = p_owner_id and created_at >= now() - interval '1 hour';

  if v_used >= v_limit then raise exception 'STT_RATE_LIMITED'; end if;
  insert into public.stt_usage_events(owner_id) values (p_owner_id);
  return v_limit - v_used - 1;
end;
$$;

revoke all on function public.claim_stt_request(uuid) from public, anon, authenticated;
grant execute on function public.claim_stt_request(uuid) to service_role;

create or replace function public.ingest_voice_observation_batch(
  p_owner_id uuid,
  p_pet_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_candidates jsonb,
  p_capture_id text,
  p_author_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_mutation public.care_mutations%rowtype;
  v_candidate jsonb;
  v_existing public.pet_observations%rowtype;
  v_saved public.pet_observations%rowtype;
  v_metric text;
  v_value text;
  v_direction text;
  v_existing_direction text;
  v_existing_author text;
  v_observed_at timestamptz;
  v_onset_at timestamptz;
  v_confidence numeric;
  v_operation text;
  v_analytics_eligible boolean;
  v_metadata jsonb;
  v_decisions jsonb := '[]'::jsonb;
  v_response jsonb;
  v_first_observation jsonb;
  v_create integer := 0;
  v_update integer := 0;
  v_merge integer := 0;
  v_conflict integer := 0;
  v_recent integer;
begin
  if p_owner_id is null or p_pet_id is null or not exists (
    select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id
  ) then raise exception 'PET_NOT_FOUND'; end if;
  if length(coalesce(p_idempotency_key, '')) not between 8 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if length(coalesce(p_request_fingerprint, '')) < 8 then raise exception 'INVALID_REQUEST_FINGERPRINT'; end if;
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) not between 1 and 6 then
    raise exception 'INVALID_CANDIDATE_BATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('voice:' || p_owner_id::text || ':' || p_pet_id::text, 0));

  select * into v_existing_mutation from public.care_mutations
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_mutation.operation <> 'observation:voice-batch'
      or v_existing_mutation.request_fingerprint <> p_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if v_existing_mutation.response is null then raise exception 'CARE_MUTATION_IN_PROGRESS'; end if;
    return v_existing_mutation.response || jsonb_build_object('replayed', true);
  end if;

  select count(*)::integer into v_recent from public.care_mutations
  where owner_id = p_owner_id
    and operation = 'observation:voice-batch'
    and created_at >= now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'VOICE_INGESTION_RATE_LIMITED'; end if;

  insert into public.care_mutations(owner_id, idempotency_key, operation, request_fingerprint)
  values (p_owner_id, p_idempotency_key, 'observation:voice-batch', p_request_fingerprint);

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    v_metric := v_candidate ->> 'metric';
    v_value := btrim(v_candidate ->> 'value');
    v_direction := coalesce(v_candidate ->> 'direction', 'unknown');
    v_observed_at := (v_candidate ->> 'observedAt')::timestamptz;
    v_onset_at := nullif(v_candidate ->> 'onsetAt', '')::timestamptz;
    v_confidence := (v_candidate ->> 'confidence')::numeric;

    if v_metric not in ('mood', 'energy', 'appetite', 'stool', 'sleep')
      or v_direction not in ('down', 'stable', 'up', 'unknown')
      or length(v_value) not between 1 and 120
      or coalesce((v_candidate ->> 'confirmed')::boolean, false) is not true
      or v_confidence < 0.8 or v_confidence > 1 then
      raise exception 'INVALID_CANDIDATE';
    end if;

    v_analytics_eligible := v_onset_at is not null and v_direction <> 'unknown';
    select * into v_existing from public.pet_observations
    where pet_id = p_pet_id
      and type = v_metric
      and source = 'assistant'
      and deleted_at is null
      and observed_at between v_observed_at - interval '12 hours' and v_observed_at + interval '12 hours'
    order by abs(extract(epoch from (observed_at - v_observed_at))), created_at desc
    limit 1
    for update;

    v_metadata := jsonb_build_object(
      v_metric, v_value,
      'analyticsEligible', v_analytics_eligible,
      'candidate', v_candidate,
      'voiceCapture', jsonb_build_object(
        'captureId', p_capture_id,
        'authorId', p_author_id,
        'ingestionStatus', 'ready',
        'notesCreated', 0,
        'audioRetainedByPsyo', false,
        'transcriptionProvider', 'groq_whisper_large_v3_turbo',
        'sources', jsonb_build_array(jsonb_build_object('captureId', p_capture_id, 'candidateId', v_candidate ->> 'id'))
      )
    );

    if not found then
      v_operation := 'create';
      insert into public.pet_observations(pet_id, type, value, note, observed_at, source, metadata)
      values (p_pet_id, v_metric, v_value, null, v_observed_at, 'assistant', v_metadata)
      returning * into v_saved;
      v_create := v_create + 1;
    else
      v_existing_direction := coalesce(v_existing.metadata #>> '{candidate,direction}', 'unknown');
      v_existing_author := coalesce(v_existing.metadata #>> '{voiceCapture,authorId}', '');
      if v_existing_author <> '' and v_existing_author <> p_author_id and v_existing_direction <> v_direction then
        v_operation := 'conflict';
        v_analytics_eligible := false;
        v_metadata := jsonb_set(v_metadata, '{analyticsEligible}', 'false'::jsonb, true)
          || jsonb_build_object('conflictWith', v_existing.id);
        v_metadata := jsonb_set(v_metadata, '{voiceCapture,ingestionStatus}', '"conflict"'::jsonb, true);
        update public.pet_observations
          set metadata = jsonb_set(metadata, '{analyticsEligible}', 'false'::jsonb, true)
            || jsonb_build_object('conflictWith', p_capture_id)
          where id = v_existing.id;
        insert into public.pet_observations(pet_id, type, value, note, observed_at, source, metadata)
        values (p_pet_id, v_metric, v_value, null, v_observed_at, 'assistant', v_metadata)
        returning * into v_saved;
        v_conflict := v_conflict + 1;
      elsif v_existing_direction = v_direction then
        v_operation := case when lower(v_existing.value) = lower(v_value) then 'update' else 'merge' end;
        v_metadata := v_existing.metadata || v_metadata;
        v_metadata := jsonb_set(
          v_metadata,
          '{voiceCapture,sources}',
          coalesce(v_existing.metadata #> '{voiceCapture,sources}', '[]'::jsonb)
            || jsonb_build_array(jsonb_build_object('captureId', p_capture_id, 'candidateId', v_candidate ->> 'id')),
          true
        );
        update public.pet_observations
          set value = v_value, observed_at = greatest(observed_at, v_observed_at), metadata = v_metadata
          where id = v_existing.id
          returning * into v_saved;
        if v_operation = 'update' then v_update := v_update + 1; else v_merge := v_merge + 1; end if;
      else
        v_operation := 'create';
        insert into public.pet_observations(pet_id, type, value, note, observed_at, source, metadata)
        values (p_pet_id, v_metric, v_value, null, v_observed_at, 'assistant', v_metadata)
        returning * into v_saved;
        v_create := v_create + 1;
      end if;
    end if;

    if v_first_observation is null then v_first_observation := to_jsonb(v_saved); end if;
    v_decisions := v_decisions || jsonb_build_array(jsonb_build_object(
      'candidateId', v_candidate ->> 'id',
      'operation', v_operation,
      'observationId', v_saved.id,
      'analyticsEligible', v_analytics_eligible
    ));
  end loop;

  v_response := jsonb_build_object(
    'observation', v_first_observation,
    'decisions', v_decisions,
    'summary', jsonb_build_object(
      'candidates', jsonb_array_length(p_candidates),
      'create', v_create,
      'update', v_update,
      'merge', v_merge,
      'conflict', v_conflict,
      'notesCreated', 0
    ),
    'mode', 'supabase'
  );
  update public.care_mutations set response = v_response
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.ingest_voice_observation_batch(uuid, uuid, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.ingest_voice_observation_batch(uuid, uuid, text, text, jsonb, text, text) to service_role;

alter function public.ingest_voice_observation_batch(uuid, uuid, text, text, jsonb, text, text)
  rename to ingest_voice_observation_batch_legacy;

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
  v_response jsonb;
  v_input_source text;
begin
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) < 1 then
    raise exception 'INVALID_CANDIDATE_BATCH';
  end if;

  select min(candidate ->> 'source') into v_input_source
  from jsonb_array_elements(p_candidates) candidate;

  if v_input_source not in ('voice', 'text') or exists (
    select 1 from jsonb_array_elements(p_candidates) candidate
    where candidate ->> 'source' is distinct from v_input_source
  ) then
    raise exception 'INVALID_CANDIDATE_SOURCE';
  end if;

  v_response := public.ingest_voice_observation_batch_legacy(
    p_owner_id,
    p_pet_id,
    p_idempotency_key,
    p_request_fingerprint,
    p_candidates,
    p_capture_id,
    p_author_id
  );

  update public.pet_observations observation
  set metadata = jsonb_set(
    jsonb_set(observation.metadata, '{voiceCapture,inputSource}', to_jsonb(v_input_source), true),
    '{voiceCapture,transcriptionProvider}',
    case when v_input_source = 'voice' then to_jsonb('groq_whisper_large_v3_turbo'::text) else 'null'::jsonb end,
    true
  )
  where observation.pet_id = p_pet_id
    and observation.id in (
      select (decision ->> 'observationId')::uuid
      from jsonb_array_elements(coalesce(v_response -> 'decisions', '[]'::jsonb)) decision
    );

  return v_response;
end;
$$;

revoke all on function public.ingest_voice_observation_batch_legacy(uuid, uuid, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.ingest_voice_observation_batch(uuid, uuid, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.ingest_voice_observation_batch(uuid, uuid, text, text, jsonb, text, text) to service_role;

-- One transaction owns both the domain change and its retry receipt.
-- Do not clear pending receipts from the old, non-atomic HTTP protocol:
-- their domain write may already have committed and needs reconciliation.
create or replace function public.care_observation_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_action text,
  p_target_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.care_mutations%rowtype;
  v_row public.pet_observations%rowtype;
  v_pet_id uuid;
  v_response jsonb;
begin
  if p_owner_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_request_fingerprint is null or length(p_request_fingerprint) <> 64 then
    raise exception 'INVALID_REQUEST_FINGERPRINT';
  end if;
  if p_action is null or p_action not in ('create', 'update', 'delete', 'restore')
    or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'INVALID_OBSERVATION_COMMAND';
  end if;
  if p_patch ? 'metadata' and jsonb_typeof(p_patch->'metadata') <> 'object' then
    raise exception 'INVALID_OBSERVATION_METADATA';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0)
  );

  -- Check current ownership even for a replay. Deleted observations remain
  -- addressable here so a lost DELETE response can be replayed correctly.
  if p_action = 'create' then
    select id into v_pet_id from public.pets
      where id = p_target_id and owner_id = p_owner_id for share;
    if not found then raise exception 'PET_NOT_FOUND'; end if;
  else
    select o.* into v_row from public.pet_observations o
      join public.pets p on p.id = o.pet_id
      where o.id = p_target_id and p.owner_id = p_owner_id
      for update of o for share of p;
    if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  end if;

  select * into v_receipt from public.care_mutations
    where owner_id = p_owner_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_receipt.operation <> 'observation:' || p_action
      or v_receipt.request_fingerprint <> p_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if v_receipt.response is null then raise exception 'CARE_MUTATION_IN_PROGRESS'; end if;
    return v_receipt.response;
  end if;
  if p_action in ('update', 'delete') and v_row.deleted_at is not null then
    raise exception 'OBSERVATION_NOT_FOUND';
  end if;
  insert into public.care_mutations(owner_id, idempotency_key, operation, request_fingerprint)
    values (p_owner_id, p_idempotency_key, 'observation:' || p_action, p_request_fingerprint);

  if p_action = 'create' then
    insert into public.pet_observations(pet_id, type, value, note, observed_at, source, metadata)
      values (v_pet_id, p_patch->>'type', p_patch->>'value', p_patch->>'note',
        coalesce((p_patch->>'observed_at')::timestamptz, pg_catalog.now()),
        coalesce(p_patch->>'source', 'manual'), coalesce(p_patch->'metadata', '{}'::jsonb))
      returning * into v_row;
  elsif p_action = 'update' then
    update public.pet_observations set
      type = case when p_patch ? 'type' then p_patch->>'type' else type end,
      value = case when p_patch ? 'value' then p_patch->>'value' else value end,
      note = case when p_patch ? 'note' then p_patch->>'note' else note end,
      observed_at = case when p_patch ? 'observed_at' then (p_patch->>'observed_at')::timestamptz else observed_at end,
      source = case when p_patch ? 'source' then p_patch->>'source' else source end,
      metadata = metadata || coalesce(p_patch->'metadata', '{}'::jsonb)
      where id = p_target_id returning * into v_row;
  else
    update public.pet_observations set
      deleted_at = case when p_action = 'delete' then pg_catalog.now() else null end
      where id = p_target_id returning * into v_row;
  end if;

  if p_action = 'delete' then
    v_response := jsonb_build_object('ok', true, 'deletedAt', v_row.deleted_at, 'canRestore', true);
  elsif p_action = 'restore' then
    v_response := jsonb_build_object('observation', to_jsonb(v_row), 'restored', true);
  else
    v_response := jsonb_build_object('observation', to_jsonb(v_row), 'mode', 'supabase');
  end if;
  return public.care_finish_mutation_atomic(p_owner_id, p_idempotency_key, v_response);
end;
$$;

revoke all on function public.care_observation_atomic(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.care_observation_atomic(uuid, text, text, text, uuid, jsonb) to service_role;

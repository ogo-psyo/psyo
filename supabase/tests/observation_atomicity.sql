-- Real Postgres fault injection. All fixtures and triggers are rolled back.
begin;
create schema observation_test;
create function observation_test.fail_receipt() returns trigger language plpgsql as $$
begin
  if current_setting('pso.test_fail_receipt', true) = 'on' then
    raise exception 'TEST_RECEIPT_FAILURE';
  end if;
  return new;
end $$;
create trigger observation_test_receipt before update on public.care_mutations
for each row execute function observation_test.fail_receipt();

do $$
declare
  owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid();
  pet uuid := gen_random_uuid(); observation uuid;
  first_result jsonb; replay jsonb; before_row jsonb;
  action text; target uuid; patch jsonb; operation_key text;
begin
  insert into auth.users(id) values (owner_a), (owner_b);
  insert into public.pets(id, owner_id, name) values (pet, owner_a, 'Atomic test');
  first_result := public.care_observation_atomic(owner_a, 'initial-create', repeat('a',64), 'create', pet,
    '{"type":"note","value":"Original","metadata":{"energy":"normal","origin":null}}');
  observation := (first_result#>>'{observation,id}')::uuid;
  replay := public.care_observation_atomic(owner_a, 'initial-create', repeat('a',64), 'create', pet,
    '{"type":"note","value":"Original","metadata":{"energy":"normal","origin":null}}');
  if first_result <> replay then raise exception 'create replay changed result'; end if;
  if (select count(*) from public.pet_observations where pet_id=pet) <> 1 then raise exception 'duplicate create'; end if;

  foreach action in array array['create','update','delete','restore'] loop
    target := case when action='create' then pet else observation end;
    patch := case when action='create' then '{"type":"note","value":"New"}'::jsonb
      when action='update' then '{"note":"changed","metadata":{"mood":"happy"}}'::jsonb else '{}'::jsonb end;
    operation_key := 'fault-' || action;
    select to_jsonb(o) into before_row from public.pet_observations o where id=observation;
    perform set_config('pso.test_fail_receipt','on',true);
    begin
      perform public.care_observation_atomic(owner_a, operation_key, repeat('b',64), action, target, patch);
      raise exception 'expected receipt failure';
    exception when others then if sqlerrm <> 'TEST_RECEIPT_FAILURE' then raise; end if; end;
    perform set_config('pso.test_fail_receipt','off',true);
    if exists(select 1 from public.care_mutations where owner_id=owner_a and idempotency_key=operation_key) then
      raise exception 'failed receipt claim survived: %', action;
    end if;
    if before_row <> (select to_jsonb(o) from public.pet_observations o where id=observation) then
      raise exception 'failed domain update survived: %', action;
    end if;
    if action='create' and (select count(*) from public.pet_observations where pet_id=pet) <> 1 then
      raise exception 'failed create survived';
    end if;
    first_result := public.care_observation_atomic(owner_a, operation_key, repeat('b',64), action, target, patch);
    replay := public.care_observation_atomic(owner_a, operation_key, repeat('b',64), action, target, patch);
    if first_result <> replay then raise exception 'replay changed: %', action; end if;
    if action='update' and first_result#>'{observation,metadata}' <> '{"energy":"normal","origin":null,"mood":"happy"}'::jsonb then
      raise exception 'metadata merge lost existing fields';
    end if;
    begin
      perform public.care_observation_atomic(owner_a, operation_key, repeat('c',64), action, target, patch);
      raise exception 'expected key conflict';
    exception when others then if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if; end;
    begin
      perform public.care_observation_atomic(owner_b, operation_key, repeat('b',64), action, target, patch);
      raise exception 'expected owner rejection';
    exception when others then
      if sqlerrm not in ('PET_NOT_FOUND','OBSERVATION_NOT_FOUND') then raise; end if;
    end;
  end loop;
  if (select deleted_at from public.pet_observations where id=observation) is not null then
    raise exception 'restore did not restore';
  end if;

  -- Legacy unresolved receipt must not be erased/retried automatically.
  insert into public.care_mutations(owner_id,idempotency_key,operation,request_fingerprint)
    values(owner_a,'legacy-pending','observation:create',repeat('d',64));
  begin
    perform public.care_observation_atomic(owner_a,'legacy-pending',repeat('d',64),'create',pet,'{"type":"note","value":"duplicate?"}');
    raise exception 'expected pending receipt rejection';
  exception when others then if sqlerrm <> 'CARE_MUTATION_IN_PROGRESS' then raise; end if; end;
  if not exists(select 1 from public.care_mutations where owner_id=owner_a and idempotency_key='legacy-pending' and response is null) then
    raise exception 'legacy pending receipt removed';
  end if;
  if has_function_privilege('anon','public.care_observation_atomic(uuid,text,text,text,uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.care_observation_atomic(uuid,text,text,text,uuid,jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.care_observation_atomic(uuid,text,text,text,uuid,jsonb)','EXECUTE') then
    raise exception 'invalid RPC grants';
  end if;
  raise notice 'PASS create/update/delete/restore: rollback, replay, ownership, metadata, pending legacy receipts, grants';
end $$;
rollback;

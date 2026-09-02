begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

do $$
declare
  v_owner uuid := '31111111-1111-4111-8111-111111111111';
  v_pet uuid := '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_reminder uuid := '3ddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_payload jsonb;
  v_result jsonb;
  v_recommendation_id uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repository@example.test', '', now(), now());
  insert into public.pets (id, owner_id, name) values (v_pet, v_owner, 'Репо');
  insert into public.reminders (id, pet_id, type, title, due_at)
  values (v_reminder, v_pet, 'grooming', 'Когти', now() - interval '1 day');

  v_payload := jsonb_build_array(jsonb_build_object(
    'petId', v_pet, 'subjectId', v_reminder, 'scenarioKey', 'care_due', 'policyVersion', 'care_due@1',
    'category', 'care', 'risk', 'routine', 'fingerprint', repeat('3', 64), 'title', 'Проверить дело',
    'whyNow', jsonb_build_array('Срок наступил'),
    'primaryAction', jsonb_build_object('intent', 'open_reminder', 'reminderId', v_reminder),
    'confidence', jsonb_build_object('dataSufficiency', 'high', 'sourceReliability', 'high', 'ruleCertainty', 'high'),
    'rank', jsonb_build_object('tier', 2, 'urgency', 100, 'actionability', 100, 'relevance', 100, 'annoyancePenalty', 0),
    'suppressionReasons', '[]'::jsonb, 'freshUntil', now() + interval '1 day', 'expiresAt', now() + interval '2 days',
    'createdAt', now(), 'evidence', jsonb_build_array(jsonb_build_object(
      'sourceType', 'reminder', 'sourceId', v_reminder, 'capturedAt', now(), 'dueAt', now() - interval '1 day',
      'ownerConfirmed', true, 'excerpt', 'Когти'
    ))
  ));
  v_result := public.recommendation_persist_evaluation_atomic(v_owner, v_pet, now(), '{}'::uuid[], v_payload);
  if jsonb_array_length(v_result) <> 1 then raise exception 'persist did not return one recommendation'; end if;
  v_recommendation_id := (v_result->0->>'id')::uuid;
  if v_result->0->>'subject_id' <> v_reminder::text then raise exception 'subject id was not persisted'; end if;
  if jsonb_array_length(v_result->0->'recommendation_evidence') <> 1 then raise exception 'evidence was not persisted'; end if;
end
$$;
select pass('atomic evaluation persists subject identity and evidence');

do $$
declare
  v_owner uuid := '31111111-1111-4111-8111-111111111111';
  v_pet uuid := '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_id uuid;
  v_payload jsonb;
begin
  select id into v_id from public.recommendations where owner_id = v_owner and fingerprint = repeat('3', 64);
  update public.recommendations set status = 'shown' where id = v_id;
  perform public.recommendation_outcome_atomic(
    v_owner, 'outside-card-fail', repeat('4', 64), v_id, 'fail',
    jsonb_build_object('domainType', 'reminder', 'domainId', '3ddddddd-dddd-4ddd-8ddd-dddddddddddd', 'occurredAt', now())
  );
  if (select status from public.recommendations where id = v_id) <> 'failed' then
    raise exception 'failed outcome became another status';
  end if;
end
$$;
select pass('shown recommendation accepts an external failed outcome without completing');

do $$
declare
  v_owner uuid := '31111111-1111-4111-8111-111111111111';
  v_pet uuid := '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_count bigint;
begin
  v_count := public.recommendation_delete_history_for_owner(v_owner, v_pet);
  if v_count <> 1 then raise exception 'unexpected recommendation delete count'; end if;
  if not exists (select 1 from public.reminders where id = '3ddddddd-dddd-4ddd-8ddd-dddddddddddd') then
    raise exception 'domain source was deleted with recommendation history';
  end if;
end
$$;
select pass('history deletion preserves domain sources');

select throws_ok(
  $$select public.recommendation_delete_history_for_owner(
    '31111111-1111-4111-8111-111111111111', '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )$$,
  'P0001', 'PET_NOT_FOUND', 'history deletion is owner and pet scoped'
);

select * from finish();
rollback;

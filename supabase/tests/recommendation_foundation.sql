-- Regression suite for a disposable local Supabase/Postgres database.
-- Apply all migrations first, then run this file with `supabase test db`.
begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

do $$
declare
  v_owner_a uuid := '11111111-1111-4111-8111-111111111111';
  v_owner_b uuid := '22222222-2222-4222-8222-222222222222';
  v_pet_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_pet_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_recommendation uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (v_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recommendation-a@example.test', '', now(), now()),
    (v_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recommendation-b@example.test', '', now(), now());
  insert into public.pets (id, owner_id, name)
  values (v_pet_a, v_owner_a, 'Альфа'), (v_pet_b, v_owner_b, 'Бета');

  insert into public.recommendations (
    id, owner_id, pet_id, scenario_key, policy_version, category, risk, status,
    fingerprint, title, why_now, primary_action, confidence, rank,
    fresh_until, expires_at
  ) values (
    v_recommendation, v_owner_a, v_pet_a, 'care_due', 'care_due@1', 'care',
    'routine', 'eligible', repeat('a', 64), 'Проверить дело',
    '["Срок наступил"]'::jsonb,
    '{"intent":"open_reminder","reminderId":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}'::jsonb,
    '{"dataSufficiency":"high","sourceReliability":"high","ruleCertainty":"high"}'::jsonb,
    '{"tier":2,"urgency":100,"actionability":100,"relevance":100,"annoyancePenalty":0}'::jsonb,
    now() + interval '1 day', now() + interval '2 days'
  );

  -- duplicate active fingerprint
  begin
    insert into public.recommendations (
      owner_id, pet_id, scenario_key, policy_version, category, risk, status,
      fingerprint, title, why_now, primary_action, confidence, rank,
      fresh_until, expires_at
    ) select
      owner_id, pet_id, scenario_key, policy_version, category, risk, status,
      fingerprint, title, why_now, primary_action, confidence, rank,
      fresh_until, expires_at
    from public.recommendations where id = v_recommendation;
    raise exception 'duplicate active fingerprint was accepted';
  exception when unique_violation then
    null;
  end;

end
$$;
select pass('fixture creation and active fingerprint deduplication');

-- owner A sees its recommendation
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.recommendations) <> 1 then
    raise exception 'owner A isolation failed';
  end if;
end
$$;
reset role;
select pass('owner A can read its recommendation');

-- owner B sees zero recommendations
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.recommendations) <> 0 then
    raise exception 'owner B isolation failed';
  end if;
end
$$;
reset role;
select pass('owner B cannot read owner A recommendation');

do $$
declare
  v_owner_a uuid := '11111111-1111-4111-8111-111111111111';
  v_owner_b uuid := '22222222-2222-4222-8222-222222222222';
  v_recommendation uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_response jsonb;
  v_replay jsonb;
begin

  v_response := public.recommendation_transition_atomic(
    v_owner_a, 'show-recommendation-1', repeat('b', 64),
    v_recommendation, 'show', '{}'::jsonb
  );
  v_replay := public.recommendation_transition_atomic(
    v_owner_a, 'show-recommendation-1', repeat('b', 64),
    v_recommendation, 'show', '{}'::jsonb
  );
  if v_replay <> v_response then raise exception 'idempotent replay changed response'; end if;
  if (select count(*) from public.recommendation_events where recommendation_id = v_recommendation) <> 1 then
    raise exception 'idempotent replay duplicated event';
  end if;

  perform public.recommendation_transition_atomic(
    v_owner_a, 'snooze-recommendation-1', repeat('e', 64),
    v_recommendation, 'snooze', jsonb_build_object('until', now() + interval '1 hour')
  );
  perform public.recommendation_transition_atomic(
    v_owner_a, 'reactivate-recommendation-1', repeat('f', 64),
    v_recommendation, 'reactivate', '{}'::jsonb
  );
  if (select status from public.recommendations where id = v_recommendation) <> 'eligible' then
    raise exception 'reactivate did not restore eligibility';
  end if;

  begin
    perform public.recommendation_transition_atomic(
      v_owner_b, 'foreign-recommendation-1', repeat('9', 64),
      v_recommendation, 'show', '{}'::jsonb
    );
    raise exception 'expected RECOMMENDATION_NOT_FOUND';
  exception when others then
    if sqlerrm <> 'RECOMMENDATION_NOT_FOUND' then raise; end if;
  end;

  begin
    perform public.recommendation_transition_atomic(
      v_owner_a, 'show-recommendation-1', repeat('c', 64),
      v_recommendation, 'show', '{}'::jsonb
    );
    raise exception 'expected IDEMPOTENCY_KEY_REUSED';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;

  begin
    perform public.recommendation_transition_atomic(
      v_owner_a, 'invalid-transition-1', repeat('d', 64),
      v_recommendation, 'complete', '{}'::jsonb
    );
    raise exception 'expected INVALID_RECOMMENDATION_TRANSITION';
  exception when others then
    if sqlerrm <> 'INVALID_RECOMMENDATION_TRANSITION' then raise; end if;
  end;
end
$$;
select pass('atomic lifecycle, replay protection, ownership, and transition whitelist');

select * from finish();
rollback;

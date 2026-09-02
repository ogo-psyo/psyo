begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('41111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gav@example.test', '', now(), now());
insert into public.pets (id, owner_id, name)
values ('4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '41111111-1111-4111-8111-111111111111', 'Гав');

select lives_ok($$
  insert into public.recommendations (
    owner_id, pet_id, subject_id, scenario_key, policy_version, category, risk, status,
    fingerprint, title, why_now, primary_action, confidence, rank, fresh_until, expires_at
  ) values (
    '41111111-1111-4111-8111-111111111111', '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'request-1',
    'gav_incoming_request', 'gav_incoming_request@1', 'social', 'routine', 'eligible', repeat('a', 64),
    'Ответить в Гав', '["Есть новый отклик"]', '{"intent":"open_gav","view":"requests","requestId":"request-1"}',
    '{"dataSufficiency":"high","sourceReliability":"high","ruleCertainty":"high"}',
    '{"tier":1,"urgency":95,"actionability":100,"relevance":100,"annoyancePenalty":0}', now() + interval '1 hour', now() + interval '1 day'
  )
$$, 'social recommendation category is accepted');

select lives_ok($$
  insert into public.recommendation_evidence (recommendation_id, source_type, source_id, captured_at, owner_confirmed)
  select id, 'social_request', 'request-1', now(), true from public.recommendations where subject_id = 'request-1'
$$, 'social request evidence is accepted');

select lives_ok($$
  insert into public.recommendation_preferences (owner_id, pet_id, category, enabled)
  values ('41111111-1111-4111-8111-111111111111', '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'social', true)
$$, 'social recommendation preference is accepted');

select lives_ok($$
  insert into public.recommendation_outcome_failures (
    owner_id, outcome_key, recommendation_id, domain_type, domain_id, result, occurred_at, error_code, next_retry_at
  ) values (
    '41111111-1111-4111-8111-111111111111', 'gav-outcome-key', 'recommendation-1', 'social_signal', 'signal-1',
    'completed', now(), 'OUTCOME_LINK_FAILED', now() + interval '5 minutes'
  )
$$, 'social signal outcome retry is accepted');

select * from finish();
rollback;

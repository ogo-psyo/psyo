-- Behavioral regression suite for a local Supabase/Postgres test database.
-- Run after migrations with a disposable auth user/pet/reminder fixture.
begin;

create schema care_test;
create function care_test.fail_event_insert() returns trigger
language plpgsql as $$
begin
  raise exception 'CARE_TEST_FAILURE_AFTER_DOMAIN_WRITE';
end
$$;
create trigger care_test_fail_event_insert
before insert on public.reminder_events
for each row execute function care_test.fail_event_insert();

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_pet uuid := gen_random_uuid();
  v_result jsonb;
  v_replay jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'care-atomicity@example.test', '', now(), now());
  insert into public.pets (id, owner_id, name) values (v_pet, v_owner, 'Тест');

  -- Failure after the reminder insert must roll back reminder, event and ledger.
  begin
    perform public.care_create_reminder_atomic(
      v_owner, 'atomic-failure-key', repeat('a', 64), v_pet, 'custom',
      'Сбой', now(), 'none', 'test'
    );
    raise exception 'expected injected failure';
  exception when others then
    if sqlerrm <> 'CARE_TEST_FAILURE_AFTER_DOMAIN_WRITE' then raise; end if;
  end;
  execute 'drop trigger care_test_fail_event_insert on public.reminder_events';
  if exists (select 1 from public.reminders where pet_id = v_pet and title = 'Сбой') then
    raise exception 'domain write survived failed transaction';
  end if;
  if exists (select 1 from public.care_mutations where owner_id = v_owner and idempotency_key = 'atomic-failure-key') then
    raise exception 'ledger claim survived failed transaction';
  end if;

  -- Retry after rollback succeeds; replay returns byte-for-byte equal JSON.
  v_result := public.care_create_reminder_atomic(
    v_owner, 'atomic-retry-key', repeat('b', 64), v_pet, 'custom',
    'Повтор', now(), 'none', 'test'
  );
  v_replay := public.care_create_reminder_atomic(
    v_owner, 'atomic-retry-key', repeat('b', 64), v_pet, 'custom',
    'Повтор', now(), 'none', 'test'
  );
  if v_replay <> v_result then raise exception 'idempotent replay changed response'; end if;
  if (select count(*) from public.reminders where pet_id = v_pet and title = 'Повтор') <> 1 then
    raise exception 'retry created duplicate reminder';
  end if;

  -- Same owner/key is a serialized claim: reuse with a different fingerprint fails.
  begin
    perform public.care_create_reminder_atomic(
      v_owner, 'atomic-retry-key', repeat('c', 64), v_pet, 'custom',
      'Другой запрос', now(), 'none', 'test'
    );
    raise exception 'expected idempotency reuse failure';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;
end
$$;

rollback;

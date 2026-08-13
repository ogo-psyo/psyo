setup
{
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'care-concurrency@example.test', '', now(), now());
  insert into public.pets (id, owner_id, name)
  values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Тест');
}

teardown
{
  delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
}

session "first"
setup { begin; }
step "first_create" {
  select public.care_create_reminder_atomic(
    '11111111-1111-4111-8111-111111111111', 'same-concurrent-key', repeat('d', 64),
    '22222222-2222-4222-8222-222222222222', 'custom', 'Один результат',
    '2026-08-13T12:00:00Z', 'none', 'test'
  )->'reminder'->>'id' as reminder_id;
}
step "first_commit" { commit; }

session "second"
setup { begin; }
step "second_replay" {
  select public.care_create_reminder_atomic(
    '11111111-1111-4111-8111-111111111111', 'same-concurrent-key', repeat('d', 64),
    '22222222-2222-4222-8222-222222222222', 'custom', 'Один результат',
    '2026-08-13T12:00:00Z', 'none', 'test'
  )->'reminder'->>'id' as reminder_id;
}
step "second_count" {
  select count(*) from public.reminders
  where pet_id = '22222222-2222-4222-8222-222222222222' and title = 'Один результат';
}
step "second_commit" { commit; }

permutation "first_create" "second_replay"("first_commit") "first_commit" "second_count" "second_commit"

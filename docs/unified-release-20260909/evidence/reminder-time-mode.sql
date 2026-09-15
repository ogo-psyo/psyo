-- Synthetic fixtures only, pso_release_atomic_test. Roll back all rows/triggers.
begin;
create function public.qa_time_mode_fail() returns trigger language plpgsql as $$begin if new.metadata->>'timeMode'='exact' then raise exception 'QA_TIME_MODE_FAILURE';end if;return new;end $$;
create trigger qa_time_mode_fail before update on public.reminders for each row execute function public.qa_time_mode_fail();
do $$
declare own uuid:=gen_random_uuid();pet uuid:=gen_random_uuid();reminder_id uuid;created jsonb;replay jsonb;updated jsonb;finished jsonb;legacy jsonb;
begin
 insert into auth.users(id) values(own);insert into public.profiles(id) values(own);insert into public.pets(id,owner_id,name) values(pet,own,'Time QA');
 begin
  perform public.care_create_reminder_v2(own,'exact-noon-qa',repeat('a',64),pet,'custom','Полдень','2026-09-09T12:00:00Z','daily','manual','exact');raise exception 'FAULT_NOT_INJECTED';
 exception when others then if sqlerrm<>'QA_TIME_MODE_FAILURE' then raise;end if;end;
 if exists(select 1 from public.reminders where pet_id=pet) or exists(select 1 from public.care_mutations where owner_id=own) then raise exception 'PARTIAL_TIME_COMMIT';end if;
 execute 'drop trigger qa_time_mode_fail on public.reminders';
 created:=public.care_create_reminder_v2(own,'exact-noon-qa',repeat('a',64),pet,'custom','Полдень','2026-09-09T12:00:00Z','daily','manual','exact');
 reminder_id:=(created->'reminder'->>'id')::uuid;
 if created->'reminder'->>'timeMode'<>'exact' or (select metadata->>'source' from public.reminders where reminders.id=reminder_id)<>'manual' then raise exception 'MODE_OR_SOURCE_LOST';end if;
 replay:=public.care_create_reminder_v2(own,'exact-noon-qa',repeat('a',64),pet,'custom','Полдень','2026-09-09T12:00:00Z','daily','manual','exact');
 if replay<>created or (select count(*) from public.reminders where pet_id=pet)<>1 then raise exception 'DUPLICATE';end if;
 begin
  perform public.care_create_reminder_v2(own,'exact-noon-qa',repeat('b',64),pet,'custom','Полдень','2026-09-09T12:00:00Z','daily','manual','flexible');raise exception 'MODE_CONFLICT_NOT_CAUGHT';
 exception when others then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise;end if;end;
 updated:=public.care_update_reminder_atomic(own,'mode-edit-qa',repeat('b',64),reminder_id,'{"time_mode":"flexible"}');
 if updated->'reminder'->'metadata'->>'timeMode'<>'flexible' or updated->'reminder'->>'due_at' is distinct from created->'reminder'->>'dueAt' then raise exception 'MODE_EDIT_CHANGED_DATE';end if;
 -- Snoozed override must not continue masking an explicitly edited date.
 perform public.care_snooze_reminder_atomic(own,'mode-snooze-qa',repeat('c',64),reminder_id,'2026-09-11T12:00:00Z');
 updated:=public.care_update_reminder_atomic(own,'date-edit-qa',repeat('d',64),reminder_id,'{"due_at":"2026-09-12T12:00:00Z","time_mode":"exact"}');
 if updated->'reminder'->>'status'<>'active' or updated->'reminder'->>'snoozed_until' is not null then raise exception 'EDIT_MASKED_BY_SNOOZE';end if;
 finished:=public.care_complete_reminder_atomic(own,'time-complete-qa',repeat('e',64),reminder_id,'2026-09-12T12:10:00Z');
 if finished->'reminder'->'metadata'->>'timeMode'<>'exact' or (finished->'nextOccurrence'->>'dueAt')::timestamptz<>'2026-09-13T12:00:00Z'::timestamptz then raise exception 'COMPLETION_MODE_LOST';end if;
 legacy:=public.care_create_reminder_atomic(own,'legacy-time-qa',repeat('f',64),pet,'custom','Legacy','2026-09-09T12:00:00Z','none','old');
 if exists(select 1 from public.reminders where reminders.id=(legacy->'reminder'->>'id')::uuid and metadata ? 'timeMode') then raise exception 'LEGACY_MODE_GUESSED';end if;
 begin
  perform public.care_create_reminder_v2(gen_random_uuid(),'foreign-time-qa',repeat('a',64),pet,'custom','Foreign','2026-09-09T12:00:00Z','none','manual','exact');raise exception 'FOREIGN_ACCEPTED';
 exception when others then if sqlerrm<>'PET_NOT_FOUND' then raise;end if;end;
 raise notice 'PASS precision + receipt atomically, fault rollback, retry/conflict, noon vs flexible, metadata retained, snooze/edit, next occurrence, legacy unknown, foreign owner';
end $$;
rollback;

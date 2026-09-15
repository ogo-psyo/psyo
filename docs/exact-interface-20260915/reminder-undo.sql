-- Disposable pso_release_atomic_test only. Run with migration inside BEGIN/ROLLBACK.
do $$
declare foreign_owner uuid:=gen_random_uuid(); own uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); rid uuid; created jsonb; completed jsonb; undone jsonb; replay jsonb; before_row jsonb; wish uuid;
begin
 insert into auth.users(id) values(foreign_owner); insert into auth.users(id) values(own); insert into public.profiles(id) values(own); insert into public.pets(id,owner_id,name) values(pet,own,'Undo fixture');
 created:=public.care_create_reminder_atomic(own,'undo-create-one',repeat('a',64),pet,'custom','Зубы','2026-09-15T09:00:00Z','none','manual');
 rid:=(created->'reminder'->>'id')::uuid;
 select to_jsonb(r) into before_row from public.reminders r where id=rid;
 completed:=public.care_complete_reminder_atomic(own,'undo-complete-one',repeat('b',64),rid,'2026-09-15T10:00:00Z');
 undone:=public.care_undo_reminder_completion_atomic(own,'undo-revert-one',repeat('c',64),rid,'2026-09-15T10:00:00Z');
 if undone->'reminder'->>'status'<>'active' or undone->'reminder'->>'completed_at' is not null then raise exception 'ONE_SHOT_NOT_RESTORED'; end if;
 replay:=public.care_undo_reminder_completion_atomic(own,'undo-revert-one',repeat('c',64),rid,'2026-09-15T10:00:00Z');
 if replay<>undone then raise exception 'UNDO_REPLAY_CHANGED'; end if;
 if not exists(select 1 from public.reminder_events where reminder_id=rid and event_type='completed' and payload ? 'undoneAt') then raise exception 'AUDIT_LOST';end if;
 begin perform public.care_undo_reminder_completion_atomic(foreign_owner,'undo-foreign',repeat('c',64),rid,'2026-09-15T10:00:00Z');raise exception 'FOREIGN_ACCEPTED';exception when others then if sqlerrm<>'REMINDER_NOT_FOUND' then raise;end if;end;
 -- Recurrence and an existing snooze return to the exact original state.
 created:=public.care_create_reminder_atomic(own,'undo-create-daily',repeat('d',64),pet,'custom','Дневное','2026-09-15T09:00:00Z','daily','manual');rid:=(created->'reminder'->>'id')::uuid;
 perform public.care_snooze_reminder_atomic(own,'undo-snooze-daily',repeat('e',64),rid,'2026-09-15T11:00:00Z');
 select to_jsonb(r) into before_row from public.reminders r where id=rid;
 completed:=public.care_complete_reminder_atomic(own,'undo-complete-daily',repeat('f',64),rid,'2026-09-15T11:05:00Z');
 undone:=public.care_undo_reminder_completion_atomic(own,'undo-revert-daily',repeat('g',64),rid,'2026-09-15T11:05:00Z');
 if (undone->'reminder')-'updated_at' is distinct from before_row-'updated_at' then raise exception 'RECURRENCE_NOT_RESTORED';end if;
 -- A later edit cannot be overwritten, even in the same SQL transaction.
 perform public.care_complete_reminder_atomic(own,'undo-complete-later',repeat('h',64),rid,'2026-09-15T11:10:00Z');
 perform public.care_update_reminder_atomic(own,'undo-edit-later',repeat('i',64),rid,'{"title":"Changed later"}');
 begin perform public.care_undo_reminder_completion_atomic(own,'undo-conflict',repeat('j',64),rid,'2026-09-15T11:10:00Z');raise exception 'LATER_EDIT_OVERWRITTEN';exception when others then if sqlerrm<>'COMPLETION_CHANGED' then raise;end if;end;
 if exists(select 1 from public.care_mutations where owner_id=own and idempotency_key='undo-conflict') then raise exception 'FAILED_UNDO_LEFT_LEDGER';end if;
 -- A linked purchase returns only if this completion marked it bought.
 created:=public.wishlist_create_plan_atomic(own,'undo-wish-create',repeat('k',64),pet,'Корм','food','','medium','2026-09-15','2026-09-15T09:00:00Z','manual');
 rid:=(created->'reminder'->>'id')::uuid; wish:=(created->'item'->>'id')::uuid;
 perform public.care_complete_reminder_atomic(own,'undo-wish-done',repeat('l',64),rid,'2026-09-15T12:00:00Z');
 if (select status from public.wishlist_items where id=wish)<>'bought' then raise exception 'LINK_NOT_COMPLETED';end if;
 perform public.care_undo_reminder_completion_atomic(own,'undo-wish-revert',repeat('m',64),rid,'2026-09-15T12:00:00Z');
 if (select status from public.wishlist_items where id=wish)<>'wanted' then raise exception 'LINK_NOT_RESTORED';end if;
 update public.wishlist_items set status='bought',updated_at='2026-09-14T12:00:00Z' where id=wish;
 perform public.care_complete_reminder_atomic(own,'undo-wish-done2',repeat('n',64),rid,'2026-09-15T12:10:00Z');
 perform public.care_undo_reminder_completion_atomic(own,'undo-wish-revert2',repeat('o',64),rid,'2026-09-15T12:10:00Z');
 if (select status from public.wishlist_items where id=wish)<>'bought' then raise exception 'MANUAL_PURCHASE_OVERWRITTEN';end if;
 raise notice 'PASS one-shot, replay, retained audit, foreign owner, recurrence+snooze, later-edit conflict and failed-ledger rollback, linked purchase, independent purchase preserved';
end $$;

alter table public.wishlist_items
  add column if not exists planned_for date,
  add column if not exists reminder_id uuid references public.reminders(id) on delete set null;

create unique index if not exists wishlist_items_reminder_unique_idx
  on public.wishlist_items (reminder_id)
  where reminder_id is not null;

create or replace function public.wishlist_create_plan_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_pet_id uuid,
  p_title text,
  p_category text,
  p_reason text,
  p_priority text,
  p_planned_for date,
  p_due_at timestamptz,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_wishlist public.wishlist_items%rowtype;
  v_reminder public.reminders%rowtype;
  v_response jsonb;
begin
  v_replay := public.care_claim_mutation_atomic(
    p_owner_id,
    p_idempotency_key,
    'wishlist:create-plan',
    p_request_fingerprint
  );
  if v_replay is not null then return v_replay; end if;

  if not exists (
    select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id
  ) then
    raise exception 'PET_NOT_FOUND';
  end if;

  if (p_planned_for is null) <> (p_due_at is null) then
    raise exception 'INVALID_WISHLIST_PLAN_DATE';
  end if;

  if p_due_at is not null then
    insert into public.reminders (
      pet_id, type, title, due_at, recurrence, status, metadata
    ) values (
      p_pet_id,
      case when p_category = 'food' then 'food' else 'custom' end,
      case
        when lower(p_title) ~ '^(купить|заказать|забрать)' then p_title
        else 'Купить: ' || p_title
      end,
      p_due_at,
      'none',
      'active',
      jsonb_build_object('source', p_source, 'domain', 'wishlist')
    ) returning * into v_reminder;

    insert into public.reminder_events (
      reminder_id, event_type, idempotency_key, payload
    ) values (
      v_reminder.id,
      'created',
      p_idempotency_key,
      jsonb_build_object('source', p_source, 'domain', 'wishlist')
    );
  end if;

  insert into public.wishlist_items (
    pet_id, title, category, reason, priority, status, planned_for, reminder_id
  ) values (
    p_pet_id,
    btrim(p_title),
    p_category,
    nullif(btrim(coalesce(p_reason, '')), ''),
    p_priority,
    'wanted',
    p_planned_for,
    v_reminder.id
  ) returning * into v_wishlist;

  if v_reminder.id is not null then
    update public.reminders
    set metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('wishlistItemId', v_wishlist.id)
    where id = v_reminder.id;
  end if;

  v_response := jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_wishlist.id,
      'petId', v_wishlist.pet_id,
      'title', v_wishlist.title,
      'category', v_wishlist.category,
      'reason', v_wishlist.reason,
      'url', v_wishlist.url,
      'priority', v_wishlist.priority,
      'status', v_wishlist.status,
      'plannedFor', v_wishlist.planned_for,
      'reminderId', v_wishlist.reminder_id,
      'createdAt', v_wishlist.created_at
    ),
    'reminder', case when v_reminder.id is null then null else jsonb_build_object(
      'id', v_reminder.id,
      'petId', v_reminder.pet_id,
      'type', v_reminder.type,
      'title', v_reminder.title,
      'dueAt', v_reminder.due_at,
      'recurrence', v_reminder.recurrence,
      'status', v_reminder.status
    ) end,
    'mode', 'user'
  );

  return public.care_finish_mutation_atomic(
    p_owner_id,
    p_idempotency_key,
    v_response
  );
end;
$$;

revoke all on function public.wishlist_create_plan_atomic(
  uuid, text, text, uuid, text, text, text, text, date, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.wishlist_create_plan_atomic(
  uuid, text, text, uuid, text, text, text, text, date, timestamptz, text
) to service_role;

create or replace function public.wishlist_sync_completed_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.wishlist_items
    set planned_for = null, reminder_id = null, updated_at = pg_catalog.now()
    where reminder_id = old.id;
    return old;
  end if;

  if new.status = 'done' and old.status is distinct from new.status then
    update public.wishlist_items
    set status = 'bought', updated_at = pg_catalog.now()
    where reminder_id = new.id and status = 'wanted';
  end if;
  return new;
end;
$$;

drop trigger if exists wishlist_sync_completed_reminder on public.reminders;
create trigger wishlist_sync_completed_reminder
after update of status on public.reminders
for each row execute function public.wishlist_sync_completed_reminder();

drop trigger if exists wishlist_unlink_deleted_reminder on public.reminders;
create trigger wishlist_unlink_deleted_reminder
before delete on public.reminders
for each row execute function public.wishlist_sync_completed_reminder();

create or replace function public.wishlist_remove_linked_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.reminder_id is not null then
    delete from public.reminders where id = old.reminder_id;
  end if;
  return new;
end;
$$;

drop trigger if exists wishlist_remove_linked_reminder on public.wishlist_items;
create trigger wishlist_remove_linked_reminder
after update of deleted_at on public.wishlist_items
for each row
when (old.deleted_at is null and new.deleted_at is not null)
execute function public.wishlist_remove_linked_reminder();

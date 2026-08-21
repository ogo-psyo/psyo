-- Dog identity assets: private, owner/pet-bound, explicit activation and rollback.

alter table public.avatar_jobs
  add column if not exists mode text,
  add column if not exists prompt_version text,
  add column if not exists prompt_hash text,
  add column if not exists idempotency_key text,
  add column if not exists request_fingerprint text,
  add column if not exists consent_version text,
  add column if not exists input_asset_id uuid references public.avatar_assets(id) on delete set null,
  add column if not exists provider_request_id text,
  add column if not exists model text,
  add column if not exists attempts integer not null default 0,
  add column if not exists timeout_ms integer,
  add column if not exists retention_until timestamptz;

alter table public.avatar_jobs drop constraint if exists avatar_jobs_mode_check;
alter table public.avatar_jobs
  add constraint avatar_jobs_mode_check
  check (mode is null or mode in ('text_to_image','image_to_image','variation'));

create unique index if not exists avatar_jobs_owner_pet_idempotency_idx
  on public.avatar_jobs(owner_id, pet_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists avatar_jobs_owner_created_idx
  on public.avatar_jobs(owner_id, created_at desc);

alter table public.avatar_assets
  add column if not exists source_kind text,
  add column if not exists generation_mode text,
  add column if not exists parent_asset_id uuid references public.avatar_assets(id) on delete set null,
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists mime_type text,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists sha256 text,
  add column if not exists status text not null default 'draft',
  add column if not exists selected_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists retention_until timestamptz;

alter table public.avatar_assets drop constraint if exists avatar_assets_source_kind_check;
alter table public.avatar_assets
  add constraint avatar_assets_source_kind_check
  check (source_kind is null or source_kind in ('uploaded','generated'));

alter table public.avatar_assets drop constraint if exists avatar_assets_generation_mode_check;
alter table public.avatar_assets
  add constraint avatar_assets_generation_mode_check
  check (generation_mode is null or generation_mode in ('text_to_image','image_to_image','variation'));

alter table public.avatar_assets drop constraint if exists avatar_assets_status_check;
alter table public.avatar_assets
  add constraint avatar_assets_status_check
  check (status in ('draft','active','archived','failed'));

create index if not exists avatar_assets_owner_pet_created_idx
  on public.avatar_assets(owner_id, pet_id, created_at desc)
  where deleted_at is null;

alter table public.pets
  add column if not exists active_avatar_asset_id uuid references public.avatar_assets(id) on delete set null,
  add column if not exists avatar_source text not null default 'none';

alter table public.pets drop constraint if exists pets_avatar_source_check;
alter table public.pets
  add constraint pets_avatar_source_check check (avatar_source in ('none','uploaded','generated'));

-- Preserve existing owner-selected images when the lifecycle columns are introduced.
update public.pets
set avatar_source = 'uploaded'
where active_avatar_asset_id is null
  and avatar_url is not null
  and length(trim(avatar_url)) > 0
  and avatar_source = 'none';

create table if not exists public.pet_avatar_selections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  asset_id uuid references public.avatar_assets(id) on delete set null,
  source text not null check (source in ('none','uploaded','generated')),
  activated_at timestamptz not null default now()
);

create index if not exists pet_avatar_selections_owner_pet_idx
  on public.pet_avatar_selections(owner_id, pet_id, activated_at desc);

alter table public.pet_avatar_selections enable row level security;
drop policy if exists "avatar selections owner" on public.pet_avatar_selections;

-- Avatar lifecycle tables are BFF-only. Browser clients must not be able to
-- manufacture owner/pet relationships with direct Supabase writes.
drop policy if exists "avatar jobs owner" on public.avatar_jobs;
drop policy if exists "avatar assets owner" on public.avatar_assets;
revoke all on public.avatar_jobs, public.avatar_assets, public.pet_avatar_selections from anon, authenticated;

create or replace function public.assert_avatar_row_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.pets p where p.id = new.pet_id and p.owner_id = new.owner_id) then
    raise exception 'AVATAR_OWNER_PET_MISMATCH';
  end if;
  if tg_table_name = 'avatar_assets' and new.job_id is not null and not exists (
    select 1 from public.avatar_jobs j
    where j.id = new.job_id and j.owner_id = new.owner_id and j.pet_id = new.pet_id
  ) then
    raise exception 'AVATAR_JOB_ASSET_MISMATCH';
  end if;
  if tg_table_name = 'pet_avatar_selections' and new.asset_id is not null and not exists (
    select 1 from public.avatar_assets a
    where a.id = new.asset_id and a.owner_id = new.owner_id and a.pet_id = new.pet_id
  ) then
    raise exception 'AVATAR_SELECTION_ASSET_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists avatar_jobs_ownership_guard on public.avatar_jobs;
create trigger avatar_jobs_ownership_guard before insert or update of owner_id, pet_id
on public.avatar_jobs for each row execute function public.assert_avatar_row_ownership();
drop trigger if exists avatar_assets_ownership_guard on public.avatar_assets;
create trigger avatar_assets_ownership_guard before insert or update of owner_id, pet_id, job_id
on public.avatar_assets for each row execute function public.assert_avatar_row_ownership();
drop trigger if exists pet_avatar_selections_ownership_guard on public.pet_avatar_selections;
create trigger pet_avatar_selections_ownership_guard before insert or update of owner_id, pet_id
on public.pet_avatar_selections for each row execute function public.assert_avatar_row_ownership();

create or replace function public.assert_pet_active_avatar()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.active_avatar_asset_id is not null and not exists (
    select 1 from public.avatar_assets a
    where a.id = new.active_avatar_asset_id and a.owner_id = new.owner_id and a.pet_id = new.id
      and a.deleted_at is null and a.asset_type = 'avatar_image'
  ) then raise exception 'PET_ACTIVE_AVATAR_MISMATCH'; end if;
  return new;
end;
$$;
drop trigger if exists pets_active_avatar_guard on public.pets;
create trigger pets_active_avatar_guard before insert or update of active_avatar_asset_id, owner_id
on public.pets for each row execute function public.assert_pet_active_avatar();

create or replace function public.activate_pet_avatar_for_owner(
  p_owner_id uuid,
  p_pet_id uuid,
  p_asset_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := 'none';
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id) then
    raise exception 'PET_NOT_FOUND';
  end if;

  if p_asset_id is not null then
    select source_kind into v_source
      from public.avatar_assets
      where id = p_asset_id
        and pet_id = p_pet_id
        and owner_id = p_owner_id
        and deleted_at is null
        and source_kind in ('uploaded','generated')
        and asset_type = 'avatar_image'
        and moderation_status in ('approved','not_required')
        and status in ('draft','archived','active')
        and storage_bucket = 'pet-avatar-private'
        and storage_path is not null;
    if v_source is null then raise exception 'AVATAR_ASSET_NOT_FOUND'; end if;
  end if;

  update public.avatar_assets
    set status = 'archived', retention_until = now() + interval '30 days'
    where pet_id = p_pet_id and owner_id = p_owner_id and status = 'active'
      and (p_asset_id is null or id <> p_asset_id);

  if p_asset_id is not null then
    update public.avatar_assets
      set status = 'active', selected_at = now(), retention_until = null
      where id = p_asset_id and pet_id = p_pet_id and owner_id = p_owner_id;
  end if;

  update public.pets
    set active_avatar_asset_id = p_asset_id, avatar_source = v_source, updated_at = now()
    where id = p_pet_id and owner_id = p_owner_id;

  insert into public.pet_avatar_selections(owner_id, pet_id, asset_id, source)
  values (p_owner_id, p_pet_id, p_asset_id, v_source);

  return jsonb_build_object('petId', p_pet_id, 'activeAssetId', p_asset_id, 'source', v_source);
end;
$$;

revoke all on function public.activate_pet_avatar_for_owner(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_pet_avatar_for_owner(uuid, uuid, uuid) to service_role;

create or replace function public.claim_avatar_job_for_owner(
  p_owner_id uuid,
  p_pet_id uuid,
  p_style_id text,
  p_mode text,
  p_prompt_version text,
  p_prompt_hash text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_consent_version text,
  p_input_asset_id uuid,
  p_provider text,
  p_model text,
  p_timeout_ms integer,
  p_estimated_cost_cents integer,
  p_daily_budget_cents integer,
  p_hourly_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.avatar_jobs;
  v_job public.avatar_jobs;
  v_owner_count integer;
  v_reserved integer;
begin
  perform pg_advisory_xact_lock(hashtext('avatar-global-budget'));
  perform pg_advisory_xact_lock(hashtext(p_owner_id::text));

  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id) then
    raise exception 'PET_NOT_FOUND';
  end if;

  select * into v_existing from public.avatar_jobs
    where owner_id = p_owner_id and pet_id = p_pet_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('replayed', true, 'jobId', v_existing.id, 'status', v_existing.status);
  end if;

  select count(*) into v_owner_count from public.avatar_jobs
    where owner_id = p_owner_id and created_at >= now() - interval '1 hour';
  if v_owner_count >= p_hourly_limit then raise exception 'AVATAR_OWNER_QUOTA'; end if;

  select coalesce(sum(cost_cents), 0) into v_reserved from public.avatar_jobs
    where created_at >= now() - interval '24 hours';
  if v_reserved + p_estimated_cost_cents > p_daily_budget_cents then
    raise exception 'AVATAR_DAILY_BUDGET_REACHED';
  end if;

  insert into public.avatar_jobs(
    owner_id, pet_id, style_id, status, mode, prompt_version, prompt_hash,
    idempotency_key, request_fingerprint, consent_version, input_asset_id,
    provider, model, attempts, timeout_ms, cost_cents, started_at, retention_until
  ) values (
    p_owner_id, p_pet_id, p_style_id, 'validating', p_mode, p_prompt_version, p_prompt_hash,
    p_idempotency_key, p_request_fingerprint, p_consent_version, p_input_asset_id,
    p_provider, p_model, 1, p_timeout_ms, p_estimated_cost_cents, now(), now() + interval '90 days'
  ) returning * into v_job;

  return jsonb_build_object('replayed', false, 'jobId', v_job.id, 'status', v_job.status);
end;
$$;

revoke all on function public.claim_avatar_job_for_owner(uuid,uuid,text,text,text,text,text,text,text,uuid,text,text,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_avatar_job_for_owner(uuid,uuid,text,text,text,text,text,text,text,uuid,text,text,integer,integer,integer,integer) to service_role;

create table if not exists public.avatar_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  sha256 text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  status text not null default 'claimed' check (status in ('claimed','ready','failed')),
  asset_id uuid references public.avatar_assets(id) on delete set null,
  claimed_at timestamptz not null default now(),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.avatar_upload_reservations drop constraint if exists avatar_upload_reservations_owner_id_pet_id_sha256_key;
create index if not exists avatar_upload_reservations_owner_sha_idx
on public.avatar_upload_reservations(owner_id, pet_id, sha256, claimed_at desc);
alter table public.avatar_upload_reservations enable row level security;
revoke all on public.avatar_upload_reservations from anon, authenticated;

drop trigger if exists avatar_upload_reservations_ownership_guard on public.avatar_upload_reservations;
create trigger avatar_upload_reservations_ownership_guard before insert or update of owner_id, pet_id
on public.avatar_upload_reservations for each row execute function public.assert_avatar_row_ownership();

create or replace function public.claim_avatar_upload_for_owner(
  p_owner_id uuid,
  p_pet_id uuid,
  p_sha256 text,
  p_size_bytes integer,
  p_hourly_limit integer,
  p_daily_bytes_limit integer,
  p_pet_draft_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.avatar_assets;
  v_in_progress public.avatar_upload_reservations;
  v_hourly integer;
  v_daily_bytes bigint;
  v_pet_drafts integer;
  v_reservation public.avatar_upload_reservations;
begin
  perform pg_advisory_xact_lock(hashtext('avatar-upload:' || p_owner_id::text));
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = p_owner_id) then
    raise exception 'PET_NOT_FOUND';
  end if;
  if p_size_bytes <= 0 or p_size_bytes > 8388608 then raise exception 'PHOTO_TOO_LARGE'; end if;

  select * into v_existing from public.avatar_assets
  where owner_id = p_owner_id and pet_id = p_pet_id and sha256 = p_sha256
    and asset_type = 'avatar_image' and source_kind = 'uploaded' and deleted_at is null
  order by created_at desc limit 1;
  if found then return jsonb_build_object('replayed', true, 'assetId', v_existing.id); end if;

  select * into v_in_progress from public.avatar_upload_reservations
  where owner_id = p_owner_id and pet_id = p_pet_id and sha256 = p_sha256
    and status = 'claimed' and claimed_at >= now() - interval '5 minutes'
  order by claimed_at desc limit 1;
  if found then return jsonb_build_object('inProgress', true, 'reservationId', v_in_progress.id); end if;

  select count(*) into v_hourly from public.avatar_upload_reservations
  where owner_id = p_owner_id and claimed_at >= now() - interval '1 hour';
  if v_hourly >= p_hourly_limit then raise exception 'AVATAR_UPLOAD_RATE_LIMIT'; end if;

  select coalesce(sum(size_bytes), 0) into v_daily_bytes from public.avatar_upload_reservations
  where owner_id = p_owner_id and claimed_at >= now() - interval '24 hours';
  if v_daily_bytes + p_size_bytes > p_daily_bytes_limit then raise exception 'AVATAR_UPLOAD_STORAGE_LIMIT'; end if;

  select count(*) into v_pet_drafts from public.avatar_assets
  where owner_id = p_owner_id and pet_id = p_pet_id and status = 'draft' and deleted_at is null;
  if v_pet_drafts >= p_pet_draft_limit then raise exception 'AVATAR_PET_DRAFT_LIMIT'; end if;

  insert into public.avatar_upload_reservations(owner_id, pet_id, sha256, size_bytes)
  values (p_owner_id, p_pet_id, p_sha256, p_size_bytes)
  returning * into v_reservation;
  return jsonb_build_object('replayed', false, 'reservationId', v_reservation.id);
end;
$$;

revoke all on function public.claim_avatar_upload_for_owner(uuid,uuid,text,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_avatar_upload_for_owner(uuid,uuid,text,integer,integer,integer,integer) to service_role;

create or replace function public.finalize_avatar_upload_for_owner(
  p_owner_id uuid,
  p_pet_id uuid,
  p_reservation_id uuid,
  p_asset_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.avatar_assets a
    where a.id = p_asset_id and a.owner_id = p_owner_id and a.pet_id = p_pet_id
      and a.asset_type = 'avatar_image' and a.source_kind = 'uploaded' and a.deleted_at is null
  ) then raise exception 'AVATAR_ASSET_NOT_FOUND'; end if;
  update public.avatar_upload_reservations
  set status = 'ready', asset_id = p_asset_id, finalized_at = now()
  where id = p_reservation_id and owner_id = p_owner_id and pet_id = p_pet_id and status = 'claimed';
  if not found then raise exception 'AVATAR_UPLOAD_RESERVATION_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.finalize_avatar_upload_for_owner(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.finalize_avatar_upload_for_owner(uuid,uuid,uuid,uuid) to service_role;

create index if not exists avatar_assets_retention_idx on public.avatar_assets(retention_until)
where deleted_at is null and retention_until is not null;
create index if not exists avatar_jobs_retention_idx on public.avatar_jobs(retention_until)
where retention_until is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-avatar-private',
  'pet-avatar-private',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Browser clients never access the bucket directly. Server routes use the service role
-- after checking the verified owner and dog boundary.

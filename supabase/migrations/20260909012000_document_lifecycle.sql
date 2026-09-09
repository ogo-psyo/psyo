alter table public.pet_documents
  add column lifecycle text not null default 'ready' check(lifecycle in ('pending','ready','deleting','deleted')),
  add column upload_owner_id uuid references auth.users(id) on delete cascade,
  add column upload_key text,
  add column upload_fingerprint text,
  add column content_sha256 text,
  add column lifecycle_updated_at timestamptz not null default now(),
  add column next_reconcile_at timestamptz not null default (now() + interval '10 minutes');
create unique index pet_document_upload_once on public.pet_documents(upload_owner_id,upload_key) where upload_key is not null;
create index pet_document_reconciliation on public.pet_documents(lifecycle,next_reconcile_at) where lifecycle <> 'ready';

create or replace function public.reserve_pet_document_upload(
  p_owner_id uuid,p_pet_id uuid,p_key text,p_fingerprint text,p_content_sha256 text,p_metadata jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.pet_documents%rowtype; v_id uuid := gen_random_uuid();
begin
  if p_key is null or length(p_key) not between 8 and 128
    or p_fingerprint is null or p_content_sha256 is null
    or length(p_fingerprint) <> 64 or length(p_content_sha256) <> 64 then raise exception 'INVALID_DOCUMENT_REQUEST'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text || ':' || p_key,0));
  perform 1 from public.pets where id=p_pet_id and owner_id=p_owner_id for share;
  if not found then raise exception 'PET_NOT_FOUND'; end if;
  select * into v_row from public.pet_documents where upload_owner_id=p_owner_id and upload_key=p_key for update;
  if found then
    if v_row.upload_fingerprint <> p_fingerprint or v_row.pet_id <> p_pet_id then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_row.lifecycle in ('deleting','deleted') then raise exception 'DOCUMENT_REMOVED'; end if;
    if v_row.lifecycle = 'pending' then
      update public.pet_documents set lifecycle_updated_at=clock_timestamp(),next_reconcile_at=clock_timestamp()+interval '10 minutes'
        where id=v_row.id returning * into v_row;
    end if;
    return to_jsonb(v_row);
  end if;
  insert into public.pet_documents(id,pet_id,kind,title,clinic,document_date,original_name,mime_type,size_bytes,storage_bucket,storage_path,
    lifecycle,upload_owner_id,upload_key,upload_fingerprint,content_sha256)
    values(v_id,p_pet_id,p_metadata->>'kind',p_metadata->>'title',p_metadata->>'clinic',(p_metadata->>'document_date')::date,
      p_metadata->>'original_name',p_metadata->>'mime_type',(p_metadata->>'size_bytes')::integer,'pet-documents',
      p_owner_id::text || '/' || p_pet_id::text || '/' || v_id::text,
      'pending',p_owner_id,p_key,p_fingerprint,p_content_sha256) returning * into v_row;
  return to_jsonb(v_row);
end $$;
revoke all on function public.reserve_pet_document_upload(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_pet_document_upload(uuid,uuid,text,text,text,jsonb) to service_role;

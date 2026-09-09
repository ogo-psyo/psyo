begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); first_row jsonb; replay jsonb;
  metadata jsonb:='{"kind":"analysis","title":"Synthetic","original_name":"test.pdf","mime_type":"application/pdf","size_bytes":9}';
begin
  insert into auth.users(id) values(a),(b);
  insert into public.pets(id,owner_id,name) values(pet,a,'Test');
  first_row:=public.reserve_pet_document_upload(a,pet,'document-key',repeat('a',64),repeat('b',64),metadata);
  replay:=public.reserve_pet_document_upload(a,pet,'document-key',repeat('a',64),repeat('b',64),metadata);
  if first_row->>'id' <> replay->>'id' or first_row->>'storage_path' <> replay->>'storage_path'
    or (select count(*) from public.pet_documents where pet_id=pet) <> 1 or first_row->>'lifecycle' <> 'pending' then
    raise exception 'reservation repeated or exposed unfinished document';
  end if;
  begin
    perform public.reserve_pet_document_upload(a,pet,'document-key',repeat('c',64),repeat('b',64),metadata);
    raise exception 'expected fingerprint conflict';
  exception when others then if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if; end;
  begin
    perform public.reserve_pet_document_upload(b,pet,'document-key',repeat('a',64),repeat('b',64),metadata);
    raise exception 'expected owner rejection';
  exception when others then if sqlerrm <> 'PET_NOT_FOUND' then raise; end if; end;
  update public.pet_documents set lifecycle='deleted' where id=(first_row->>'id')::uuid;
  begin
    perform public.reserve_pet_document_upload(a,pet,'document-key',repeat('a',64),repeat('b',64),metadata);
    raise exception 'deleted document resurrected';
  exception when others then if sqlerrm <> 'DOCUMENT_REMOVED' then raise; end if; end;
  if has_function_privilege('authenticated','public.reserve_pet_document_upload(uuid,uuid,text,text,text,jsonb)','EXECUTE') then
    raise exception 'privileged function accessible to client';
  end if;
  raise notice 'PASS document reservations: stable ID/path, mismatch conflict, owner boundary, no resurrection, RPC grants';
end $$;
rollback;

begin;
create schema profile_test;
create function profile_test.fail_write() returns trigger language plpgsql as $$
begin
  if current_setting('pso.test_fail_profile',true) = TG_TABLE_NAME then raise exception 'TEST_PROFILE_FAILURE'; end if;
  return new;
end $$;
create trigger profile_test_social before insert or update on public.social_profiles for each row execute function profile_test.fail_write();
create trigger profile_test_receipt before update on public.care_mutations for each row execute function profile_test.fail_write();
do $$
declare
  owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid(); pet uuid := gen_random_uuid();
  first_result jsonb; replay jsonb; target_table text;
  p jsonb := '{"name":"Changed","breed_id":null,"breed_group_id":null}';
  passport jsonb := '{"diet":"New diet","vaccine_status":"unknown","parasite_status":"unknown"}';
  social jsonb := '{"social_mode":"ask_first","triggers":["bikes"]}';
begin
  insert into auth.users(id) values(owner_a),(owner_b);
  insert into public.pets(id,owner_id,name,is_public,public_slug,avatar_url) values(pet,owner_a,'Original',false,'fixture-profile','https://example.test/avatar');
  insert into public.pet_passports(pet_id,diet,vet_contact) values(pet,'Original diet','Keep contact');
  foreach target_table in array array['social_profiles','care_mutations'] loop
    perform set_config('pso.test_fail_profile',target_table,true);
    begin
      perform public.update_pet_profile_atomic(owner_a,pet,0,'profile-failure-'||target_table,repeat('a',64),p,passport,social);
      raise exception 'expected failure';
    exception when others then if sqlerrm <> 'TEST_PROFILE_FAILURE' then raise; end if; end;
    perform set_config('pso.test_fail_profile','',true);
    if not exists(select 1 from public.pets where id=pet and name='Original' and profile_version=0)
      or not exists(select 1 from public.pet_passports where pet_id=pet and diet='Original diet')
      or exists(select 1 from public.social_profiles where pet_id=pet)
      or exists(select 1 from public.care_mutations where owner_id=owner_a) then
      raise exception 'partial save survived % failure',target_table;
    end if;
  end loop;
  first_result := public.update_pet_profile_atomic(owner_a,pet,0,'profile-success',repeat('b',64),p,passport,social);
  replay := public.update_pet_profile_atomic(owner_a,pet,0,'profile-success',repeat('b',64),p,passport,social);
  if replay <> first_result or first_result#>>'{pet,profile_version}' <> '1' then raise exception 'profile replay/version failed'; end if;
  if first_result#>>'{passport,vet_contact}' <> 'Keep contact' or first_result#>>'{pet,avatar_url}' <> 'https://example.test/avatar'
    or first_result#>>'{pet,public_slug}' <> 'fixture-profile' or first_result#>>'{pet,is_public}' <> 'false' then
    raise exception 'unrelated properties overwritten';
  end if;
  begin
    perform public.update_pet_profile_atomic(owner_a,pet,0,'stale-device-key',repeat('c',64),p,passport,social);
    raise exception 'expected stale conflict';
  exception when others then if sqlerrm <> 'PROFILE_VERSION_CONFLICT' then raise; end if; end;
  begin
    perform public.update_pet_profile_atomic(owner_b,pet,1,'foreign-owner-key',repeat('d',64),p,passport,social);
    raise exception 'expected foreign owner rejection';
  exception when others then if sqlerrm <> 'PET_NOT_FOUND' then raise; end if; end;
  if has_function_privilege('authenticated','public.update_pet_profile_atomic(uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb)','EXECUTE') then
    raise exception 'client can invoke privileged update';
  end if;
  raise notice 'PASS profile: child/receipt rollback, replay, stale-device conflict, ownership, preserved unrelated fields';
end $$;
rollback;

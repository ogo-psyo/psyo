alter table public.pets add column if not exists profile_version bigint not null default 0;
create or replace function public.increment_pet_profile_version() returns trigger
language plpgsql set search_path = '' as $$
begin new.profile_version := old.profile_version + 1; return new; end $$;
create trigger pets_profile_version before update on public.pets
for each row execute function public.increment_pet_profile_version();

create or replace function public.update_pet_profile_atomic(
  p_owner_id uuid, p_pet_id uuid, p_expected_version bigint,
  p_idempotency_key text, p_request_fingerprint text,
  p_pet jsonb, p_passport jsonb, p_social jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pet public.pets%rowtype;
  v_passport public.pet_passports%rowtype;
  v_social public.social_profiles%rowtype;
  v_replay jsonb;
begin
  -- Serialize retries before taking the same domain lock as other profile saves.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0));
  select * into v_pet from public.pets where id=p_pet_id and owner_id=p_owner_id for update;
  if not found then raise exception 'PET_NOT_FOUND'; end if;
  v_replay := public.care_claim_mutation_atomic(p_owner_id,p_idempotency_key,'profile:update',p_request_fingerprint);
  if v_replay is not null then return v_replay; end if;
  if p_expected_version is null or v_pet.profile_version <> p_expected_version then
    raise exception 'PROFILE_VERSION_CONFLICT';
  end if;
  if nullif(trim(p_pet->>'name'),'') is null then raise exception 'INVALID_PET_NAME'; end if;
  update public.pets set
    name=trim(p_pet->>'name'), breed_id=p_pet->>'breed_id', breed_group_id=p_pet->>'breed_group_id',
    custom_breed=p_pet->>'custom_breed', sex=p_pet->>'sex', life_stage=p_pet->>'life_stage',
    weight_kg=(p_pet->>'weight_kg')::numeric,
    avatar_url=case when p_pet ? 'avatar_url' then p_pet->>'avatar_url' else avatar_url end,
    photo_urls=case when p_pet ? 'photo_urls' then array(select jsonb_array_elements_text(p_pet->'photo_urls')) else photo_urls end
    where id=p_pet_id returning * into v_pet;
  insert into public.pet_passports(pet_id,microchip,vet_clinic,diet,allergies,medication,health_notes,vaccine_status,parasite_status)
    values(p_pet_id,p_passport->>'microchip',p_passport->>'vet_clinic',p_passport->>'diet',p_passport->>'allergies',
      p_passport->>'medication',p_passport->>'health_notes',p_passport->>'vaccine_status',p_passport->>'parasite_status')
    on conflict(pet_id) do update set microchip=excluded.microchip,vet_clinic=excluded.vet_clinic,diet=excluded.diet,
      allergies=excluded.allergies,medication=excluded.medication,health_notes=excluded.health_notes,
      vaccine_status=excluded.vaccine_status,parasite_status=excluded.parasite_status,updated_at=pg_catalog.now()
    returning * into v_passport;
  insert into public.social_profiles(pet_id,social_mode,temperament,energy_level,play_style,trainability,
      child_friendly,dog_friendly,cat_friendly,triggers,alone_time_note)
    values(p_pet_id,p_social->>'social_mode',p_social->>'temperament',p_social->>'energy_level',p_social->>'play_style',
      p_social->>'trainability',p_social->>'child_friendly',p_social->>'dog_friendly',p_social->>'cat_friendly',
      array(select jsonb_array_elements_text(p_social->'triggers')),p_social->>'alone_time_note')
    on conflict(pet_id) do update set social_mode=excluded.social_mode,temperament=excluded.temperament,
      energy_level=excluded.energy_level,play_style=excluded.play_style,trainability=excluded.trainability,
      child_friendly=excluded.child_friendly,dog_friendly=excluded.dog_friendly,cat_friendly=excluded.cat_friendly,
      triggers=excluded.triggers,alone_time_note=excluded.alone_time_note,updated_at=pg_catalog.now()
    returning * into v_social;
  return public.care_finish_mutation_atomic(p_owner_id,p_idempotency_key,
    jsonb_build_object('pet',to_jsonb(v_pet),'passport',to_jsonb(v_passport),'social',to_jsonb(v_social)));
end $$;
revoke all on function public.update_pet_profile_atomic(uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.update_pet_profile_atomic(uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb) to service_role;

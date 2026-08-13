-- Persist the owner's selected dog without making that selection public.
alter table public.profiles
  add column if not exists active_pet_id uuid references public.pets(id) on delete set null;

create index if not exists profiles_active_pet_idx
  on public.profiles(active_pet_id)
  where active_pet_id is not null;

create table if not exists public.pet_profile_commands (
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_fingerprint text not null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, idempotency_key)
);

alter table public.pet_profile_commands enable row level security;
revoke all on table public.pet_profile_commands from public, anon, authenticated;
grant all on table public.pet_profile_commands to service_role;

create or replace function public.create_pet_profile_for_owner(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_pet jsonb,
  p_passport jsonb,
  p_social jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_command public.pet_profile_commands%rowtype;
  v_pet public.pets%rowtype;
begin
  if p_owner_id is null
    or length(p_idempotency_key) < 8
    or length(p_idempotency_key) > 128
    or nullif(trim(p_pet->>'name'), '') is null
  then
    raise exception 'INVALID_PET_CREATION_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0));

  select * into v_command
  from public.pet_profile_commands
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;

  if found then
    if v_command.request_fingerprint <> p_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into strict v_pet from public.pets where id = v_command.pet_id and owner_id = p_owner_id;
    return jsonb_build_object('replayed', true, 'pet', to_jsonb(v_pet));
  end if;

  insert into public.pets (
    owner_id, name, species, breed_id, breed_group_id, custom_breed, sex, life_stage,
    weight_kg, avatar_url, photo_urls, public_slug, is_public
  ) values (
    p_owner_id,
    trim(p_pet->>'name'),
    'dog',
    coalesce(nullif(p_pet->>'breed_id', ''), 'mixed'),
    coalesce(nullif(p_pet->>'breed_group_id', ''), 'mixed'),
    nullif(p_pet->>'custom_breed', ''),
    nullif(p_pet->>'sex', ''),
    nullif(p_pet->>'life_stage', ''),
    nullif(p_pet->>'weight_kg', '')::numeric,
    nullif(p_pet->>'avatar_url', ''),
    array(select jsonb_array_elements_text(coalesce(p_pet->'photo_urls', '[]'::jsonb))),
    coalesce(nullif(p_pet->>'public_slug', ''), 'pet-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    false
  ) returning * into v_pet;

  insert into public.pet_passports (
    pet_id, microchip, vet_clinic, diet, allergies, medication, health_notes,
    vaccine_status, parasite_status
  ) values (
    v_pet.id,
    nullif(p_passport->>'microchip', ''),
    nullif(p_passport->>'vet_clinic', ''),
    nullif(p_passport->>'diet', ''),
    nullif(p_passport->>'allergies', ''),
    nullif(p_passport->>'medication', ''),
    nullif(p_passport->>'health_notes', ''),
    coalesce(nullif(p_passport->>'vaccine_status', ''), 'unknown'),
    coalesce(nullif(p_passport->>'parasite_status', ''), 'unknown')
  );

  insert into public.social_profiles (
    pet_id, social_mode, temperament, energy_level, play_style, trainability,
    child_friendly, dog_friendly, cat_friendly, triggers, alone_time_note
  ) values (
    v_pet.id,
    coalesce(nullif(p_social->>'social_mode', ''), 'ask_first'),
    nullif(p_social->>'temperament', ''),
    nullif(p_social->>'energy_level', ''),
    nullif(p_social->>'play_style', ''),
    nullif(p_social->>'trainability', ''),
    nullif(p_social->>'child_friendly', ''),
    nullif(p_social->>'dog_friendly', ''),
    nullif(p_social->>'cat_friendly', ''),
    array(select jsonb_array_elements_text(coalesce(p_social->'triggers', '[]'::jsonb))),
    nullif(p_social->>'alone_time_note', '')
  );

  insert into public.pet_profile_commands (owner_id, idempotency_key, request_fingerprint, pet_id)
  values (p_owner_id, p_idempotency_key, p_request_fingerprint, v_pet.id);

  return jsonb_build_object('replayed', false, 'pet', to_jsonb(v_pet));
end;
$$;

revoke all on function public.create_pet_profile_for_owner(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_pet_profile_for_owner(uuid, text, text, jsonb, jsonb, jsonb) to service_role;

-- Older builds could race and leave more than one unrevoked card for a dog.
-- Revoke every older duplicate before enforcing the lifecycle invariant.
with ranked_cards as (
  select
    id,
    row_number() over (
      partition by pet_id
      order by updated_at desc nulls last, created_at desc, id desc
    ) as active_rank
  from public.dog_cards
  where revoked_at is null
)
update public.dog_cards as card
set revoked_at = now()
from ranked_cards
where card.id = ranked_cards.id
  and ranked_cards.active_rank > 1;

create unique index if not exists dog_cards_one_active_per_pet_idx
  on public.dog_cards(pet_id)
  where revoked_at is null;

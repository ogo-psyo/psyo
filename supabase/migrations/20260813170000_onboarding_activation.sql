create table if not exists public.onboarding_activations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_fingerprint text not null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

alter table public.onboarding_activations enable row level security;
revoke all on table public.onboarding_activations from anon, authenticated;
grant select, insert, update, delete on table public.onboarding_activations to service_role;

create or replace function public.activate_first_care_loop(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_pet jsonb,
  p_passport jsonb,
  p_social jsonb,
  p_reminder jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activation public.onboarding_activations%rowtype;
  v_pet public.pets%rowtype;
  v_reminder public.reminders%rowtype;
begin
  if p_owner_id is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'INVALID_ONBOARDING_ACTIVATION_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text, 0));

  select * into v_activation
  from public.onboarding_activations
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;

  if found then
    if v_activation.request_fingerprint <> p_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into strict v_pet from public.pets where id = v_activation.pet_id and owner_id = p_owner_id;
    select * into strict v_reminder from public.reminders where id = v_activation.reminder_id and pet_id = v_pet.id;
    return jsonb_build_object('replayed', true, 'pet', to_jsonb(v_pet), 'reminder', to_jsonb(v_reminder));
  end if;

  if exists (select 1 from public.pets where owner_id = p_owner_id) then
    raise exception 'ONBOARDING_ALREADY_ACTIVATED';
  end if;

  insert into public.pets (
    owner_id, name, species, breed_id, breed_group_id, custom_breed, sex, life_stage,
    weight_kg, avatar_url, photo_urls, public_slug, is_public
  ) values (
    p_owner_id,
    p_pet->>'name',
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
    coalesce((p_pet->>'is_public')::boolean, false)
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

  insert into public.reminders (pet_id, type, title, due_at, recurrence, status, metadata)
  values (
    v_pet.id,
    coalesce(nullif(p_reminder->>'type', ''), 'custom'),
    p_reminder->>'title',
    (p_reminder->>'due_at')::timestamptz,
    coalesce(nullif(p_reminder->>'recurrence', ''), 'none'),
    'active',
    jsonb_build_object('source', coalesce(nullif(p_reminder->>'source', ''), 'onboarding'))
  ) returning * into v_reminder;

  insert into public.reminder_events (reminder_id, event_type, payload)
  values (v_reminder.id, 'created', jsonb_build_object('source', 'onboarding'));

  insert into public.onboarding_activations (
    owner_id, idempotency_key, request_fingerprint, pet_id, reminder_id
  ) values (
    p_owner_id, p_idempotency_key, p_request_fingerprint, v_pet.id, v_reminder.id
  );

  return jsonb_build_object('replayed', false, 'pet', to_jsonb(v_pet), 'reminder', to_jsonb(v_reminder));
end;
$$;

revoke all on function public.activate_first_care_loop(uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.activate_first_care_loop(uuid, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

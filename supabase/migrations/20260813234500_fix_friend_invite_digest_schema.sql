-- pgcrypto is installed in the extensions schema on hosted Supabase.
-- Recreate invite consumption with the digest function explicitly qualified.
create or replace function public.consume_social_friend_invite(
  p_token_hash text,
  p_recipient_owner_id uuid,
  p_recipient_pet_id uuid,
  p_idempotency_key text,
  p_recipient_contact_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.social_friend_invites%rowtype;
  v_request public.social_match_requests%rowtype;
begin
  select * into v_invite from public.social_friend_invites
  where token_hash = p_token_hash for update;
  if not found or v_invite.expires_at <= now() then
    raise exception 'INVITE_GONE';
  end if;
  if v_invite.used_at is not null then
    if v_invite.used_by_owner_id = p_recipient_owner_id and v_invite.request_id is not null then
      select * into v_request from public.social_match_requests
      where id = v_invite.request_id
        and recipient_owner_id = p_recipient_owner_id
        and idempotency_key = p_idempotency_key;
      if found and v_request.recipient_pet_id = p_recipient_pet_id then
        return jsonb_build_object('request', to_jsonb(v_request), 'replayed', true);
      end if;
    end if;
    raise exception 'INVITE_GONE';
  end if;
  if v_invite.inviter_owner_id = p_recipient_owner_id then
    raise exception 'INVITE_SELF_ACCEPT_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.pets
    where id = p_recipient_pet_id and owner_id = p_recipient_owner_id
  ) then
    raise exception 'RECIPIENT_PET_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.social_blocks
    where (blocker_owner_id = v_invite.inviter_owner_id and blocked_owner_id = p_recipient_owner_id)
       or (blocker_owner_id = p_recipient_owner_id and blocked_owner_id = v_invite.inviter_owner_id)
  ) then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;
  insert into public.social_match_requests (
    sender_owner_id, recipient_owner_id, sender_pet_id, recipient_pet_id,
    scenario, source, status, idempotency_key, request_fingerprint,
    sender_contact_username, recipient_contact_username,
    sender_contact_verified_at, recipient_contact_verified_at
  ) values (
    v_invite.inviter_owner_id, p_recipient_owner_id, v_invite.inviter_pet_id, p_recipient_pet_id,
    v_invite.scenario, 'invite', 'pending', p_idempotency_key,
    pg_catalog.encode(extensions.digest(
      v_invite.inviter_pet_id::text || ':' || p_recipient_pet_id::text || ':' || v_invite.scenario || ':invite',
      'sha256'
    ), 'hex'),
    v_invite.inviter_contact_username, p_recipient_contact_username,
    v_invite.inviter_contact_verified_at, now()
  ) returning * into v_request;

  update public.social_friend_invites set
    used_at = now(), used_by_owner_id = p_recipient_owner_id,
    recipient_pet_id = p_recipient_pet_id, request_id = v_request.id
  where id = v_invite.id;

  return jsonb_build_object('request', to_jsonb(v_request));
end;
$$;

revoke all on function public.consume_social_friend_invite(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_social_friend_invite(text, uuid, uuid, text, text) to service_role;

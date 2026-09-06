create table if not exists public.social_meeting_proposals (
 id uuid primary key,
 request_id uuid not null references public.social_match_requests(id) on delete cascade,
 author_owner_id uuid not null references auth.users(id) on delete cascade,
 author_pet_id uuid not null references public.pets(id) on delete cascade,
 kind text not null check (kind in ('place','route')),
 source_id text not null,
 snapshot jsonb not null,
 fingerprint text not null,
 created_at timestamptz not null default now()
);
alter table public.social_meeting_proposals enable row level security;
-- Contact/connection state and source visibility are checked on every API read.
revoke all on public.social_meeting_proposals from anon,authenticated;
grant all on public.social_meeting_proposals to service_role;
create index if not exists social_meeting_request_created on public.social_meeting_proposals(request_id,created_at desc);

create or replace function public.validate_meeting_connection() returns trigger
language plpgsql set search_path=public as $$
declare connection public.social_match_requests%rowtype;
begin
 select * into connection from public.social_match_requests where id=new.request_id for update;
 if not found or connection.status<>'accepted' or not (
  (new.author_owner_id=connection.sender_owner_id and new.author_pet_id=connection.sender_pet_id) or
  (new.author_owner_id=connection.recipient_owner_id and new.author_pet_id=connection.recipient_pet_id)
 ) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
 if exists(select 1 from public.social_blocks where
  (blocker_owner_id=connection.sender_owner_id and blocked_owner_id=connection.recipient_owner_id) or
  (blocker_owner_id=connection.recipient_owner_id and blocked_owner_id=connection.sender_owner_id)
 ) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
 return new;
end $$;
create trigger social_meeting_guard before insert on public.social_meeting_proposals for each row execute function public.validate_meeting_connection();

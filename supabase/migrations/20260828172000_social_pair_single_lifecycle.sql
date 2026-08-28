-- One unordered pair of dogs has one active social lifecycle, regardless of
-- who sent the first request or which scenario was selected.
with ranked as (
  select id,
    row_number() over (
      partition by least(sender_pet_id, recipient_pet_id), greatest(sender_pet_id, recipient_pet_id)
      order by case when status = 'accepted' then 0 else 1 end, created_at desc
    ) as position
  from public.social_match_requests
  where status in ('pending', 'accepted')
)
update public.social_match_requests as request
set status = 'cancelled', responded_at = coalesce(request.responded_at, now())
from ranked
where request.id = ranked.id and ranked.position > 1;

drop index if exists public.social_match_requests_pending_pair_unique;
create unique index if not exists social_match_requests_active_unordered_pair_unique
  on public.social_match_requests (
    least(sender_pet_id, recipient_pet_id),
    greatest(sender_pet_id, recipient_pet_id)
  )
  where status in ('pending', 'accepted');

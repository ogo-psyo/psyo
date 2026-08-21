-- Keep the shared ownership trigger safe across avatar tables with different
-- row shapes. Direct NEW.job_id / NEW.asset_id access raises 42703 when the
-- trigger is invoked for a table that does not define that column.

create or replace function public.assert_avatar_row_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_job_id uuid := nullif(v_new ->> 'job_id', '')::uuid;
  v_asset_id uuid := nullif(v_new ->> 'asset_id', '')::uuid;
begin
  if not exists (
    select 1
    from public.pets p
    where p.id = new.pet_id
      and p.owner_id = new.owner_id
  ) then
    raise exception 'AVATAR_OWNER_PET_MISMATCH';
  end if;

  if tg_table_name = 'avatar_assets'
    and v_job_id is not null
    and not exists (
      select 1
      from public.avatar_jobs j
      where j.id = v_job_id
        and j.owner_id = new.owner_id
        and j.pet_id = new.pet_id
    )
  then
    raise exception 'AVATAR_JOB_ASSET_MISMATCH';
  end if;

  if tg_table_name = 'pet_avatar_selections'
    and v_asset_id is not null
    and not exists (
      select 1
      from public.avatar_assets a
      where a.id = v_asset_id
        and a.owner_id = new.owner_id
        and a.pet_id = new.pet_id
    )
  then
    raise exception 'AVATAR_SELECTION_ASSET_MISMATCH';
  end if;

  return new;
end;
$$;

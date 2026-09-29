alter table public.pets
  add column if not exists birth_date date,
  add column if not exists home_arrival_date date;

comment on column public.pets.birth_date is 'Exact pet date of birth when known.';
comment on column public.pets.home_arrival_date is 'Date the pet joined the current home when known.';

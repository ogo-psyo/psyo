create table if not exists public.pet_documents (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  kind text not null default 'analysis' check (kind in ('analysis', 'prescription', 'vaccination', 'other')),
  title text not null,
  clinic text,
  document_date date,
  original_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  storage_bucket text not null default 'pet-documents',
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists pet_documents_pet_created_idx
  on public.pet_documents (pet_id, created_at desc);

alter table public.pet_documents enable row level security;

drop policy if exists "pet documents owner" on public.pet_documents;
create policy "pet documents owner" on public.pet_documents for all
using (exists (
  select 1 from public.pets p
  where p.id = pet_id and p.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.pets p
  where p.id = pet_id and p.owner_id = auth.uid()
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-documents',
  'pet-documents',
  false,
  4194304,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

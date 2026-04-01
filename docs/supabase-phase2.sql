-- Frank Group AI Governance Dashboard — Phase 2 persistence (TASK-05)
-- Run in Supabase SQL Editor after creating a project.

-- Periods
create table if not exists periods (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  date_from   date,
  date_to     date,
  created_at  timestamptz default now()
);

-- Per-user metrics per period
create table if not exists period_users (
  id                uuid primary key default gen_random_uuid(),
  period_id         uuid not null references periods(id) on delete cascade,
  email             text not null,
  name              text,
  entity            text,
  seat_tier         text,
  total_spend_usd   numeric,
  total_tokens      bigint,
  total_requests    integer,
  opus_pct          numeric,
  fluency_score     numeric,
  fluency_tier      integer,
  model_breakdown   jsonb,
  product_breakdown jsonb,
  created_at        timestamptz default now()
);

create index if not exists period_users_period_id_idx on period_users (period_id);
create index if not exists period_users_email_idx on period_users (email);

-- Row-level security (Magic Link / session required)
alter table periods enable row level security;
alter table period_users enable row level security;

-- Adjust role names if your project uses a custom authenticated role.
create policy "periods_select_authenticated" on periods
  for select to authenticated using (true);

create policy "periods_insert_authenticated" on periods
  for insert to authenticated with check (true);

create policy "period_users_select_authenticated" on period_users
  for select to authenticated using (true);

create policy "period_users_insert_authenticated" on period_users
  for insert to authenticated with check (true);

-- ─── Raw file uploads (Storage + public.uploads manifest) ─────────────────────
-- Applied in project via migration `add_uploads_table_and_storage_bucket` (or run below).

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  file_size integer,
  uploaded_at timestamptz default now(),
  uploaded_by text
);

create index if not exists uploads_uploaded_at_idx on uploads (uploaded_at desc);
create index if not exists uploads_file_type_idx on uploads (file_type);

alter table uploads enable row level security;

drop policy if exists "uploads_select_authenticated" on uploads;
drop policy if exists "uploads_insert_authenticated" on uploads;
drop policy if exists "uploads_delete_authenticated" on uploads;

create policy "uploads_select_authenticated" on uploads
  for select to authenticated using (true);

create policy "uploads_insert_authenticated" on uploads
  for insert to authenticated with check (true);

create policy "uploads_delete_authenticated" on uploads
  for delete to authenticated using (true);

-- Private bucket `uploads` (50 MiB default limit in migration; adjust in Dashboard if needed)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 52428800, null)
on conflict (id) do update set public = excluded.public;

drop policy if exists "storage_uploads_insert_authenticated" on storage.objects;
drop policy if exists "storage_uploads_select_authenticated" on storage.objects;
drop policy if exists "storage_uploads_delete_authenticated" on storage.objects;
drop policy if exists "storage_uploads_update_authenticated" on storage.objects;

create policy "storage_uploads_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads');

create policy "storage_uploads_select_authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads');

create policy "storage_uploads_delete_authenticated" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads');

create policy "storage_uploads_update_authenticated" on storage.objects
  for update to authenticated
  using (bucket_id = 'uploads')
  with check (bucket_id = 'uploads');

-- Optional: restrict sign-ups to Frank domains via Supabase Dashboard → Authentication →
-- Hooks or email templates. Client-side checks are not sufficient on their own.

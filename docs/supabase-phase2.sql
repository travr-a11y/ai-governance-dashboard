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
drop policy if exists "periods_select_authenticated" on periods;
drop policy if exists "periods_insert_authenticated" on periods;
drop policy if exists "period_users_select_authenticated" on period_users;
drop policy if exists "period_users_insert_authenticated" on period_users;

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

-- ─── Anon role (dashboard uses anon key; PIN-gated Admin tab is access control) ─
-- Migration: add_anon_rls_policies_for_cloud_persistence — allows Storage + DB without Magic Link.

create policy "uploads_select_anon" on public.uploads for select to anon using (true);
create policy "uploads_insert_anon" on public.uploads for insert to anon with check (true);
create policy "uploads_delete_anon" on public.uploads for delete to anon using (true);

drop policy if exists "periods_select_anon" on public.periods;
drop policy if exists "periods_insert_anon" on public.periods;
drop policy if exists "period_users_select_anon" on public.period_users;
drop policy if exists "period_users_insert_anon" on public.period_users;

create policy "periods_select_anon" on public.periods for select to anon using (true);
create policy "periods_insert_anon" on public.periods for insert to anon with check (true);

create policy "period_users_select_anon" on public.period_users for select to anon using (true);
create policy "period_users_insert_anon" on public.period_users for insert to anon with check (true);

create policy "storage_uploads_select_anon" on storage.objects for select to anon using (bucket_id = 'uploads');
create policy "storage_uploads_insert_anon" on storage.objects for insert to anon with check (bucket_id = 'uploads');
create policy "storage_uploads_update_anon" on storage.objects for update to anon using (bucket_id = 'uploads');
create policy "storage_uploads_delete_anon" on storage.objects for delete to anon using (bucket_id = 'uploads');

-- ─── Deduplication (content hash) + RAG document_chunks (pgvector) ─────────────
-- Run after initial Phase 2 migration. Enables global SHA-256 dedup and Edge Function embeddings.

alter table public.uploads add column if not exists content_hash text;

create unique index if not exists uploads_content_hash_unique
  on public.uploads (content_hash)
  where content_hash is not null;

create extension if not exists vector;

create table if not exists public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  upload_id    uuid not null references public.uploads(id) on delete cascade,
  chunk_index  int not null,
  chunk_text   text not null,
  embedding    vector(1536),
  file_type    text,
  metadata     jsonb,
  created_at   timestamptz default now()
);

create index if not exists document_chunks_upload_id_idx on public.document_chunks (upload_id);

-- IVFFlat index: build after you have some rows, or omit if empty project errors.
-- create index if not exists document_chunks_embedding_idx
--   on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 50);

alter table public.document_chunks enable row level security;

drop policy if exists "chunks_select_anon" on public.document_chunks;
drop policy if exists "chunks_insert_anon" on public.document_chunks;
drop policy if exists "chunks_select_authenticated" on public.document_chunks;
drop policy if exists "chunks_insert_authenticated" on public.document_chunks;

create policy "chunks_select_anon" on public.document_chunks
  for select to anon using (true);

create policy "chunks_insert_anon" on public.document_chunks
  for insert to anon with check (true);

create policy "chunks_select_authenticated" on public.document_chunks
  for select to authenticated using (true);

create policy "chunks_insert_authenticated" on public.document_chunks
  for insert to authenticated with check (true);

create policy "chunks_delete_anon" on public.document_chunks
  for delete to anon using (true);

create policy "chunks_delete_authenticated" on public.document_chunks
  for delete to authenticated using (true);

-- ─── DELETE policies for periods + period_users (upsert by date range) ────────

create policy "periods_delete_anon" on public.periods
  for delete to anon using (true);
create policy "periods_delete_authenticated" on public.periods
  for delete to authenticated using (true);
create policy "period_users_delete_anon" on public.period_users
  for delete to anon using (true);
create policy "period_users_delete_authenticated" on public.period_users
  for delete to authenticated using (true);

-- ─── App settings (key-value store for dashboard config, initiatives, overrides) ─

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

create policy "settings_select_anon" on public.app_settings for select to anon using (true);
create policy "settings_insert_anon" on public.app_settings for insert to anon with check (true);
create policy "settings_update_anon" on public.app_settings for update to anon using (true) with check (true);
create policy "settings_delete_anon" on public.app_settings for delete to anon using (true);
create policy "settings_select_authenticated" on public.app_settings for select to authenticated using (true);
create policy "settings_insert_authenticated" on public.app_settings for insert to authenticated with check (true);
create policy "settings_update_authenticated" on public.app_settings for update to authenticated using (true) with check (true);
create policy "settings_delete_authenticated" on public.app_settings for delete to authenticated using (true);

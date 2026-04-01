# Dashboard Scaffold Runbook

**Purpose:** Agent-executable guide for spinning up a new analytics dashboard (HR, Finance, Marketing, or any domain) from a one-paragraph brief to a working, deployed dashboard in approximately 90 minutes.

**Reference implementation:** Frank Group AI Governance Dashboard — `travr-a11y/ai-governance-dashboard`

---

## Overview

| Layer | What it is | Copy-paste? |
|-------|-----------|-------------|
| Static site shell | React 18 + Recharts + Babel-in-browser (`index.html`) | Yes — change title + constants |
| Supabase schema | 8 base migrations, then custom analytics table | Base migrations copy-paste; analytics table customised per CSV |
| Edge Function | `ingest-process` — parses uploaded CSV → `usage_rows` | Mostly copy-paste; change CSV-to-column mapping |
| Config / deploy | `package.json`, `railway.toml`, `dashboard-config.json` | Copy-paste verbatim |
| Module JSX | React components for charts/tables/cards | Copy shells; data shape adapts to CSV |

---

## Variable components — what changes per dashboard

| Component | Frank Group value | Your dashboard |
|-----------|------------------|----------------|
| `USERS_MAP` | 8 seats (Frank Advisory + Frank Law) | Your org's users |
| `SPEND_LIMITS` | Per-user AUD limits | Your limits (or remove entirely) |
| `COLOURS` | `#1e1645` primary, `#88aa00` accent | Your brand |
| `analytics_rows` table | `usage_rows` with Anthropic CSV schema | Table name + columns matching your CSV |
| CSV parser headers | Anthropic admin export headers | Your CSV headers |
| Module set | 9 modules (AI-specific) | Pick from shells below |
| `seats` seed | 8 Frank Group emails | Your users |

---

## Phase-by-phase checklist (~90 minutes)

### Phase 0 — Brief (5 min)

Gather from the operator before writing any code:

```
□ Dashboard name
□ Organisation name
□ User list: email, display_name, entity, seat_tier, spend_limit_aud, is_benchmark
□ Brand colours: primary (dark header), accent (highlight)
□ CSV header row (paste the first line of the analytics export)
□ Module selection (from list below)
□ Supabase project ref (or "create new")
□ Deployment target (Railway / Vercel / local)
□ OpenRouter key? (only if AI report narrative wanted)
```

---

### Phase 1 — Repository setup (10 min)

```bash
# 1. Create repo
mkdir my-dashboard && cd my-dashboard
git init
git branch -M main

# 2. Write .gitignore
cat > .gitignore << 'EOF'
**/.DS_Store
.env
node_modules/
dashboard-config.json
EOF

# 3. Write dashboard-config.example.json (template — safe to commit)
cat > dashboard-config.example.json << 'EOF'
{
  "SUPABASE_URL": "",
  "SUPABASE_ANON_KEY": "",
  "OPENROUTER_API_KEY": ""
}
cp dashboard-config.example.json dashboard-config.json
# then fill in real values in dashboard-config.json (gitignored)
EOF

# 4. package.json (prestart writes env vars into dashboard-config.json on Railway)
# See full template in "Fixed files" section below.

# 5. railway.toml
echo '[deploy]\nstartCommand = "npm start"' > railway.toml
```

---

### Phase 2 — Supabase schema (20 min)

Apply all 8 migrations in order in the Supabase Dashboard SQL Editor.
(Or via `mcp__supabase__execute_sql` if MCP is configured.)

**Migration order:**

| # | Name | Notes |
|---|------|-------|
| M0 | Base schema (periods, uploads, document_chunks, period_users, app_settings) | Copy from Frank Group `docs/supabase-phase2.sql` |
| M1 | `fix_constraints_and_indexes` | Copy-paste — generic |
| M2 | `add_analytics_rows_table` | **Customise** — see below |
| M3 | `add_period_breakdown_tables` | Copy-paste — generic |
| M4 | `add_seats_table` | **Customise seed** — replace Frank Group rows |
| M5 | `add_data_quality_fixes` | Copy-paste — generic |
| M6 | `add_initiatives_table` | Copy-paste; replace seed rows if wanted |
| M7 | `enable_vector_extension` | Optional — only if RAG embeddings wanted |

After applying, verify in Supabase Table Editor:
```
□ periods table exists, UNIQUE(date_from, date_to)
□ uploads table exists, content_hash UNIQUE partial index
□ analytics_rows table exists with your custom columns
□ seats table exists with your users seeded
□ app_settings table exists
□ initiatives table exists
□ Storage bucket "uploads" exists (private)
```

---

### Phase 3 — Edge Function (15 min)

1. **Copy** `supabase/functions/ingest-process/index.ts` from Frank Group repo.
2. **Change** the `required` headers array to match your CSV:
   ```ts
   // Frank Group:
   const required = ['user_email','model','product','total_requests',
                      'total_prompt_tokens','total_completion_tokens','total_net_spend_usd'];

   // Your CSV (example — HR headcount export):
   const required = ['employee_id','department','cost_centre','headcount','salary_usd'];
   ```
3. **Change** the `insertRows` mapping inside `ingestUsageRows`:
   ```ts
   // Frank Group (Anthropic model dashboard):
   const insertRows = rows.filter(r => r.user_email && r.model).map(r => ({
     upload_id: uploadId,
     user_email: r.user_email.toLowerCase().trim(),
     model_id: r.model.trim(),
     model_class: classifyModel(r.model),
     ...
   }));

   // Your dashboard (HR example):
   const insertRows = rows.filter(r => r.employee_id).map(r => ({
     upload_id: uploadId,
     employee_id: r.employee_id.trim(),
     department: r.department?.trim() || null,
     cost_centre: r.cost_centre?.trim() || null,
     headcount: parseInt(r.headcount || '0', 10) || 0,
     salary_usd: parseFloat(r.salary_usd || '0') || 0,
     row_date: rowDate,
   }));
   ```
4. **Remove or adapt** `classifyModel` if your CSV has no model tiers.
5. **Keep unchanged:** `buildPeriodLabel`, `autoRegisterPeriod`, `chunkText`, `embedBatch`, CORS headers, main handler skeleton.
6. **Deploy:**
   ```bash
   npx supabase functions deploy ingest-process --project-ref <your-ref>
   ```
7. **Set secrets** in Supabase Dashboard → Edge Functions → ingest-process → Secrets:
   - `SUPABASE_SERVICE_ROLE_KEY` (from Project Settings → API)
   - `OPENROUTER_API_KEY` (optional)

---

### Phase 4 — Dashboard constants (10 min)

Replace the following constant blocks in `index.html`:

**USERS_MAP** (or load from `seats` table — see aggregation section):
```js
const USERS_MAP = {
  "alice@acme.com": { name: "Alice Smith",  entity: "Engineering",  isBenchmark: true },
  "bob@acme.com":   { name: "Bob Jones",    entity: "Marketing" },
  // one entry per seat
};
```

**SPEND_LIMITS** (set to `null` for unlimited, or remove entirely if not applicable):
```js
const SPEND_LIMITS = {
  "alice@acme.com": null,   // unlimited
  "bob@acme.com":   500,    // $500 AUD/month cap
};
```

**COLOURS:**
```js
const COLOURS = {
  primary:   '#1e1645',  // ← your brand dark colour
  accent:    '#88aa00',  // ← your brand highlight
  secondary: '#3a4a7c',
  danger:    '#e74c3c',
  body:      '#1a1a1a',
  caption:   '#4a4a4a',
};
```

---

### Phase 5 — Module assembly (20 min)

Pick modules from the shells below. Paste into `index.html` above the `App` function.
Pass the aggregated `data` object from the App state into each module as props.

> **Data shape convention:** The `aggregateData` function (copy from Frank Group)
> returns an array of per-user objects with `{ email, name, entity, spend, tokens,
> requests, opusPct, fluencyScore, seatTier, spendLimit, modelBreakdown,
> productBreakdown }`. Adapt field names to match your CSV columns.

**See module shell library below.**

---

### Phase 6 — Deploy (10 min)

```bash
git add .
git commit -m "feat: initial dashboard scaffold"
git push origin main
```

Railway / Vercel:
- Connect repo in dashboard
- Set env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`
- Railway: deploy runs `npm start` → `prestart` writes config → `npx serve`
- Vercel / Netlify: set build output to `.` (static root), no build command

---

### Phase 7 — Verify (5 min)

```
□ Site loads without console errors
□ Supabase requests return 200 (not 401/403) in Network tab
□ Upload a test CSV → Edge Function invoked → analytics_rows populated
□ Period auto-registered from filename dates (check periods table)
□ Date range picker appears in header after first upload
□ All selected modules render (even on sample data)
```

---

## Fixed files (copy-paste verbatim)

### package.json
```json
{
  "name": "analytics-dashboard",
  "version": "1.0.0",
  "scripts": {
    "prestart": "node -e \"try{const c=require('./dashboard-config.json');const k=['SUPABASE_URL','SUPABASE_ANON_KEY','OPENROUTER_API_KEY'];const o={};k.forEach(k=>{const v=process.env[k];if(v&&v.trim())o[k]=v.trim()});if(Object.keys(o).length){const e={...c,...o};require('fs').writeFileSync('./dashboard-config.json',JSON.stringify(e,null,2))}}catch(e){}\"",
    "start": "npx serve ."
  }
}
```

### railway.toml
```toml
[deploy]
startCommand = "npm start"
```

### supabase/config.toml
```toml
project_id = "<your-project-ref>"
```

### Config injection (bottom of `<body>` in index.html)
```html
<script>
  fetch('/dashboard-config.json')
    .then(r => r.ok ? r.json() : null)
    .then(cfg => { if (cfg) window.__DASHBOARD_CONFIG__ = cfg; })
    .catch(() => {});
</script>
```

---

## Base migrations (generic — strip Frank Group seeds)

These 8 migrations are domain-agnostic. Apply them to any Supabase project.
Frank-specific seeds (user emails, initiative rows) are removed here; add your own.

### M0 — Base schema (periods, uploads, document_chunks, period_users, app_settings)

> The full SQL is embedded below. Run the entire block as a single execution in the Supabase SQL Editor.
> This is idempotent — safe to re-run on an existing project.

```sql
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

-- Private bucket `uploads` (50 MiB default limit; adjust in Dashboard if needed)
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

-- ─── Anon role (dashboard uses anon key; PIN-gated Admin tab is access control) ─

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

-- ─── DELETE policies for periods + period_users ────────────────────────────────

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
```

### M1 — fix_constraints_and_indexes
```sql
-- Unique constraint on period_users (prevents duplicates on retry)
ALTER TABLE public.period_users
  ADD CONSTRAINT period_users_period_email_unique UNIQUE (period_id, email);

-- periods date columns NOT NULL
ALTER TABLE public.periods
  ALTER COLUMN date_from SET NOT NULL,
  ALTER COLUMN date_to   SET NOT NULL;

-- Composite index on periods dates
CREATE INDEX IF NOT EXISTS periods_dates_idx ON public.periods (date_from, date_to);

-- Unique constraint on document_chunks (prevents duplicates on Edge Function retry)
ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_upload_chunk_unique UNIQUE (upload_id, chunk_index);
```

### M2 — add_analytics_rows_table (CUSTOMISE THIS)

Replace `usage_rows`, `user_email`, `model_id`, `model_class`, etc. with your
own column names. Keep the structural columns (`id`, `upload_id`, `period_id`,
`row_date`, `created_at`) and the RLS block unchanged.

```sql
-- !! RENAME the table and columns to match your CSV schema !!

CREATE TABLE IF NOT EXISTS public.usage_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id         uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  period_id         uuid REFERENCES public.periods(id) ON DELETE SET NULL,

  -- ── Domain columns — replace these with your CSV columns ──────────────────
  user_email        text NOT NULL,
  model_id          text NOT NULL,
  model_class       text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  product           text,
  requests          integer NOT NULL DEFAULT 0,
  prompt_tokens     bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens      bigint GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  net_spend_usd     numeric(12,6) NOT NULL DEFAULT 0,
  -- ──────────────────────────────────────────────────────────────────────────

  row_date          date,
  created_at        timestamptz DEFAULT now(),

  -- Natural key: upload + the columns that uniquely identify a CSV row
  CONSTRAINT analytics_rows_natural_key
    UNIQUE (upload_id, user_email, model_id, product)
);

CREATE INDEX IF NOT EXISTS analytics_rows_upload_id_idx ON public.usage_rows (upload_id);
CREATE INDEX IF NOT EXISTS analytics_rows_user_idx      ON public.usage_rows (user_email);
CREATE INDEX IF NOT EXISTS analytics_rows_row_date_idx  ON public.usage_rows (row_date);

ALTER TABLE public.usage_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_select_anon"          ON public.usage_rows FOR SELECT TO anon          USING (true);
CREATE POLICY "ar_insert_anon"          ON public.usage_rows FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "ar_delete_anon"          ON public.usage_rows FOR DELETE TO anon          USING (true);
CREATE POLICY "ar_select_authenticated" ON public.usage_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "ar_insert_authenticated" ON public.usage_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ar_delete_authenticated" ON public.usage_rows FOR DELETE TO authenticated USING (true);
```

### M3 — add_period_breakdown_tables
```sql
-- Period-level model breakdown (optional — useful for trend charts)
CREATE TABLE IF NOT EXISTS public.period_model_breakdown (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  email       text NOT NULL,
  model_class text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  spend_usd   numeric(12,6) NOT NULL DEFAULT 0,
  tokens      bigint NOT NULL DEFAULT 0,
  requests    integer NOT NULL DEFAULT 0,
  CONSTRAINT period_model_breakdown_unique UNIQUE (period_id, email, model_class)
);

CREATE INDEX IF NOT EXISTS pmb_period_id_idx ON public.period_model_breakdown (period_id);
CREATE INDEX IF NOT EXISTS pmb_email_idx     ON public.period_model_breakdown (email);

ALTER TABLE public.period_model_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmb_select_anon"          ON public.period_model_breakdown FOR SELECT TO anon          USING (true);
CREATE POLICY "pmb_insert_anon"          ON public.period_model_breakdown FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "pmb_delete_anon"          ON public.period_model_breakdown FOR DELETE TO anon          USING (true);
CREATE POLICY "pmb_select_authenticated" ON public.period_model_breakdown FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmb_insert_authenticated" ON public.period_model_breakdown FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pmb_delete_authenticated" ON public.period_model_breakdown FOR DELETE TO authenticated USING (true);

-- Period-level product/category breakdown
CREATE TABLE IF NOT EXISTS public.period_product_breakdown (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  email       text NOT NULL,
  product     text NOT NULL,
  spend_usd   numeric(12,6) NOT NULL DEFAULT 0,
  tokens      bigint NOT NULL DEFAULT 0,
  requests    integer NOT NULL DEFAULT 0,
  CONSTRAINT period_product_breakdown_unique UNIQUE (period_id, email, product)
);

CREATE INDEX IF NOT EXISTS ppb_period_id_idx ON public.period_product_breakdown (period_id);
CREATE INDEX IF NOT EXISTS ppb_email_idx     ON public.period_product_breakdown (email);

ALTER TABLE public.period_product_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppb_select_anon"          ON public.period_product_breakdown FOR SELECT TO anon          USING (true);
CREATE POLICY "ppb_insert_anon"          ON public.period_product_breakdown FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "ppb_delete_anon"          ON public.period_product_breakdown FOR DELETE TO anon          USING (true);
CREATE POLICY "ppb_select_authenticated" ON public.period_product_breakdown FOR SELECT TO authenticated USING (true);
CREATE POLICY "ppb_insert_authenticated" ON public.period_product_breakdown FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ppb_delete_authenticated" ON public.period_product_breakdown FOR DELETE TO authenticated USING (true);
```

### M4 — add_seats_table (CUSTOMISE SEED)
```sql
CREATE TABLE IF NOT EXISTS public.seats (
  email           text PRIMARY KEY,
  display_name    text NOT NULL,
  entity          text NOT NULL,       -- department / team / org unit
  seat_tier       text NOT NULL DEFAULT 'Standard' CHECK (seat_tier IN ('Standard', 'Premium')),
  spend_limit_aud numeric(10,2),       -- NULL = unlimited
  is_benchmark    boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Read-only for anon (dashboard loads seat config on startup)
CREATE POLICY "seats_select_anon"          ON public.seats FOR SELECT TO anon          USING (true);
-- Full CRUD for authenticated (admin manages seats)
CREATE POLICY "seats_select_authenticated" ON public.seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "seats_insert_authenticated" ON public.seats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "seats_update_authenticated" ON public.seats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "seats_delete_authenticated" ON public.seats FOR DELETE TO authenticated USING (true);

-- !! REPLACE with your users — one row per seat !!
-- INSERT INTO public.seats (email, display_name, entity, seat_tier, spend_limit_aud, is_benchmark) VALUES
--   ('alice@acme.com', 'Alice Smith', 'Engineering', 'Standard', NULL, true),
--   ('bob@acme.com',   'Bob Jones',   'Marketing',   'Standard', 500, false)
-- ON CONFLICT (email) DO NOTHING;
```

### M5 — add_data_quality_fixes
```sql
-- Constrain uploads.file_type (add your own file types if different)
ALTER TABLE public.uploads
  ADD CONSTRAINT uploads_file_type_check
  CHECK (file_type IN ('anthropic-csv', 'code-csv', 'conversations', 'projects', 'memories', 'users'));

-- Claude Code columns on period_users (remove if not an AI dashboard)
ALTER TABLE public.period_users
  ADD COLUMN IF NOT EXISTS code_spend_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS code_tokens     bigint;

-- Link uploads rows back to the period they informed
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS uploads_period_id_idx
  ON public.uploads (period_id) WHERE period_id IS NOT NULL;

-- Explicit precision on spend/score columns
ALTER TABLE public.period_users
  ALTER COLUMN total_spend_usd TYPE numeric(12,6),
  ALTER COLUMN opus_pct        TYPE numeric(5,2),
  ALTER COLUMN fluency_score   TYPE numeric(5,2);

-- Auto-update updated_at on app_settings changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- file_size to bigint
ALTER TABLE public.uploads ALTER COLUMN file_size TYPE bigint;
```

### M6 — add_initiatives_table
```sql
CREATE TABLE IF NOT EXISTS public.initiatives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  owner           text,
  target_metric   text,
  current_value   text,
  status          text NOT NULL DEFAULT 'Planned'
                  CHECK (status IN ('Planned', 'In Progress', 'Done', 'At Risk')),
  notes           text,
  sort_order      integer,
  target_value    numeric,
  lower_is_better boolean NOT NULL DEFAULT false,
  status_override text,
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

CREATE TRIGGER initiatives_updated_at
  BEFORE UPDATE ON public.initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "initiatives_select_anon"          ON public.initiatives FOR SELECT TO anon          USING (true);
CREATE POLICY "initiatives_insert_anon"          ON public.initiatives FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "initiatives_update_anon"          ON public.initiatives FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "initiatives_delete_anon"          ON public.initiatives FOR DELETE TO anon          USING (true);
CREATE POLICY "initiatives_select_authenticated" ON public.initiatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "initiatives_insert_authenticated" ON public.initiatives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "initiatives_update_authenticated" ON public.initiatives FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "initiatives_delete_authenticated" ON public.initiatives FOR DELETE TO authenticated USING (true);

-- !! REPLACE with your org's goals !!
-- INSERT INTO public.initiatives (name, owner, target_metric, target_value, lower_is_better, sort_order) VALUES
--   ('All seats active', 'Admin', 'active_users_count', 10, false, 1)
-- ON CONFLICT DO NOTHING;
```

### M7 — enable_vector_extension (optional — only for RAG)
```sql
-- Only run if document_chunks table exists (from M0) and you want embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add IVFFlat index once you have 1000+ chunks
-- CREATE INDEX ON public.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## Module JSX shell library

These are standalone React components for use in `index.html`.
They reference `COLOURS` from the global scope and Recharts via the UMD bundle.

### KPI summary cards
```jsx
function ModuleKPICards({ data }) {
  const cards = [
    { label: 'Total Spend (USD)',  value: `$${(data?.totalSpend  ?? 0).toFixed(2)}` },
    { label: 'Total Tokens',       value: (data?.totalTokens ?? 0).toLocaleString() },
    { label: 'Active Users',       value: data?.activeUsers ?? 0 },
    { label: 'Total Requests',     value: (data?.totalRequests ?? 0).toLocaleString() },
  ];
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          flex: '1 1 160px', background: '#fff', borderRadius: 8,
          padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)'
        }}>
          <div style={{ fontSize: 12, color: COLOURS.caption, marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLOURS.primary }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

### Usage by category — horizontal bar chart
```jsx
function ModuleCategoryChart({ data }) {
  // Expects data.categoryBreakdown: [{ name, spend, tokens, requests }]
  const rows = [...(data?.categoryBreakdown ?? [])].sort((a, b) => b.spend - a.spend);
  if (!rows.length) return null;
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)'
    }}>
      <h3 style={{ color: COLOURS.primary, marginBottom: 16, fontSize: 16 }}>
        Usage by Category
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 36)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 80 }}>
          <XAxis type="number" tick={{ fontSize: 11 }}
            tickFormatter={v => `$${v.toFixed(2)}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
          <Tooltip formatter={v => [`$${Number(v).toFixed(4)}`, 'Spend']} />
          <Bar dataKey="spend" fill={COLOURS.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### User spend & tokens table
```jsx
function ModuleUserTable({ data }) {
  const [sortKey, setSortKey] = React.useState('spend');
  const users = [...(data?.users ?? [])].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  const cols = [
    { key: 'name',     label: 'User' },
    { key: 'entity',   label: 'Team' },
    { key: 'spend',    label: 'Spend (USD)' },
    { key: 'tokens',   label: 'Tokens' },
    { key: 'requests', label: 'Requests' },
  ];
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflowX: 'auto'
    }}>
      <h3 style={{ color: COLOURS.primary, marginBottom: 16, fontSize: 16 }}>
        User Spend & Tokens
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLOURS.primary}` }}>
            {cols.map(c => (
              <th key={c.key} onClick={() => setSortKey(c.key)} style={{
                textAlign: 'left', padding: '8px 12px', cursor: 'pointer', userSelect: 'none',
                color: sortKey === c.key ? COLOURS.accent : COLOURS.body, fontWeight: 600
              }}>
                {c.label}{sortKey === c.key ? ' ↓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.email} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{u.name}</td>
              <td style={{ padding: '8px 12px', color: COLOURS.caption }}>{u.entity}</td>
              <td style={{ padding: '8px 12px' }}>${(u.spend ?? 0).toFixed(4)}</td>
              <td style={{ padding: '8px 12px' }}>{(u.tokens ?? 0).toLocaleString()}</td>
              <td style={{ padding: '8px 12px' }}>{u.requests ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Spend over time — line chart
```jsx
function ModuleTrendChart({ data }) {
  // Expects data.trendByPeriod: [{ period, spend, tokens }] sorted by date
  const rows = data?.trendByPeriod ?? [];
  if (rows.length < 2) return null;
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)'
    }}>
      <h3 style={{ color: COLOURS.primary, marginBottom: 16, fontSize: 16 }}>
        Spend Over Time
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <Tooltip formatter={v => [`$${Number(v).toFixed(2)}`, 'Spend']} />
          <Line type="monotone" dataKey="spend" stroke={COLOURS.primary}
            strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Pie chart — model or category mix
```jsx
function ModuleMixPie({ title, data, slices, colours }) {
  // slices: [{ key, label }], colours: string[]
  // data: [{ [key]: value }] or a single object
  const source = Array.isArray(data) ? data[0] ?? {} : (data ?? {});
  const rows = (slices ?? []).map((s, i) => ({
    name: s.label,
    value: parseFloat(source[s.key] ?? 0),
    fill: colours?.[i] ?? COLOURS.accent,
  })).filter(r => r.value > 0);
  if (!rows.length) return null;
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)'
    }}>
      <h3 style={{ color: COLOURS.primary, marginBottom: 16, fontSize: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={rows} cx="50%" cy="50%" outerRadius={80} dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
          </Pie>
          <Legend />
          <Tooltip formatter={v => Number(v).toFixed(2)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Data ingestion module (always include)
```jsx
function ModuleIngestion({ onFileUpload, uploadHistory, persistToCloud }) {
  const [dragging, setDragging] = React.useState(false);
  const handleFiles = files => {
    [...files].forEach(f => onFileUpload(f));
  };
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)'
    }}>
      <h3 style={{ color: COLOURS.primary, marginBottom: 16, fontSize: 16 }}>
        Data Ingestion
      </h3>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragging ? COLOURS.accent : '#cbd5e1'}`,
          borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer',
          background: dragging ? '#f8fdf0' : '#f8fafc', transition: 'all .15s'
        }}
        onClick={() => document.getElementById('_fileInput').click()}
      >
        <div style={{ fontSize: 14, color: COLOURS.caption }}>
          Drop CSV / JSON files here, or click to browse
        </div>
      </div>
      <input id="_fileInput" type="file" multiple accept=".csv,.json"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)} />
      {(uploadHistory ?? []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: COLOURS.caption, marginBottom: 8 }}>
            Upload history
          </div>
          {uploadHistory.map(u => (
            <div key={u.id} style={{ fontSize: 13, padding: '4px 0',
              borderBottom: '1px solid #f1f5f9', color: COLOURS.body }}>
              {u.file_name} — {new Date(u.created_at).toLocaleDateString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Edge Function customisation guide

The reference Edge Function (`supabase/functions/ingest-process/index.ts`) has three
logical sections. Here is what to touch and what to leave alone.

### Touch these

| Function | What to change |
|----------|---------------|
| `ingestUsageRows` → `required` array | Replace with your CSV's required column names |
| `ingestUsageRows` → `insertRows` map | Map CSV columns to your DB table columns |
| `ingestUsageRows` → table name in `.from('usage_rows')` | Change to your analytics table name |
| `classifyModel` | Adapt or delete if no model classification needed |
| `chunkText` → `jsonTypes` array | Add/remove file type strings for JSON-aware chunking |

### Leave alone

| Function | Why |
|----------|-----|
| `buildPeriodLabel` | Date-range label logic is generic |
| `autoRegisterPeriod` | Reads filename dates — generic |
| `embedBatch` | OpenRouter embedding call — generic |
| CORS headers | Required for all browser-invoked Edge Functions |
| Main handler skeleton | Auth, download, dispatch, return pattern |
| `parseCSVRows` | Handles quoted-field CSV correctly |

### Minimal custom Edge Function (non-AI dashboard)

If your dashboard has no AI models (e.g. HR headcount CSV), remove `classifyModel`
and adapt the insert as shown in Phase 3 above. The period auto-registration,
chunking, and embedding sections remain unchanged — they work for any file type.

---

## Reference implementation notes

The Frank Group AI Governance Dashboard (`travr-a11y/ai-governance-dashboard`) is
the only production deployment of this scaffold. Refer to it for:

- Complete `aggregateData` function (groups rows by email, computes fluency scores)
- Complete `usageRowsToRawRows` converter (DB shape → JS shape for aggregateData)
- Multi-signal fluency formula (spend × 0.25 + conversation × 0.4 + project × 0.2 + config × 0.15)
- Date range picker component (header, drives all modules)
- Duplicate file detection (SHA-256 content hash, amber warning card)
- `persistIngestToSupabase` (dedup → Storage upload → uploads row → Edge Function invoke)
- Module 7 initiative tracker (full CRUD against `initiatives` table)
- Module 8 report generator (template + OpenRouter Gemini narrative)

When in doubt, read `index.html` in that repo. It is the authoritative source —
`src/dashboard.jsx` is a dev mirror kept in sync.

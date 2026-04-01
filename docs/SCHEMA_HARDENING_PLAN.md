# Schema Hardening Plan — Frank Group AI Governance Dashboard

## Purpose

This document is a self-contained implementation brief for a coding agent. Read this file plus `docs/AGENT_HANDOFF.md` and `CLAUDE.md` before touching any code or running any SQL. No conversation history is needed.

**Goal:** Harden the Supabase schema so it is correct, complete, and capable of powering all future analytics on the dashboard — without re-architecting what already works.

**Supabase project:** `pwuapjdfrdbgcekrwlpr`
**Railway URL:** `https://ai-governance-dashboard-production.up.railway.app/`
**Repo:** `travr-a11y/ai-governance-dashboard`

---

## Current schema (what exists today)

Five tables are live:

| Table | Purpose |
|-------|---------|
| `uploads` | File manifest — every ingested file gets a row here + raw file in Storage |
| `periods` | Reporting period metadata (label, date_from, date_to) |
| `period_users` | Per-user aggregated metrics per period |
| `document_chunks` | RAG chunks + vector(1536) embeddings |
| `app_settings` | Key-value store (dashboard_settings, initiatives, spend_overrides) |

Storage: private bucket `uploads`, 50 MiB.
Edge Function: `ingest-process` (ACTIVE) — chunks files, generates embeddings, writes to `document_chunks`.

The MCP tool `mcp__supabase-frank-dashboard__apply_migration` is available to apply migrations. Use it — do not use the Supabase SQL Editor directly.

---

## Problems to fix (prioritised)

### 🔴 Priority 1 — Correctness bugs (fix first, no code changes needed)

#### P1-A: Missing UNIQUE constraint on `period_users(period_id, email)`

`handleSavePeriod` in `index.html` deletes a period and re-inserts it. If the network retries or the button is double-clicked, you get duplicate rows for the same user in the same period. Every trend query doubles.

**Fix:** Add a unique constraint.

#### P1-B: `periods.date_from` and `date_to` are NULLABLE

The upsert logic queries `WHERE date_from = X AND date_to = Y`. In Postgres, `NULL = NULL` evaluates to `NULL` (false), so "Manual snapshot" periods with null dates never match — duplicate periods accumulate silently.

**Fix:** Add NOT NULL constraint. All current rows are empty (0 rows) so this is safe.

#### P1-C: No index on `periods(date_from, date_to)`

Every "Save period snapshot" click fires a `SELECT` against `periods` filtered by both dates. No index means a full table scan.

**Fix:** Composite index.

#### P1-D: `document_chunks` missing UNIQUE on `(upload_id, chunk_index)`

The Edge Function deletes old chunks then re-inserts. A partial failure and retry produces duplicate (upload_id, chunk_index) pairs, causing duplicated results in similarity searches.

**Fix:** Unique constraint.

---

### 🟠 Priority 2 — Schema gaps that block analytics

#### P2-A: No `usage_rows` table — raw CSV data only lives as files

**This is the single most important missing piece.** Right now:
- Raw data = CSV files in Storage, downloaded and parsed in-browser on every page load
- Analytics data = `period_users` snapshots (user-level aggregates, saved manually)

There is no table holding individual CSV rows. You cannot build SQL queries like:
- "Opus usage by user across all dates" (requires file download + parse)
- "Which products drove spend in week 2 of March?" (impossible without raw rows)
- "Day-over-day token trend for Travis" (impossible without raw rows)

**Fix:** Create a `usage_rows` table. Wire the `ingest-process` Edge Function (which already downloads the file) to parse Anthropic CSV rows and insert them. This makes all analytics pure SQL.

Schema:
```sql
CREATE TABLE public.usage_rows (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id            uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  period_id            uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  user_email           text NOT NULL,
  model_id             text NOT NULL,
  model_class          text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  product              text,
  requests             integer NOT NULL DEFAULT 0,
  prompt_tokens        bigint NOT NULL DEFAULT 0,
  completion_tokens    bigint NOT NULL DEFAULT 0,
  total_tokens         bigint GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  net_spend_usd        numeric(12,6) NOT NULL DEFAULT 0,
  row_date             date,
  created_at           timestamptz DEFAULT now()
);
```

Indexes: `(upload_id)`, `(user_email)`, `(model_class)`, `(row_date)`, `(upload_id, user_email)`.

RLS: select/insert/delete for anon + authenticated (same pattern as other tables).

Unique constraint on `(upload_id, user_email, model_id, product)` — prevents duplicates if the Edge Function re-processes the same file.

#### P2-B: `model_breakdown` and `product_breakdown` in `period_users` are opaque JSONB

Current structure:
```json
{"Opus": {"spend": 12.50, "tokens": 45000, "requests": 12}}
```

To chart "Opus spend trend over time" you need `jsonb->>` operators — hostile for analytics. You cannot aggregate across periods cleanly.

**Fix:** Two new normalised tables that are populated alongside `period_users` when a period snapshot is saved.

```sql
CREATE TABLE public.period_model_breakdown (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  email       text NOT NULL,
  model_class text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  spend_usd   numeric(12,6) NOT NULL DEFAULT 0,
  tokens      bigint NOT NULL DEFAULT 0,
  requests    integer NOT NULL DEFAULT 0,
  UNIQUE (period_id, email, model_class)
);

CREATE TABLE public.period_product_breakdown (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  email       text NOT NULL,
  product     text NOT NULL,
  spend_usd   numeric(12,6) NOT NULL DEFAULT 0,
  tokens      bigint NOT NULL DEFAULT 0,
  requests    integer NOT NULL DEFAULT 0,
  UNIQUE (period_id, email, product)
);
```

Keep the JSONB columns in `period_users` as a convenience cache — do not remove them. These new tables power SQL analytics; JSONB is the fast in-memory restore path.

#### P2-C: No `seats` table — USERS_MAP hardcoded in JavaScript

The 8 users, their entities, spend limits, seat tiers, and benchmark flags are hardcoded constants in `index.html` (~line 147). Adding a 9th seat or changing a spend limit requires a code deploy and a git push.

**Fix:** Create a `seats` table. Populate it with the current 8 users. The dashboard reads it on load and uses it as the source of truth, falling back to the hardcoded USERS_MAP if Supabase is not configured (backward compatibility).

```sql
CREATE TABLE public.seats (
  email           text PRIMARY KEY,
  display_name    text NOT NULL,
  entity          text NOT NULL CHECK (entity IN ('Frank Advisory', 'Frank Law')),
  seat_tier       text NOT NULL DEFAULT 'Standard' CHECK (seat_tier IN ('Standard', 'Premium')),
  spend_limit_aud numeric(10,2),   -- NULL = unlimited
  is_benchmark    boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
```

Initial data (insert in the same migration):
```sql
INSERT INTO public.seats (email, display_name, entity, seat_tier, spend_limit_aud, is_benchmark) VALUES
  ('trowley@frankadvisory.com.au', 'Travis Rowley',  'Frank Advisory', 'Standard', NULL,   true),
  ('alex@frankadvisory.com.au',    'Alex',            'Frank Advisory', 'Premium',  NULL,   false),
  ('andrea@frankadvisory.com.au',  'Andrea',          'Frank Advisory', 'Standard', NULL,   false),
  ('rsharma@frankadvisory.com.au', 'Reginald Sharma', 'Frank Advisory', 'Standard', 190.00, false),
  ('tbrcic@franklaw.com.au',       'Tamara Brcic',    'Frank Law',      'Standard', 10.00,  false),
  ('bagar@franklaw.com.au',        'Bahar Agar',      'Frank Law',      'Standard', 20.00,  false),
  ('bwoodward@franklaw.com.au',    'Ben Woodward',    'Frank Law',      'Standard', NULL,   false),
  ('rlyons@franklaw.com.au',       'Rhys Lyons',      'Frank Law',      'Standard', 50.00,  false)
ON CONFLICT (email) DO NOTHING;
```

RLS: SELECT for anon + authenticated (read-only from client). INSERT/UPDATE/DELETE for authenticated only (admin manages seats).

#### P2-D: `uploads.file_type` is unconstrained free text

In practice only 6 values are valid: `anthropic-csv`, `code-csv`, `conversations`, `projects`, `memories`, `users`. A bug inserting `"Anthropic-CSV"` would cause the auto-restore logic to silently miss that file type.

**Fix:** Add a CHECK constraint. Do not use an enum (harder to extend without a migration per value).

```sql
ALTER TABLE public.uploads
  ADD CONSTRAINT uploads_file_type_check
  CHECK (file_type IN ('anthropic-csv', 'code-csv', 'conversations', 'projects', 'memories', 'users'));
```

#### P2-E: Claude Code data missing from `period_users` snapshots

`period_users` has no columns for Code data. When a period snapshot is saved, Code spend (from the Claude Code CSV) is silently dropped. Module 4 shows it live, but it won't appear in trend charts.

**Fix:** Add two columns to `period_users`.

```sql
ALTER TABLE public.period_users
  ADD COLUMN IF NOT EXISTS code_spend_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS code_tokens     bigint;
```

And update `handleSavePeriod` in `index.html` to populate these from `u.codeSpendUSD` and `u.codeTokens` (these come from the `codeData` state via `aggregateData`).

#### P2-F: No link between `uploads` and `periods`

When a period snapshot is saved, there is no record of which upload (CSV file) the snapshot was computed from. If a corrected CSV is uploaded and a new snapshot saved, there's no way to trace which snapshot came from which file.

**Fix:** Add a nullable FK on `uploads`.

```sql
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS uploads_period_id_idx ON public.uploads (period_id) WHERE period_id IS NOT NULL;
```

Note: The `handleSavePeriod` code should be updated to set this on the most recently uploaded `anthropic-csv` file after a period is saved. This can be a follow-up — the column addition is safe now.

---

### 🟡 Priority 3 — Data quality and precision

#### P3-A: Numeric precision unspecified on money and score columns

All `numeric` columns in `period_users` lack precision specifiers. Postgres will store full precision but it signals no intent and different callers may round differently.

**Fix (ALTER, safe on existing rows):**
```sql
-- These type changes are safe with no data in the table
ALTER TABLE public.period_users
  ALTER COLUMN total_spend_usd TYPE numeric(12,6),
  ALTER COLUMN opus_pct        TYPE numeric(5,2),
  ALTER COLUMN fluency_score   TYPE numeric(5,2);
```

If there IS data in the table when this runs, Postgres will cast existing values — safe because widening precision never loses data.

#### P3-B: `app_settings.updated_at` doesn't auto-update on upsert

`DEFAULT now()` only fires on INSERT. The app currently sends `updated_at: new Date().toISOString()` explicitly on every upsert — but a future code path might forget.

**Fix:** Add a trigger.

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### P3-C: `uploads.file_size` is `integer` (max ~2.1 GB)

Files are capped at 50 MB by the bucket, so overflow is not a real risk. But file sizes belong in `bigint` by convention.

```sql
ALTER TABLE public.uploads ALTER COLUMN file_size TYPE bigint;
```

#### P3-D: `initiatives` in `app_settings` — blob overwrite antipattern

`app_settings` stores the full initiatives array as one JSONB value. Two browser tabs open simultaneously = last write wins, edits from tab A silently overwritten by tab B. No row-level history.

**Recommended fix (can be done in a follow-up):** Create an `initiatives` table:

```sql
CREATE TABLE public.initiatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  owner         text,
  target_metric text,
  current_value text,
  status        text DEFAULT 'Planned' CHECK (status IN ('Planned', 'In Progress', 'Done', 'At Risk')),
  notes         text,
  sort_order    integer,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE TRIGGER initiatives_updated_at
  BEFORE UPDATE ON public.initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Seed with the 3 default initiatives from `DEFAULT_INITIATIVES` in `index.html`. After this table exists, the dashboard reads from it instead of `app_settings.initiatives`, and edits become row-level upserts.

---

## Edge Function changes — `ingest-process`

The Edge Function at `supabase/functions/ingest-process/index.ts` currently:
1. Downloads the uploaded file from Storage
2. Chunks it into text segments
3. Calls OpenRouter for embeddings
4. Inserts into `document_chunks`

It needs to be extended to also **parse Anthropic CSV files and insert rows into `usage_rows`**. This is the key step that makes all analytics possible.

### What to add to `ingest-process`

After the file is downloaded and `text` is available, add a branch:

```typescript
if (row.file_type === "anthropic-csv") {
  await ingestUsageRows(sb, uploadId, text, row.file_name);
}
```

`ingestUsageRows` function logic:
1. Parse the CSV (split on newlines, parse header row, iterate data rows)
2. Map each row to a `usage_rows` insert:
   - `upload_id` = uploadId
   - `user_email` = row.user_email (lowercase, trimmed)
   - `model_id` = row.model
   - `model_class` = classify(row.model) → 'Opus' / 'Sonnet' / 'Haiku' / 'Other'
   - `product` = row.product
   - `requests` = parseInt(row.total_requests)
   - `prompt_tokens` = parseInt(row.total_prompt_tokens)
   - `completion_tokens` = parseInt(row.total_completion_tokens)
   - `net_spend_usd` = parseFloat(row.total_net_spend_usd)
   - `row_date` = extract from file name regex `YYYY-MM-DD-to-YYYY-MM-DD` (use the start date)
3. Delete existing rows for this `upload_id` first (idempotency)
4. Batch insert (chunks of 500 rows)

Model classification (`MODEL_CLASS` equivalent in TypeScript — mirror what `index.html` does):
```typescript
function classifyModel(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.includes("opus")) return "Opus";
  if (id.includes("sonnet")) return "Sonnet";
  if (id.includes("haiku")) return "Haiku";
  return "Other";
}
```

The embedding/chunking work still runs for all file types. This is additive — if `OPENROUTER_API_KEY` is not set, embeddings are skipped but CSV ingestion still runs.

---

## `index.html` code changes

### 1. Load `seats` table on startup (fallback to USERS_MAP)

Add a `useEffect` that runs when `supabaseClient` is available:
```js
useEffect(() => {
  if (!supabaseClient) return;
  supabaseClient.from("seats").select("*").then(({ data, error }) => {
    if (!error && data?.length) setSeatsFromDb(data);
  });
}, [supabaseClient]);
```

Add state: `const [seatsFromDb, setSeatsFromDb] = useState(null);`

In `aggregateData` (and anywhere `USERS_MAP` is used), prefer `seatsFromDb` when available. The shape maps directly: `email → { name: display_name, entity, seatTier: seat_tier, spendLimit: spend_limit_aud, isBenchmark: is_benchmark }`.

This is backward-compatible — if Supabase is not configured, `seatsFromDb` stays null and the hardcoded USERS_MAP is used as before.

### 2. Update `handleSavePeriod` to populate the new tables

When saving a period, after inserting `period_users`, also insert into:
- `period_model_breakdown` — iterate each user's `modelBreakdown` object, insert one row per model class
- `period_product_breakdown` — iterate each user's `productBreakdown` object, insert one row per product
- Set `code_spend_usd` and `code_tokens` on the `period_users` rows from `codeData`

These are batch inserts that run in parallel with `period_users` (use `Promise.all`).

### 3. Update the auto-restore to refresh trend data after seats load

The `trendFlatRows` fetch (at ~line 2388) should also join `period_model_breakdown` for the trend chart data. Add a second fetch:

```js
const { data: modelTrends } = await supabaseClient
  .from("period_model_breakdown")
  .select("email, model_class, spend_usd, tokens, period_id, periods(label, date_from, date_to)");
```

Store in new state `const [modelTrendRows, setModelTrendRows] = useState([])`.

### 4. Sync `dashboard.jsx` with `index.html`

After all `index.html` changes are made, regenerate `src/dashboard.jsx` to match (ESM import header + `export default App` footer, same script body).

---

## Migration execution plan

Apply in this exact order using `mcp__supabase-frank-dashboard__apply_migration`. Each is a separate named migration.

### Migration 1: `fix_constraints_and_indexes`
```sql
-- P1-A: unique constraint on period_users
ALTER TABLE public.period_users
  ADD CONSTRAINT period_users_period_email_unique UNIQUE (period_id, email);

-- P1-B: make date columns NOT NULL (safe — 0 rows currently)
ALTER TABLE public.periods
  ALTER COLUMN date_from SET NOT NULL,
  ALTER COLUMN date_to   SET NOT NULL;

-- P1-C: composite index on periods dates
CREATE INDEX IF NOT EXISTS periods_dates_idx ON public.periods (date_from, date_to);

-- P1-D: unique constraint on document_chunks
ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_upload_chunk_unique UNIQUE (upload_id, chunk_index);
```

### Migration 2: `add_usage_rows_table`
```sql
CREATE TABLE IF NOT EXISTS public.usage_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id         uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  period_id         uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  user_email        text NOT NULL,
  model_id          text NOT NULL,
  model_class       text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  product           text,
  requests          integer NOT NULL DEFAULT 0,
  prompt_tokens     bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens      bigint GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  net_spend_usd     numeric(12,6) NOT NULL DEFAULT 0,
  row_date          date,
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT usage_rows_upload_user_model_product_unique
    UNIQUE (upload_id, user_email, model_id, product)
);

CREATE INDEX IF NOT EXISTS usage_rows_upload_id_idx    ON public.usage_rows (upload_id);
CREATE INDEX IF NOT EXISTS usage_rows_user_email_idx   ON public.usage_rows (user_email);
CREATE INDEX IF NOT EXISTS usage_rows_model_class_idx  ON public.usage_rows (model_class);
CREATE INDEX IF NOT EXISTS usage_rows_row_date_idx     ON public.usage_rows (row_date);
CREATE INDEX IF NOT EXISTS usage_rows_upload_user_idx  ON public.usage_rows (upload_id, user_email);

ALTER TABLE public.usage_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_rows_select_anon"         ON public.usage_rows FOR SELECT TO anon USING (true);
CREATE POLICY "usage_rows_insert_anon"         ON public.usage_rows FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "usage_rows_delete_anon"         ON public.usage_rows FOR DELETE TO anon USING (true);
CREATE POLICY "usage_rows_select_authenticated" ON public.usage_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "usage_rows_insert_authenticated" ON public.usage_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "usage_rows_delete_authenticated" ON public.usage_rows FOR DELETE TO authenticated USING (true);
```

### Migration 3: `add_period_breakdown_tables`
```sql
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

CREATE POLICY "pmb_select_anon"          ON public.period_model_breakdown FOR SELECT TO anon USING (true);
CREATE POLICY "pmb_insert_anon"          ON public.period_model_breakdown FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pmb_delete_anon"          ON public.period_model_breakdown FOR DELETE TO anon USING (true);
CREATE POLICY "pmb_select_authenticated" ON public.period_model_breakdown FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmb_insert_authenticated" ON public.period_model_breakdown FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pmb_delete_authenticated" ON public.period_model_breakdown FOR DELETE TO authenticated USING (true);

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

CREATE POLICY "ppb_select_anon"          ON public.period_product_breakdown FOR SELECT TO anon USING (true);
CREATE POLICY "ppb_insert_anon"          ON public.period_product_breakdown FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "ppb_delete_anon"          ON public.period_product_breakdown FOR DELETE TO anon USING (true);
CREATE POLICY "ppb_select_authenticated" ON public.period_product_breakdown FOR SELECT TO authenticated USING (true);
CREATE POLICY "ppb_insert_authenticated" ON public.period_product_breakdown FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ppb_delete_authenticated" ON public.period_product_breakdown FOR DELETE TO authenticated USING (true);
```

### Migration 4: `add_seats_table`
```sql
CREATE TABLE IF NOT EXISTS public.seats (
  email           text PRIMARY KEY,
  display_name    text NOT NULL,
  entity          text NOT NULL CHECK (entity IN ('Frank Advisory', 'Frank Law')),
  seat_tier       text NOT NULL DEFAULT 'Standard' CHECK (seat_tier IN ('Standard', 'Premium')),
  spend_limit_aud numeric(10,2),
  is_benchmark    boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Read-only for anon (dashboard loads seat config)
CREATE POLICY "seats_select_anon"          ON public.seats FOR SELECT TO anon USING (true);
-- Full CRUD for authenticated (admin manages seats)
CREATE POLICY "seats_select_authenticated" ON public.seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "seats_insert_authenticated" ON public.seats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "seats_update_authenticated" ON public.seats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "seats_delete_authenticated" ON public.seats FOR DELETE TO authenticated USING (true);

-- Seed the 8 current seats
INSERT INTO public.seats (email, display_name, entity, seat_tier, spend_limit_aud, is_benchmark) VALUES
  ('trowley@frankadvisory.com.au', 'Travis Rowley',  'Frank Advisory', 'Standard', NULL,   true),
  ('alex@frankadvisory.com.au',    'Alex',            'Frank Advisory', 'Premium',  NULL,   false),
  ('andrea@frankadvisory.com.au',  'Andrea',          'Frank Advisory', 'Standard', NULL,   false),
  ('rsharma@frankadvisory.com.au', 'Reginald Sharma', 'Frank Advisory', 'Standard', 190.00, false),
  ('tbrcic@franklaw.com.au',       'Tamara Brcic',    'Frank Law',      'Standard', 10.00,  false),
  ('bagar@franklaw.com.au',        'Bahar Agar',      'Frank Law',      'Standard', 20.00,  false),
  ('bwoodward@franklaw.com.au',    'Ben Woodward',    'Frank Law',      'Standard', NULL,   false),
  ('rlyons@franklaw.com.au',       'Rhys Lyons',      'Frank Law',      'Standard', 50.00,  false)
ON CONFLICT (email) DO NOTHING;
```

### Migration 5: `add_data_quality_fixes`
```sql
-- P2-D: file_type constraint
ALTER TABLE public.uploads
  ADD CONSTRAINT uploads_file_type_check
  CHECK (file_type IN ('anthropic-csv', 'code-csv', 'conversations', 'projects', 'memories', 'users'));

-- P2-E: Claude Code columns on period_users
ALTER TABLE public.period_users
  ADD COLUMN IF NOT EXISTS code_spend_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS code_tokens     bigint;

-- P2-F: period FK on uploads
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS uploads_period_id_idx
  ON public.uploads (period_id) WHERE period_id IS NOT NULL;

-- P3-A: fix numeric precision
ALTER TABLE public.period_users
  ALTER COLUMN total_spend_usd TYPE numeric(12,6),
  ALTER COLUMN opus_pct        TYPE numeric(5,2),
  ALTER COLUMN fluency_score   TYPE numeric(5,2);

-- P3-B: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- P3-C: file_size to bigint
ALTER TABLE public.uploads ALTER COLUMN file_size TYPE bigint;
```

### Migration 6: `add_initiatives_table`
```sql
CREATE TABLE IF NOT EXISTS public.initiatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  owner         text,
  target_metric text,
  current_value text,
  status        text NOT NULL DEFAULT 'Planned'
                CHECK (status IN ('Planned', 'In Progress', 'Done', 'At Risk')),
  notes         text,
  sort_order    integer,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE TRIGGER initiatives_updated_at
  BEFORE UPDATE ON public.initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "initiatives_select_anon"          ON public.initiatives FOR SELECT TO anon USING (true);
CREATE POLICY "initiatives_insert_anon"          ON public.initiatives FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "initiatives_update_anon"          ON public.initiatives FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "initiatives_delete_anon"          ON public.initiatives FOR DELETE TO anon USING (true);
CREATE POLICY "initiatives_select_authenticated" ON public.initiatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "initiatives_insert_authenticated" ON public.initiatives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "initiatives_update_authenticated" ON public.initiatives FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "initiatives_delete_authenticated" ON public.initiatives FOR DELETE TO authenticated USING (true);

-- Seed the 3 default initiatives (from DEFAULT_INITIATIVES in index.html)
INSERT INTO public.initiatives (name, owner, target_metric, current_value, status, notes, sort_order) VALUES
  ('Reduce Opus usage to <40%',    'Travis Rowley', 'Opus %',        '~60%',  'In Progress', 'Target driven by cost optimisation', 1),
  ('Activate all 8 seats',         'Travis Rowley', 'Active seats',  '5 / 8', 'In Progress', 'Law team onboarding in progress',    2),
  ('Monthly AI governance report', 'Travis Rowley', 'Report cadence','Ad hoc','Planned',      'Automate via Module 8',              3)
ON CONFLICT DO NOTHING;
```

---

## Edge Function rewrite — `supabase/functions/ingest-process/index.ts`

The full file needs to be replaced (it is ~177 lines currently). The new version adds CSV parsing and `usage_rows` insertion while keeping all existing embedding logic intact.

Key additions:

```typescript
// Model classification (mirrors MODEL_CLASS in index.html)
function classifyModel(modelId: string): string {
  const id = (modelId || "").toLowerCase();
  if (id.includes("opus")) return "Opus";
  if (id.includes("sonnet")) return "Sonnet";
  if (id.includes("haiku")) return "Haiku";
  return "Other";
}

// Simple CSV parser (handles quoted fields with commas)
function parseCSVRows(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const values: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").replace(/^"|"$/g, "")]));
  });
}

// Ingest Anthropic CSV rows into usage_rows table
async function ingestUsageRows(
  sb: ReturnType<typeof createClient>,
  uploadId: string,
  fileName: string,
  text: string,
): Promise<void> {
  // Extract date from filename (YYYY-MM-DD-to-YYYY-MM-DD)
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})-to-/);
  const rowDate = dateMatch ? dateMatch[1] : null;

  const rows = parseCSVRows(text);
  if (!rows.length) return;

  // Validate headers
  const required = ["user_email", "model", "product", "total_requests",
                    "total_prompt_tokens", "total_completion_tokens", "total_net_spend_usd"];
  if (!required.every(h => h in rows[0])) return; // not an Anthropic CSV

  // Delete existing rows for this upload (idempotency)
  await sb.from("usage_rows").delete().eq("upload_id", uploadId);

  // Map and batch insert (500 rows per batch)
  const insertRows = rows
    .filter(r => r.user_email && r.model)
    .map(r => ({
      upload_id:         uploadId,
      user_email:        r.user_email.toLowerCase().trim(),
      model_id:          r.model.trim(),
      model_class:       classifyModel(r.model),
      product:           r.product?.trim() || null,
      requests:          parseInt(r.total_requests || "0", 10) || 0,
      prompt_tokens:     parseInt(r.total_prompt_tokens || "0", 10) || 0,
      completion_tokens: parseInt(r.total_completion_tokens || "0", 10) || 0,
      net_spend_usd:     parseFloat(r.total_net_spend_usd || "0") || 0,
      row_date:          rowDate,
    }));

  const batchSize = 500;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const { error } = await sb.from("usage_rows").insert(insertRows.slice(i, i + batchSize));
    if (error) console.error("usage_rows insert error:", error);
  }
}
```

In the main `Deno.serve` handler, after downloading the file and getting `text`, add:
```typescript
// Parse Anthropic CSV into usage_rows (runs regardless of OpenRouter key)
if (row.file_type === "anthropic-csv") {
  await ingestUsageRows(sb, uploadId, row.file_name, text);
}
```

This runs **before** the embedding logic. The full deployment should be done via `mcp__supabase-frank-dashboard__deploy_edge_function` with the complete updated `index.ts` content.

---

## `index.html` changes (detailed)

All changes to `index.html` must also be mirrored in `src/dashboard.jsx`. After completing all `index.html` edits, regenerate `dashboard.jsx` (ESM import header + same script body + `export default App` footer).

### Change 1: Add `seatsFromDb` state and load effect

Near the other state declarations (~line 2338), add:
```js
const [seatsFromDb, setSeatsFromDb] = useState(null);
```

After the supabaseClient init effects, add a new useEffect:
```js
useEffect(() => {
  if (!supabaseClient) { setSeatsFromDb(null); return; }
  supabaseClient
    .from("seats")
    .select("email, display_name, entity, seat_tier, spend_limit_aud, is_benchmark, active")
    .eq("active", true)
    .then(({ data, error }) => {
      if (!error && data?.length) setSeatsFromDb(data);
    });
}, [supabaseClient]);
```

### Change 2: Use `seatsFromDb` in `aggregateData` call

The `aggregateData` function signature is `aggregateData(rows, audRate, behavior, codeData)`. It internally uses the hardcoded `USERS_MAP`.

Pass `seatsFromDb` as a 5th argument and modify `aggregateData` to accept an optional `seatsOverride` parameter. When `seatsOverride` is provided and non-null, build the users map from it instead of `USERS_MAP`:

```js
// In aggregateData signature (~line 696):
function aggregateData(rows, audRate, behavior, codeData, seatsOverride = null) {
  // Build usersMap: prefer seatsOverride if available
  const usersMap = seatsOverride
    ? Object.fromEntries(seatsOverride.map(s => [s.email, {
        name: s.display_name,
        entity: s.entity,
        seatTier: s.seat_tier,
        spendLimit: s.spend_limit_aud,
        isBenchmark: s.is_benchmark,
      }]))
    : USERS_MAP;
  // rest of function uses usersMap instead of USERS_MAP
  ...
}
```

Update the call site (~line 2450):
```js
const agg = aggregateData(rows, settings.audRate, behavior, codeData, seatsFromDb);
```

### Change 3: Update `handleSavePeriod` to populate new tables

After inserting `period_users`, add two parallel inserts:

```js
// period_model_breakdown rows
const modelBreakdownRows = [];
for (const u of users) {
  for (const [modelClass, data] of Object.entries(u.modelBreakdown || {})) {
    if (data.spend > 0 || data.tokens > 0) {
      modelBreakdownRows.push({
        period_id: periodId,
        email: u.email,
        model_class: modelClass,
        spend_usd: data.spend || 0,
        tokens: data.tokens || 0,
        requests: data.requests || 0,
      });
    }
  }
}

// period_product_breakdown rows
const productBreakdownRows = [];
for (const u of users) {
  for (const [product, data] of Object.entries(u.productBreakdown || {})) {
    if (data.spend > 0 || data.tokens > 0) {
      productBreakdownRows.push({
        period_id: periodId,
        email: u.email,
        product,
        spend_usd: data.spend || 0,
        tokens: data.tokens || 0,
        requests: data.requests || 0,
      });
    }
  }
}

await Promise.all([
  modelBreakdownRows.length
    ? supabaseClient.from("period_model_breakdown").insert(modelBreakdownRows)
    : Promise.resolve(),
  productBreakdownRows.length
    ? supabaseClient.from("period_product_breakdown").insert(productBreakdownRows)
    : Promise.resolve(),
]);
```

Also add `code_spend_usd` and `code_tokens` to the `period_users` insert — look up from `codeData` state by `u.email`.

### Change 4: Fetch `period_model_breakdown` for trend charts

Add a second fetch in the trendFlatRows useEffect:
```js
const { data: modelBreakdowns } = await supabaseClient
  .from("period_model_breakdown")
  .select("period_id, email, model_class, spend_usd, tokens");
if (!cancelled && modelBreakdowns) setModelTrendRows(modelBreakdowns);
```

Add state: `const [modelTrendRows, setModelTrendRows] = useState([])`.

### Change 5: Wire `initiatives` table

Replace the `app_settings` initiatives persistence with a proper CRUD pattern against the `initiatives` table:

- **Load:** On startup, fetch `initiatives` ordered by `sort_order`. If empty, seed from `DEFAULT_INITIATIVES` (insert them to the table).
- **Update:** Each edit calls `supabaseClient.from("initiatives").update({...}).eq("id", id)` instead of overwriting the whole array.
- **Add:** `.insert({...})` with the new initiative.
- **Delete:** `.delete().eq("id", id)`.

The `initiatives` state shape stays the same — just the persistence layer changes.

Remove `initiatives` from `app_settings` saves (keep `dashboard_settings` and `spend_overrides` there).

---

## Verification checklist

Run these after each migration group is applied. Use `mcp__supabase-frank-dashboard__execute_sql` for each query.

### After Migration 1
```sql
-- Unique constraints
SELECT conname FROM pg_constraint
WHERE conrelid = 'period_users'::regclass AND contype = 'u';
-- Expect: period_users_period_email_unique

SELECT conname FROM pg_constraint
WHERE conrelid = 'document_chunks'::regclass AND contype = 'u';
-- Expect: document_chunks_upload_chunk_unique

-- NOT NULL on periods
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'periods' AND column_name IN ('date_from', 'date_to');
-- Expect: both NO

-- Index on periods
SELECT indexname FROM pg_indexes WHERE tablename = 'periods';
-- Expect: periods_dates_idx present
```

### After Migration 2
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'usage_rows' ORDER BY ordinal_position;
-- Expect: 14 columns including total_tokens (generated)

SELECT policyname FROM pg_policies WHERE tablename = 'usage_rows';
-- Expect: 6 policies
```

### After Migration 3
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('period_model_breakdown', 'period_product_breakdown');
-- Expect: both present

SELECT policyname FROM pg_policies
WHERE tablename IN ('period_model_breakdown', 'period_product_breakdown');
-- Expect: 6 policies per table = 12 total
```

### After Migration 4
```sql
SELECT email, entity, seat_tier, spend_limit_aud, is_benchmark
FROM public.seats ORDER BY entity, email;
-- Expect: 8 rows with correct data
```

### After Migration 5
```sql
-- file_type constraint
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'uploads' AND constraint_name = 'uploads_file_type_check';

-- code columns on period_users
SELECT column_name FROM information_schema.columns
WHERE table_name = 'period_users' AND column_name IN ('code_spend_usd', 'code_tokens');

-- period_id on uploads
SELECT column_name FROM information_schema.columns
WHERE table_name = 'uploads' AND column_name = 'period_id';

-- Trigger on app_settings
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'app_settings';
-- Expect: app_settings_updated_at
```

### After Migration 6
```sql
SELECT id, name, status, sort_order FROM public.initiatives ORDER BY sort_order;
-- Expect: 3 rows

SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'initiatives';
-- Expect: initiatives_updated_at
```

### After Edge Function deploy
```sql
-- After uploading an Anthropic CSV through the dashboard:
SELECT COUNT(*) FROM public.usage_rows;
-- Expect: > 0 (one row per CSV data row)

SELECT model_class, COUNT(*), SUM(net_spend_usd) FROM public.usage_rows
GROUP BY model_class;
-- Expect: Opus, Sonnet, Haiku rows with matching spend totals
```

### After index.html code changes + deploy
- Load `https://ai-governance-dashboard-production.up.railway.app/`
- Open browser console — no errors
- Upload an Anthropic CSV → check `usage_rows` count increases
- Click "Save period snapshot" → check `periods`, `period_users`, `period_model_breakdown`, `period_product_breakdown` all have rows
- Reload → settings, initiatives, and spend overrides persist
- Check that seats loaded from DB match the 8 users (verify spend limits)

---

## Commit and deploy instructions

After all migrations and code changes:

```bash
# Stage all changed files
git add index.html src/dashboard.jsx docs/supabase-phase2.sql docs/AGENT_HANDOFF.md CLAUDE.md supabase/functions/ingest-process/index.ts

# Commit
git commit -m "feat: schema hardening — usage_rows, seats, normalized breakdowns, constraints

- Add usage_rows table for raw CSV analytics (every row from Anthropic CSV)
- Add seats table seeded with 8 current users (replaces hardcoded USERS_MAP)
- Add period_model_breakdown and period_product_breakdown for SQL analytics
- Add initiatives table (replaces app_settings JSONB blob)
- Fix: unique constraints on period_users and document_chunks
- Fix: NOT NULL on periods.date_from/date_to, composite index
- Fix: numeric precision on spend/score columns
- Fix: file_type CHECK constraint on uploads
- Fix: updated_at trigger on app_settings and initiatives
- Add code_spend_usd + code_tokens to period_users
- Add period_id FK on uploads for traceability
- Wire ingest-process Edge Function to populate usage_rows on CSV ingest
- index.html: load seats from DB, update handleSavePeriod, wire initiatives table"

git push origin main
```

Railway will auto-deploy on push. Allow 2 minutes.

---

## After this is done — what's unlocked

With this schema in place, the following dashboard features become straightforward SQL queries:

| Feature | Query against |
|---------|--------------|
| Opus % trend over time | `period_model_breakdown` grouped by `periods.label` |
| Spend by model per user (trend) | `period_model_breakdown` + `periods` join |
| Per-user token trend | `period_users` time series |
| Day-level usage drill-down | `usage_rows` filtered by `row_date` |
| Product analysis (Chat vs Cowork) | `period_product_breakdown` or `usage_rows` |
| Seat management UI | `seats` table CRUD |
| Initiative tracking | `initiatives` table with row-level edits |
| "Which file produced this snapshot?" | `uploads.period_id` FK |
| Savings calculator with historical data | `period_model_breakdown` Opus → Sonnet delta |
| RAG query ("show me AI policy notes") | `document_chunks` vector similarity search |

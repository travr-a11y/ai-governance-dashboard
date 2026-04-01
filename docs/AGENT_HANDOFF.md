# Agent Handoff — Frank Group AI Governance Dashboard

**Purpose:** Read this + `CLAUDE.md` at the start of any new session. Between the two you have full context — no need to replay the conversation history.

**Repo:** `travr-a11y/ai-governance-dashboard`
**Railway:** `https://ai-governance-dashboard-production.up.railway.app/`
**Supabase project:** `pwuapjdfrdbgcekrwlpr` — `https://pwuapjdfrdbgcekrwlpr.supabase.co`

---

## Current phase: Phase 3 — Schema hardening (code done, migrations pending)

All code changes are committed. **6 SQL migrations still need to be applied** in the Supabase SQL Editor before the new tables are live. See `docs/schema-hardening-migrations.sql`.

---

## What is built and live

### Dashboard (static site)
- React 18 + Recharts + Babel-in-browser in **`index.html`** (no bundler)
- **`src/dashboard.jsx`** — ESM mirror, kept in sync; dev reference only
- 9 modules: Data Ingestion, AI Adoption, Model Governance, User Spend & Tokens, Product Analysis, Savings Calculator, Initiative Tracker, Report Generator, Coaching & Leaderboard
- Deploy: `git push origin main` → Railway auto-deploys via `npm start` (prestart writes `dashboard-config.json` from env vars)

### Supabase schema (all live, all verified)

**7 Phase 2 migrations applied** (see previous history). **6 Phase 3 migrations pending** (run `docs/schema-hardening-migrations.sql` in Supabase SQL Editor).

**Phase 2 tables (live):**

| Table | Key columns | Notes |
|-------|-------------|-------|
| `uploads` | id, file_name, file_type, storage_path, file_size, uploaded_by, content_hash, period_id | SHA-256 dedup; file_type CHECK; period_id FK (Migration 5) |
| `periods` | id, label, date_from NOT NULL, date_to NOT NULL | date columns are NOT NULL after Migration 1 |
| `period_users` | period_id→periods, email, total_spend_usd, total_tokens, opus_pct, fluency_score, model_breakdown (jsonb), product_breakdown (jsonb), code_spend_usd, code_tokens | code columns added by Migration 5 |
| `document_chunks` | upload_id→uploads, chunk_index, chunk_text, embedding vector(1536), file_type, metadata | RAG; UNIQUE(upload_id, chunk_index) after Migration 1 |
| `app_settings` | key (PK), value (jsonb), updated_at | Keys: dashboard_settings, spend_overrides (initiatives moved to own table) |

**Phase 3 tables (pending migrations):**

| Table | Purpose | Migration |
|-------|---------|-----------|
| `usage_rows` | Raw Anthropic CSV rows — all analytics without re-parsing | 2 |
| `period_model_breakdown` | Normalised model mix per period/user | 3 |
| `period_product_breakdown` | Normalised product mix per period/user | 3 |
| `seats` | 8 users (replaces hardcoded USERS_MAP in index.html) | 4 |
| `initiatives` | Module 7 rows (replaces app_settings JSONB blob) | 6 |

**RLS policy pattern:** All tables have SELECT + INSERT + DELETE for both `anon` and `authenticated`. `app_settings` also has UPDATE. `seats` has full CRUD for authenticated, SELECT-only for anon.

**Storage:** Private bucket `uploads`. Full CRUD policies for anon + authenticated on `storage.objects` where `bucket_id = 'uploads'`.

### Edge Function
- **`ingest-process`** — ACTIVE, `verify_jwt: true`
- Source: `supabase/functions/ingest-process/index.ts`
- What it does:
  1. Downloads file from Storage
  2. **If `anthropic-csv`**: parses CSV rows → inserts into `usage_rows` (runs without OpenRouter key)
  3. Chunks text (JSON-aware for conversations/projects/memories/users)
  4. Calls OpenRouter `openai/text-embedding-3-small` for 1536-dim embeddings → `document_chunks`
- Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-injected), `OPENROUTER_API_KEY` (optional — skips embeddings if missing but still populates `usage_rows`)

---

## How data flows

```
User uploads file (Module 1)
  → parsed into React state (rawRows, convItems, etc.)
  → if Supabase configured:
      → SHA-256 hash → check uploads.content_hash for dupe → skip if exists
      → upload raw file to Storage (uploads bucket)
      → insert uploads row (file_name, file_type, storage_path, content_hash, etc.)
      → invoke ingest-process Edge Function → document_chunks (RAG embeddings)

On page load:
  → fetch uploads table → download latest per file_type → re-parse into state
  → fetch app_settings → hydrate settings, initiatives, spendOverrides
  → fetch period_users (with periods join) → populate trend charts

"Save period snapshot" (Module 1 button):
  → check for existing period with same date range → delete if found
  → insert into periods
  → batch insert all 8 users into period_users (email, spend, tokens, fluency, model_breakdown, etc.)
  → re-fetch period_users for trend charts

Settings / initiatives / spend overrides:
  → auto-save on every change via saveAppSetting() → app_settings upsert
  → protected by settingsLoadedFromDbRef (prevents overwriting DB values on first load)
```

---

## Key code locations in index.html

| Function / hook | Approx line | Purpose |
|-----------------|-------------|---------|
| `sha256HexFromUtf8` | ~539 | SHA-256 hash for content dedup |
| `saveAppSetting` | ~539 | Fire-and-forget upsert to app_settings |
| `persistIngestToSupabase` | ~548 | Dedup check → Storage upload → uploads insert → invoke RAG |
| `aggregateData` | ~706 | Main aggregation: spend/tokens/fluency per user; accepts optional `seatsOverride` (5th arg) |
| `buildBehaviorMaps` | ~643 | Conversation/project/memory signals per user |
| Supabase init effects | ~2360–2430 | createClient, auth session, period_users + period_model_breakdown fetch, uploads list, seats load |
| `app_settings` load effect | ~2494 | Fetch and hydrate settings/spendOverrides (initiatives now from `initiatives` table) |
| `initiatives` load effect | ~2519 | Fetch and hydrate `initiatives` table on startup |
| `app_settings` save effects | ~2540–2550 | Auto-save dashboard_settings + spend_overrides (guarded by settingsLoadedFromDbRef) |
| `handleSavePeriod` | ~2648 | Write period snapshot to periods + period_users + period_model_breakdown + period_product_breakdown |
| `handleInitiativeAdd/Update/Delete` | ~2779–2820 | Row-level CRUD callbacks for initiatives table |
| `invokeRagAfterUpload` | ~2460 | Calls ingest-process Edge Function after upload |
| `persistToCloud` memo | ~2470 | Object passed to Module1 with supabase client + callbacks |
| App JSX / module props | ~2840+ | All module props assembled here |

---

## Config

### Local dev
Create `dashboard-config.json` at repo root (gitignored):
```json
{
  "SUPABASE_URL": "https://pwuapjdfrdbgcekrwlpr.supabase.co",
  "SUPABASE_ANON_KEY": "<anon key from Supabase Dashboard → Project Settings → API>",
  "OPENROUTER_API_KEY": "<optional, for Module 8 AI narrative>"
}
```

### Railway env vars (already set)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY` (for Module 8 report AI)

---

## What to build next

### Immediate: apply migrations
Run `docs/schema-hardening-migrations.sql` in Supabase SQL Editor (project `pwuapjdfrdbgcekrwlpr`). Run Migration 1 first, then 2–6 in order. Then redeploy the Edge Function (supabase functions deploy ingest-process).

### After migrations are live

| Priority | Feature | Notes |
|----------|---------|-------|
| High | Historical trend charts in Modules 2 + 4 | `period_model_breakdown` + `period_users` are ready; need chart UI |
| High | IVFFlat vector index on document_chunks | Add once 100+ rows |
| Medium | `usage_rows` analytics charts | Day-level spend/model drill-down; data flows in via Edge Function after Anthropic CSV re-upload |
| Medium | Seat management UI | `seats` table CRUD; add/remove seats without code deploy |
| Medium | RAG query endpoint | Edge Function to search document_chunks by embedding similarity |
| Medium | Auto-fetch Anthropic CSV | Anthropic admin API key in Railway env; scheduled fetch |
| Low | Auto-email reports | M365 SMTP |
| Low | Auth hardening | Domain allowlist at Supabase provider level |

---

## File map (key files)

```
index.html                    ← Live app. Source of truth. All changes go here first.
src/dashboard.jsx             ← ESM mirror. Sync after every index.html change.
CLAUDE.md                     ← Full project spec (modules, constants, aggregation logic)
docs/AGENT_HANDOFF.md         ← This file
docs/supabase-phase2.sql      ← Full idempotent SQL schema (all 5 tables + RLS + storage)
docs/DEPLOYMENT.md            ← Git + Railway deploy workflow
supabase/
  config.toml                 ← Supabase CLI config
  functions/ingest-process/
    index.ts                  ← RAG Edge Function (deployed, ACTIVE)
dashboard-config.example.json ← Template for local config
.gitignore                    ← dashboard-config.json, .env, node_modules, DS_Store
```

---

## Security posture

- Anon key is exposed in browser (by design — static site). RLS is the access control layer.
- All RLS policies use `USING (true)` — intentional for this internal team tool with PIN-gated admin tab.
- `dashboard-config.json` is gitignored. Never commit it.
- Edge Function uses service role key server-side (safe — not exposed to browser).
- Railway URL is the only public entry point. No Supabase URL is linked from the site.

---

## Suggested first message for a new session

> Read `docs/AGENT_HANDOFF.md` and `CLAUDE.md`. Task: [describe work here].

# Agent Handoff — Frank Group AI Governance Dashboard

**Purpose:** Read this + `CLAUDE.md` at the start of any new session. Between the two you have full context — no need to replay the conversation history.

**Repo:** `travr-a11y/ai-governance-dashboard`
**Railway:** `https://ai-governance-dashboard-production.up.railway.app/`
**Supabase project:** `pwuapjdfrdbgcekrwlpr` — `https://pwuapjdfrdbgcekrwlpr.supabase.co`

---

## Current phase: Phase 2 COMPLETE

The persistence layer is fully operational. Everything is live, committed, and deployed.

---

## What is built and live

### Dashboard (static site)
- React 18 + Recharts + Babel-in-browser in **`index.html`** (no bundler)
- **`src/dashboard.jsx`** — ESM mirror, kept in sync; dev reference only
- 9 modules: Data Ingestion, AI Adoption, Model Governance, User Spend & Tokens, Product Analysis, Savings Calculator, Initiative Tracker, Report Generator, Coaching & Leaderboard
- Deploy: `git push origin main` → Railway auto-deploys via `npm start` (prestart writes `dashboard-config.json` from env vars)

### Supabase schema (all live, all verified)

**7 migrations applied in order:**

| Migration | What it added |
|-----------|---------------|
| `add_uploads_table_and_storage_bucket` | `uploads` table + private Storage bucket `uploads` (50 MiB) |
| `add_periods_and_period_users_tables` | `periods` + `period_users` with FK cascade |
| `add_anon_rls_policies_for_cloud_persistence` | Anon key access (no Magic Link required) |
| `add_content_hash_to_uploads` | SHA-256 dedup column + unique partial index |
| `add_vector_extension_and_document_chunks` | pgvector extension + `document_chunks` (vector(1536)) |
| `add_delete_policies_for_periods` | DELETE on periods/period_users (needed for upsert-by-date) |
| `add_app_settings_table` | Key-value table for settings, initiatives, spend overrides |

**5 tables:**

| Table | Key columns | Notes |
|-------|-------------|-------|
| `uploads` | id, file_name, file_type, storage_path, file_size, uploaded_by, content_hash | SHA-256 dedup; unique partial index on content_hash |
| `periods` | id, label, date_from, date_to | Reporting period metadata |
| `period_users` | period_id→periods, email, total_spend_usd, total_tokens, opus_pct, fluency_score, model_breakdown (jsonb), product_breakdown (jsonb) | Per-user snapshot per period |
| `document_chunks` | upload_id→uploads, chunk_index, chunk_text, embedding vector(1536), file_type, metadata | RAG; Edge Function writes here |
| `app_settings` | key (PK), value (jsonb), updated_at | Keys: dashboard_settings, initiatives, spend_overrides |

**RLS policy pattern:** All tables have SELECT + INSERT for both `anon` and `authenticated`. `uploads`, `document_chunks`, `app_settings` have DELETE. `app_settings` also has UPDATE (needed for upsert). `periods` and `period_users` have DELETE (for re-saving same date range).

**Storage:** Private bucket `uploads`. Full CRUD policies for anon + authenticated on `storage.objects` where `bucket_id = 'uploads'`.

### Edge Function
- **`ingest-process`** — ACTIVE, `verify_jwt: true`
- Source: `supabase/functions/ingest-process/index.ts`
- What it does: receives `{ upload_id }`, downloads file from Storage, chunks text (JSON-aware for conversations/projects/memories/users), calls OpenRouter `openai/text-embedding-3-small` for 1536-dim embeddings, deletes old chunks for upload_id, inserts new ones into `document_chunks`
- Env vars needed: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-injected), `OPENROUTER_API_KEY` (set as secret in Supabase Dashboard — gracefully skips if missing)

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
| `aggregateData` | ~696 | Main aggregation: spend/tokens/fluency per user |
| `buildBehaviorMaps` | ~643 | Conversation/project/memory signals per user |
| Supabase init effects | ~2360–2410 | createClient, auth session, period_users fetch, uploads list fetch |
| `app_settings` load effect | ~2482 | Fetch and hydrate settings/initiatives/spendOverrides |
| `app_settings` save effects | ~2509–2522 | Auto-save on state change (guarded by settingsLoadedFromDbRef) |
| `handleSavePeriod` | ~2619 | Write period snapshot to periods + period_users |
| `invokeRagAfterUpload` | ~2405 | Calls ingest-process Edge Function after upload |
| `persistToCloud` memo | ~2412 | Object passed to Module1 with supabase client + callbacks |
| App JSX / module props | ~2780+ | All module props assembled here |

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

## What to build next (Phase 3 ideas)

| Priority | Feature | Notes |
|----------|---------|-------|
| High | Historical trend charts in Modules 2 + 4 | Infrastructure is ready (period_users has data); need chart UI |
| High | IVFFlat vector index on document_chunks | Add once 100+ rows; currently commented out in sql file |
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

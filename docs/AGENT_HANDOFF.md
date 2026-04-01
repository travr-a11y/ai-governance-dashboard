# Agent Handoff — The Frank Group AI Governance Dashboard

**Purpose:** Read this + `CLAUDE.md` at the start of any new session. Between the two you have full context — no need to replay the conversation history.

**Repo:** `travr-a11y/ai-governance-dashboard`
**Railway:** `https://ai-governance-dashboard-production.up.railway.app/`
**Supabase project:** `pwuapjdfrdbgcekrwlpr` — `https://pwuapjdfrdbgcekrwlpr.supabase.co`

---

## Current phase: Ingestion pipeline — automatic periods + date range picker

All code changes are committed. The automatic ingestion pipeline is live in `index.html` and `src/dashboard.jsx`. The updated Edge Function (`ingest-process`) needs to be deployed manually:

```bash
# With a Supabase access token set:
npx supabase functions deploy ingest-process --project-ref pwuapjdfrdbgcekrwlpr
# Or via Supabase Dashboard → Edge Functions → ingest-process → Deploy
```

If Phase 3 migrations haven't been applied yet: run `docs/schema-hardening-migrations.sql` in Supabase SQL Editor first (Migrations 1–6 in order), then deploy the Edge Function.

---

## What is built and live

### Dashboard (static site)
- React 18 + Recharts + Babel-in-browser in **`index.html`** (no bundler)
- **`src/dashboard.jsx`** — ESM mirror, kept in sync; dev reference only
- 9 modules: Data Ingestion, AI Adoption, Model Governance, User Spend & Tokens, Product Analysis, Savings Calculator, Initiative Tracker, Report Generator, Coaching & Leaderboard
- Deploy: `git push origin main` → Railway auto-deploys via `npm start` (prestart writes `dashboard-config.json` from env vars)

### Supabase schema (all live, all verified)

All 15 migrations applied (Phase 2 + Phase 3). See history in `docs/schema-hardening-migrations.sql`.

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `uploads` | File manifest, dedup via `content_hash` | file_name, file_type, storage_path, content_hash (UNIQUE partial), period_id FK |
| `periods` | Date ranges — now auto-created on ingest | label, date_from NOT NULL, date_to NOT NULL, is_auto bool, UNIQUE(date_from,date_to) |
| `usage_rows` | Raw Anthropic CSV rows — primary analytics source | user_email, model_id, model_class, product, requests, prompt_tokens, completion_tokens, total_tokens (GENERATED), net_spend_usd, row_date, upload_id FK |
| `seats` | 8 users seeded | email PK, display_name, entity, seat_tier, spend_limit_aud, is_benchmark, active |
| `period_users` | Legacy snapshot cache (dormant — nothing writes to it now) | — |
| `period_model_breakdown` | Legacy snapshot cache (dormant) | — |
| `period_product_breakdown` | Legacy snapshot cache (dormant) | — |
| `document_chunks` | RAG embeddings | embedding vector(1536) |
| `app_settings` | Key-value: dashboard_settings, spend_overrides | key PK, value jsonb |
| `initiatives` | Module 7 tracker | 5 rows seeded |

**RLS policy pattern:** All tables have SELECT + INSERT + DELETE for both `anon` and `authenticated`. `app_settings` also has UPDATE. `seats` has full CRUD for authenticated, SELECT-only for anon.

**Storage:** Private bucket `uploads`. Full CRUD policies for anon + authenticated on `storage.objects` where `bucket_id = 'uploads'`.

### Edge Function
- **`ingest-process`** — ACTIVE, `verify_jwt: true`
- Source: `supabase/functions/ingest-process/index.ts`
- What it does:
  1. Downloads file from Storage
  2. **If `anthropic-csv`**: parses CSV rows → inserts into `usage_rows`; **auto-upserts `periods`** from filename dates (new)
  3. Chunks text (JSON-aware for conversations/projects/memories/users)
  4. Calls OpenRouter `openai/text-embedding-3-small` for 1536-dim embeddings → `document_chunks`
- Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-injected), `OPENROUTER_API_KEY` (optional — skips embeddings if missing but still populates `usage_rows` and `periods`)

---

## How data flows

```
User uploads file (Module 1 — Admin tab)
  → parsed into React state (rawRows, convItems, etc.)
  → if Supabase configured:
      → SHA-256 hash → check uploads.content_hash for dupe
        → if duplicate: amber warning card shows filename + original upload date
        → if new: upload to Storage → insert uploads row
          → invoke ingest-process Edge Function
            → usage_rows populated (Anthropic CSV)
            → periods auto-upserted from filename dates (NEW)
            → document_chunks populated (if OpenRouter key set)
          → periods list re-fetched → date range picker auto-selects new period

On page load (when Supabase configured):
  → fetch periods → auto-select most recent → fetch usage_rows for that range → modules populate
  → fetch uploads table → download latest per file_type → re-parse into state (fallback)
  → fetch app_settings → hydrate settings, spendOverrides
  → fetch initiatives → hydrate Module 7
  → fetch seats → hydrate USERS_MAP override

Date range picker (header, always visible when Supabase configured):
  → period preset dropdown (auto-populated from periods table)
  → custom from/to date inputs
  → changing either → re-fetches usage_rows → all 9 modules update instantly
  → "Clear" button → reverts to CSV-parsed or sample data

Settings / initiatives / spend overrides:
  → auto-save on every change via saveAppSetting() → app_settings upsert
  → protected by settingsLoadedFromDbRef (prevents overwriting DB values on first load)
```

---

## Key code locations in index.html

| Function / hook | Approx line | Purpose |
|-----------------|-------------|---------|
| `daysBetween` | ~551 | Helper: days between two ISO date strings |
| `usageRowsToRawRows` | ~555 | Converts usage_rows DB shape → rawRows shape for aggregateData |
| `sha256HexFromUtf8` | ~568 | SHA-256 hash for content dedup |
| `saveAppSetting` | ~539 | Fire-and-forget upsert to app_settings |
| `persistIngestToSupabase` | ~575 | Dedup check (includes uploaded_at) → Storage upload → uploads insert → invoke RAG |
| `aggregateData` | ~725 | Main aggregation: spend/tokens/fluency per user |
| `buildBehaviorMaps` | ~660 | Conversation/project/memory signals per user |
| Supabase init effects | ~2380–2450 | createClient, auth session, period_users + period_model_breakdown fetch, uploads list, seats load |
| **Periods load effect** | ~2510 | Fetch periods from DB; auto-select most recent on first load |
| **usage_rows fetch effect** | ~2534 | Fetch usage_rows filtered by dateRangeFrom/dateRangeTo |
| `app_settings` load effect | ~2558 | Fetch and hydrate settings/spendOverrides |
| `initiatives` load effect | ~2582 | Fetch and hydrate initiatives table |
| `rows` derivation | ~2680 | `usageRowsData ? usageRowsToRawRows(...) : (rawRows \|\| SAMPLE_DATA)` |
| `liveUsersBase` useMemo | ~2692 | Passes `rows` to aggregateData |
| `invokeRagAfterUpload` | ~2495 | Calls ingest-process Edge Function after upload |
| `persistToCloud` memo | ~2500 | Object with supabase, onUploadsChanged, onPeriodsChanged, invokeRagAfterUpload |
| **Date range picker JSX** | ~2992 | Header UI: period dropdown + from/to date inputs + days label + Clear |
| **Duplicate warning cards** | Module1 JSX | Amber dismissible cards when same file re-uploaded |
| App JSX / module props | ~2855+ | All module props assembled here |

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

## UI redesign (latest change)

All 9 UI changes from `docs/UI_REDESIGN_PLAN.md` are implemented in `index.html` and mirrored to `src/dashboard.jsx`:

- `ROI_PRESETS` constant added after `USERS_MAP` (legal 40%, finance 35%, advisory 30% time savings benchmarks)
- `roleType` field added to every `USERS_MAP` entry (email-keyed): trowley/andrea/rsharma/tbrcic → "advisory"; alex → "finance"; bagar/bwoodward/rlyons → "legal"
- All module headings stripped of "Module X —" prefix; sub-headings added to each
- ROI stat boxes in AI Adoption (est. hours recaptured, est. value delivered, avg per person)
- Fluency scoring legend (collapsible) + tier band strip in AI Adoption
- Haiku colour updated to `#2563eb` (true blue)
- Max-width 1400px container, centred
- Mobile responsive CSS + classNames on key grid containers
- Australian date format (`en-AU`) on all date renders
- Per-module demo mode amber banner (modules 2–9 only)
- Cost Summary card in Data Ingestion (seat subscription + API usage + totals)
- Seat (A$/mo) and Period Total columns added to Team Spend table; totals row added
- Spend Notice banner in Team Spend for users ≥75% of monthly limit

---

## What to build next

| Priority | Feature | Notes |
|----------|---------|-------|
| **Now** | Deploy Edge Function | `npx supabase functions deploy ingest-process --project-ref pwuapjdfrdbgcekrwlpr` |
| High | Historical trend charts in Modules 2 + 4 | `usage_rows` filtered by date range is now the data source; build WoW/MoM views |
| High | IVFFlat vector index on document_chunks | Add once 100+ rows |
| Medium | `usage_rows` day-level drill-down | Date-bucketed spend/token charts |
| Medium | Seat management UI | `seats` table CRUD |
| Medium | RAG query endpoint | Edge Function to search document_chunks by embedding similarity |
| Low | Auto-fetch Anthropic CSV | API key in Railway env; scheduled fetch |
| Low | Auto-email reports | M365 SMTP |
| Low | Auth hardening | Domain allowlist at Supabase provider level |

---

## File map (key files)

```
index.html                    ← Live app. Source of truth. All changes go here first.
src/dashboard.jsx             ← ESM mirror. Sync after every index.html change.
CLAUDE.md                     ← Full project spec (modules, constants, aggregation logic)
docs/AGENT_HANDOFF.md         ← This file
docs/INGESTION_LAYER_PLAN.md  ← The plan that was just implemented (keep for reference)
docs/supabase-phase2.sql      ← Full idempotent SQL schema (all 5 tables + RLS + storage)
docs/DEPLOYMENT.md            ← Git + Railway deploy workflow
supabase/
  config.toml                 ← Supabase CLI config
  functions/ingest-process/
    index.ts                  ← RAG Edge Function (updated — needs deploy)
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

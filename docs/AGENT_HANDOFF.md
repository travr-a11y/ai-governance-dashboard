# Agent Handoff — The Frank Group AI Governance Dashboard

**Purpose:** Read this + `CLAUDE.md` at the start of any new session. Between them you have full context.

**Repo:** `travr-a11y/ai-governance-dashboard`
**Railway:** `https://ai-governance-dashboard-production.up.railway.app/`
**Supabase project:** `pwuapjdfrdbgcekrwlpr`

---

## Current phase: Live — UI Iteration 2 complete

Everything is committed and deployed on Railway. No pending migrations or deployments.

---

## What is built and live

### Dashboard
- React 18 + Recharts + Babel-in-browser in `index.html` (no bundler, no build step)
- `src/dashboard.jsx` — ESM mirror; dev reference only; sync after every `index.html` change
- **Three tabs:** Dashboard | Admin | Tools
- **9 modules** live:
  1. Data Ingestion (Admin tab)
  2. AI Adoption — fluency tiers, ROI stat boxes (token-session formula)
  3. Model Governance — Model Efficiency banner, pie chart with Legend, per-user table
  4. User Spend & Tokens — sortable, AUD live rate, Claude Code sub-rows
  5. Product Analysis — SURFACE_PALETTE brand bar colors
  6. Savings Calculator (Tools tab only)
  7. Initiative Tracker
  8. Report Generator (renders after Module 9; Railway key only, no UI paste)
  9. Coaching & Leaderboard — tier-based nudge copy, first names

### Admin tab panels
- Standard data ingestion + AUD rate + settings
- **ROI Settings** — hourly rate, mins per task, saving % by role (feeds Module 2)
- **Seat Configuration** — per-user Standard/Premium override
- **Team Members** — CRUD table; merges over USERS_MAP at runtime; auto-adds unknown emails from ingest

### Tools tab
- Savings Calculator (Module 6)
- Log a Win — Coming Soon card (future: time_logs table + self-reporting survey)

### Supabase schema (9 tables, all live)

| Table | Purpose |
|-------|---------|
| `uploads` | File manifest; SHA-256 content_hash dedup |
| `periods` | Date ranges — auto-created from CSV filename on ingest |
| `usage_rows` | Raw Anthropic CSV rows; primary analytics source |
| `seats` | 8 users seeded (fallback to USERS_MAP in code) |
| `period_users` / `period_model_breakdown` / `period_product_breakdown` | Legacy dormant snapshots |
| `document_chunks` | RAG embeddings vector(1536) |
| `app_settings` | Key-value: settings, spend_overrides, roi settings, seat_overrides, team_overrides |
| `initiatives` | Module 7; 5 rows seeded |

All 15 migrations applied. See `docs/schema-hardening-migrations.sql`.

### Edge Function
- **`ingest-process`** — deployed and active
- On upload: parses CSV → `usage_rows`; auto-upserts `periods` from filename dates; creates `document_chunks` embeddings (if OpenRouter key set)

---

## How data flows

```
Upload CSV (Module 1) → parse to React state
  → if Supabase configured:
      SHA-256 hash → check content_hash dupe
        → duplicate: amber warning card (filename + original upload date)
        → new: upload to Storage → uploads row → invoke ingest-process
            → usage_rows populated
            → periods auto-upserted from filename dates
            → document_chunks (if OPENROUTER_API_KEY set)
          → periods re-fetched → date range picker updates

Page load (Supabase configured):
  → fetch periods → auto-select most recent → fetch usage_rows → modules populate
  → fetch uploads → download latest per file_type → re-parse (fallback)
  → fetch app_settings → hydrate settings, spendOverrides, roi settings, overrides
  → fetch initiatives → hydrate Module 7
  → fetch seats → hydrate user list

Date range picker (header):
  → period preset dropdown (from periods table) or custom from/to dates
  → change → re-fetch usage_rows → all 9 modules update
```

---

## Key code locations in index.html

| Item | Approx line | Notes |
|------|-------------|-------|
| `COLOURS` constant | ~138 | opus=#f59e0b, sonnet=#88aa00, haiku=#1e1645 |
| `SURFACE_PALETTE` | ~165 | 6-color brand array for Module 5 bars |
| `AVG_TOKENS_PER_SESSION` | ~170 | 8000 — ROI formula constant |
| `ROI_PRESETS` | removed | Now in settings state (roiSavingLegal/Finance/Advisory) |
| `USERS_MAP` | ~60 | 8 users with roleType field added |
| `aggregateData` | ~725 | Main aggregation; checks seat_overrides + team_overrides |
| `buildBehaviorMaps` | ~660 | Conv/proj/mem signals per user |
| `usageRowsToRawRows` | ~555 | DB row → rawRows shape converter |
| `persistIngestToSupabase` | ~575 | Dedup → Storage → uploads → invoke Edge Function |
| ROI formula (Module 2) | ~1760 | token-session estimation with 3× cap |
| ROI stat boxes JSX | ~1780 | Est. Time Recaptured, Est. Value Delivered, Avg per Person |
| Module 3 efficiency banner | ~1900 | Model Efficiency at top of Model Governance |
| Module 5 bar chart | ~2200 | SURFACE_PALETTE cycling colors |
| Admin ROI Settings panel | ~1400 | Collapsible; 5 numeric inputs |
| Admin Seat Config panel | ~1450 | Per-user tier dropdown |
| Admin Team Members panel | ~1500 | Full CRUD table |
| TabBar + Tools tab | ~975 | Three tabs: dashboard / admin / tools |
| Module 6 (Tools tab) | ~2050 | Savings Calculator |
| Module 9 Coaching | ~2750 | Renders before Module 8 |
| Module 8 Report Generator | ~2900 | After Module 9; no API key UI |
| Date range picker JSX | ~3100 | Header; period dropdown + from/to inputs |
| App JSX / module props | ~3050 | All module props assembled |

*Line numbers are approximate — search by function name or string if off.*

---

## Config

### Local dev
Create `dashboard-config.json` at repo root (gitignored):
```json
{
  "SUPABASE_URL": "https://pwuapjdfrdbgcekrwlpr.supabase.co",
  "SUPABASE_ANON_KEY": "<anon key — Supabase Dashboard → Project Settings → API>",
  "OPENROUTER_API_KEY": "<optional — for Module 8 AI narrative>"
}
```

### Railway env vars (already set)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`

---

## Recent changes (latest first)

1. **Colour fix (2026-04-02):** Opus/Haiku swapped — Opus now amber `#f59e0b`, Haiku now navy `#1e1645` for aesthetics. Log a Win button moved from ROI disclaimer to Tools tab as Coming Soon card.
2. **UI Iteration 2 Part B (2026-04-02):** Model Efficiency moved to top of Module 3; pie chart → Recharts Legend; token-based ROI formula (AVG_TOKENS_PER_SESSION=8000, 3× cap); ROI Settings + Seat Config + Team Members Admin panels; Tools tab + Savings Calculator moved there; ROI_PRESETS constant removed.
3. **UI Iteration 2 Part A (2026-04-02):** "Frank Capital" in sub-title; demo pill removed; A$ comma formatting; first names globally; brand-palette Module 5 bars; Coaching before Report Generator; OpenRouter paste input removed; tier-based nudge copy.
4. **UI Iteration 1 (2026-04-01):** Brand colours, mobile CSS, AU dates, fluency legend, subscription cost tracking, Spend Notice banners.
5. **Ingestion pipeline (2026-04-01):** Edge Function auto-creates periods from filename dates; date range picker drives all 9 modules; usageRowsData state; dedup UX amber banners.

---

## What to build next

| Priority | Feature | Notes |
|----------|---------|-------|
| **High** | Historical trend charts | WoW/MoM from `usage_rows` grouped by period in Modules 2 + 4 |
| **High** | Log a Win survey form | `time_logs` Supabase table + form in Tools tab; feeds ROI calibration |
| Medium | Day-level drill-down | Date-bucketed spend/token charts within a period |
| Medium | IVFFlat vector index | On `document_chunks` once 100+ rows exist |
| Low | Auto-fetch Anthropic CSV | API key in Railway env; scheduled fetch |
| Low | Auto-email reports | M365 SMTP |
| Low | Auth hardening | Domain allowlist at Supabase provider |

---

## File map (key files only)

```
index.html                         ← Live app. Source of truth.
src/dashboard.jsx                  ← ESM mirror. Sync after every change.
CLAUDE.md                          ← Full spec (constants, modules, schema, roadmap)
docs/AGENT_HANDOFF.md              ← This file
docs/DEPLOYMENT.md                 ← Git + Railway deploy guide
docs/DIGITAL_FLUENCY_SCORING.md    ← Fluency formula reference
docs/WORKING_STANDARD.md           ← Orchestrator/executor working standard
docs/DASHBOARD_SCAFFOLD_RUNBOOK.md ← Scaffold guide for new dashboards
docs/SCHEMA_HARDENING_PLAN.md      ← DB schema reference
docs/schema-hardening-migrations.sql ← 15 applied migrations
docs/supabase-phase2.sql           ← Full idempotent schema (for scaffold)
docs/PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md ← Product spec
docs/archive/                      ← Completed plans (read-only)
supabase/functions/ingest-process/index.ts ← Edge Function (deployed)
```

---

## Security posture

- Anon key exposed in browser (by design — static site). RLS is the control layer.
- All RLS policies use `USING (true)` — intentional for internal team tool with PIN-gated Admin tab.
- `dashboard-config.json` is gitignored. Never commit it.
- Edge Function uses service role key server-side (not exposed to browser).

---

## Suggested first message for a new session

> Read `docs/AGENT_HANDOFF.md` and `CLAUDE.md`. Task: [describe work here].

# CLAUDE.md — Frank Group AI Governance Dashboard

## Project status

**Live on Railway. All 9 modules active. UI Iteration 2 complete.**

- Full Supabase persistence: 15 migrations applied, 9 tables live, Edge Function deployed
- Auto-ingestion: Upload CSV → Edge Function → `usage_rows` + `periods` auto-created → date range picker populated
- UI: Three tabs (Dashboard | Admin | Tools), first-name display, brand colours, token-based ROI formula, Admin panels for ROI/Seat/Team management
- GitHub: `https://github.com/travr-a11y/ai-governance-dashboard`
- Railway: auto-deploys on push to `main` → `https://ai-governance-dashboard-production.up.railway.app/`
- Supabase project ref: `pwuapjdfrdbgcekrwlpr`
- **Railway env vars required:** `SUPABASE_URL` + `SUPABASE_ANON_KEY`; optional `OPENROUTER_API_KEY` for Module 8 AI narrative

---

## File map

```
index.html                    ← THE live file. All dashboard code inline (JSX via Babel standalone).
src/dashboard.jsx             ← ESM mirror — keep in sync after every index.html change.
package.json                  ← npm start → prestart → npx serve
railway.toml                  ← startCommand = "npm start"
.gitignore                    ← **/.DS_Store, .env, node_modules, dashboard-config.json
dashboard-config.example.json ← Template for local Supabase/OpenRouter config (gitignored in use)
scripts/
  write-dashboard-config-from-env.js  ← prestart: writes dashboard-config.json from Railway env
CLAUDE.md                     ← This file — primary context for coding agents
README.md                     ← Public-facing docs (GitHub)

src/
  dashboard.jsx               ← Dev/reference copy (ESM imports + export default App)

docs/
  AGENT_HANDOFF.md            ← Short bootstrap for new agent chats
  DEPLOYMENT.md               ← Git + Railway deploy workflow
  DIGITAL_FLUENCY_SCORING.md  ← Fluency formula reference (keep in sync with index.html)
  WORKING_STANDARD.md         ← Orchestrator/executor working standard
  PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md  ← Full product spec
  DASHBOARD_SCAFFOLD_RUNBOOK.md  ← 801-line repeatable scaffold guide for new dashboards
  SCHEMA_HARDENING_PLAN.md    ← Full DB schema reference (what's built + why)
  schema-hardening-migrations.sql  ← 15 idempotent migrations (all applied)
  supabase-phase2.sql         ← Full idempotent schema (all tables + RLS + storage) — used by scaffold

  archive/                    ← Completed plans and historical docs (read-only reference)
    FRANK_HANDOFF_AIDashboard_2026-03-31.md
    PHASE_1_5_PLAN.md
    UI_REDESIGN_PLAN.md
    UI_ITERATION_2_PLAN.md
    INGESTION_LAYER_PLAN.md
    SCAFFOLD_SYSTEM_FIXES.md
    SUPABASE_PERSISTENCE_PLAN.md
    PHASE2_SHIP_AND_OPERATIONS_CHECKLIST.md
    council-answer-2026-04-01.md  ← ROI methodology research (HBS/BCG/Stanford)
    tasks/
      TASK-01 through TASK-05  ← All completed

supabase/
  config.toml
  functions/ingest-process/
    index.ts                  ← Active Edge Function (deployed)
```

**Important:** `index.html` is the source of truth. Edit `index.html` first, then sync `src/dashboard.jsx`.

---

## Architecture

Pure static site. Zero build step. No backend.

- **React 18** + **Recharts 2.12.7** loaded from unpkg CDN
- **Babel standalone** compiles JSX in-browser at load time
- All data processing is client-side (FileReader API + inline CSV/JSON parsers)
- No localStorage, no sessionStorage
- **Supabase** (`@supabase/supabase-js` from esm.sh) — anon key + RLS; `periods`, `usage_rows`, `uploads`, `app_settings`, `seats`, `initiatives`, `document_chunks` tables; private Storage bucket `uploads`. Config via `dashboard-config.json` (gitignored); Railway env vars via prestart script.
- **Optional:** `fetch` to `https://api.frankfurter.app/latest?from=USD&to=AUD` for live AUD/USD rate (CORS-friendly, no key)
- **Optional:** Module 8 **Generate with Gemini** — `OPENROUTER_API_KEY` from Railway env; `fetch` to `https://openrouter.ai/api/v1/chat/completions` with `google/gemini-2.5-pro`. Key is exposed to anyone who loads the site — treat Railway + access control accordingly.

Deploy = `git push origin main`. Railway: `npm start` → prestart writes config → `npx serve`.

---

## Tab structure

```
Dashboard | Admin | Tools
```

- **Dashboard:** Modules 1 → 2 → 3 → 4 → 5 → 9 → 8 (Coaching before Report Generator)
- **Admin:** Data upload, AUD/USD rate, settings + **ROI Settings panel** + **Seat Configuration panel** + **Team Members panel**
- **Tools:** Module 6 (Savings Calculator) + Log a Win (Coming Soon card)

---

## Key constants (hardcoded in index.html and dashboard.jsx)

### USERS_MAP
8 seats across two entities. Each entry includes `roleType` field:
- **Frank Advisory:** trowley/Travis (roleType: advisory, isBenchmark: true), alex (finance), andrea (advisory), rsharma/Reginald (advisory)
- **Frank Law:** tbrcic/Tamara (advisory), bagar/Bahar (legal), bwoodward/Ben (legal), rlyons/Rhys (legal)

### SPEND_LIMITS (AUD, null = Unlimited)
```
Bahar: $20 | Tamara: $10 | Rhys: $50 | Reginald: $190
Alex, Andrea, Ben, Travis: Unlimited
```

### SEAT_TIERS / billing
- **Premium:** `alex@frankadvisory.com.au` only (overrideable via `settings.seat_overrides`)
- **Standard:** all other seats
- **Plan billing:** `BILLING_STANDARD_SEATS` (8) × A$25 + `BILLING_PREMIUM_SEATS` (1) × A$125 = **A$325/mo**

### UUID_MAP_BASE
Hardcoded Claude.ai `account.uuid` → canonical email for six users; extended at runtime when `users.json` uploaded (`uuidOverlay` merged in App state).

### MODEL_CLASS
Maps raw Anthropic model IDs → Opus / Sonnet / Haiku tier.

### COLOURS
```js
const COLOURS = {
  opus:        "#f59e0b",  // Amber — Opus model tier (flagship, not a danger signal)
  sonnet:      "#88aa00",  // Yellow-green — Sonnet (efficient mid-tier)
  haiku:       "#1e1645",  // Navy — Haiku (lightweight)
  advisory:    "#1e1645",  // Dark indigo — Frank Advisory / primary brand
  law:         "#1e1645",  // Dark indigo — Frank Law
  accent:      "#88aa00",  // Yellow-green — highlights, active badges
  bodyText:    "#1a1a1a",
  captionText: "#4a4a4a",
  tier1:       "#1e1645",  // Super User
  tier2:       "#88aa00",  // Active
  tier3:       "#f59e0b",  // Getting Started
  tier4:       "#9ca3af",  // Not Yet Active
  premiumBadge:"#d97706",
};
```
**Status colours (inline, not in COLOURS object):** High `#dc2626`, Moderate `#f59e0b`, OK `#166534` — used only for governance Status column and flags.

### SURFACE_PALETTE
Brand-palette array for Module 5 bar chart — cycles through surfaces, not status encoding:
```js
["#1e1645", "#88aa00", "#f59e0b", "#3b82f6", "#6366f1", "#0ea5e9"]
```

### AVG_TOKENS_PER_SESSION
`8000` — used in ROI formula (typical professional task session, HBS/BCG research basis).

### ROI settings (in `settings` state, editable via Admin)
```js
roiHourlyRate:    200,   // A$/hr
roiMinutesPerTask: 20,   // avg task time (minutes)
roiSavingLegal:   0.40,  // HBS/BCG + Stanford/LegalBench
roiSavingFinance: 0.35,  // Microsoft/GitHub Copilot RCT
roiSavingAdvisory:0.40,  // HBS/BCG "Cyborg" study
seat_overrides:   {},    // { email: "Standard"|"Premium" }
team_overrides:   [],    // [{ email, name, entity, roleType, tier, active }]
```

### OPENROUTER_REPORT_MODEL
`google/gemini-2.5-pro` — Module 8 optional AI narrative.

### COACHING_KEYWORDS
Regex buckets for Module 9 cross-team spotlight from conversation titles only (no message body).

---

## Module overview

| # | Name | Key logic |
|---|------|-----------|
| 1 | Data Ingestion | Single upload zone — `.csv` / `.json`; CSV routed by headers (Anthropic vs Claude Code); JSON by filename. Manifest + Clear all. AUD/USD + Refresh live (Frankfurter). Seat cost summary. |
| 2 | AI Adoption | Spend-only fluency if no conversations: `token×0.5 + surface×0.3 + recency×0.2`. Multi-signal if conversations loaded: `spend×0.25 + conv×0.4 + proj×0.2 + config×0.15`. Tier bands (70/40/10). **ROI boxes** use token-session formula (see below). |
| 3 | Model Governance | **Model Efficiency banner at top** (org Opus/Sonnet/Haiku %). Pie chart with Recharts `<Legend />`. Per-user table: Opus%, Sonnet%, Haiku%, Status. Flags. Recommendation library. |
| 4 | User Spend & Tokens | Sortable table; Seat column (Standard/Premium, overrideable); Claude Code sub-row; expandable breakdown; AUD live rate. |
| 5 | Product Analysis | Bar chart by surface — **SURFACE_PALETTE brand colours** (not status encoding). Opus-by-surface overlay retains status colours. |
| 6 | Savings Calculator | Opus→Sonnet migration slider; annualised. **Lives in Tools tab only.** |
| 7 | AI Committee Initiative Tracker | Editable initiatives; JSON export. |
| 8 | Report Generator | Template report + optional Gemini via OpenRouter (Railway env key only — no UI paste input). Download .doc / Print / .txt. **Renders after Module 9.** |
| 9 | Coaching & Leaderboard | Ranked fluency list; tier-based actionable nudge copy (metadata only). First names throughout. |

---

## ROI formula

**Current implementation (token-session estimation):**
```js
const AVG_TOKENS_PER_SESSION = 8000;
const roleSaving = settings['roiSaving' + capitalise(roleType)] || 0.35;
const estimatedSessions = Math.min(totalTokens / AVG_TOKENS_PER_SESSION, 3 * totalRequests);
const hoursSaved = estimatedSessions * settings.roiMinutesPerTask * roleSaving / 60;
const valueSaved = hoursSaved * settings.roiHourlyRate;
```
The `3× totalRequests` cap prevents token outliers from producing absurd multipliers.

**Future (Phase 3):** Hybrid formula — self-reported `time_logs` as calibration anchor × token complexity multiplier per task type. Requires `time_logs` table + Log a Win survey form in Tools tab.

---

## Admin panels (new in UI Iteration 2)

Three collapsible sections in the Admin tab:

### ROI Settings
Editable number inputs for: hourly rate (A$/hr), avg minutes per task, legal/finance/advisory saving %. Read-only task taxonomy reference (12 task types across 3 roles). Persists to `app_settings`.

### Seat Configuration
Per-user Standard/Premium dropdown. Stored as `settings.seat_overrides`. `aggregateData` checks `seat_overrides[email]` before falling back to hardcoded `BILLING_PREMIUM_SEATS`.

### Team Members
Full CRUD table: name, entity (Frank Advisory/Law/Capital), role type, tier, active toggle, remove. "Add member" inline form. Stored as `settings.team_overrides`. At runtime, merges over `USERS_MAP` (overrides win). Unknown emails from CSV ingest auto-added with defaults.

---

## Aggregation logic (`aggregateData`)

**Data source priority:**
1. `usageRowsData` — Supabase `usage_rows` filtered by date range (preferred when Supabase configured)
2. `rawRows` — CSV parsed in browser
3. `SAMPLE_DATA` — fallback when neither available

`usageRowsToRawRows(dbRows)` converts DB row shape → rawRows shape so `aggregateData` is unchanged.

**Internals:**
1. Resolve effective user list: merge `settings.team_overrides` over `USERS_MAP`
2. Group rows by `user_email` (case-insensitive)
3. Sum spend, tokens, requests; build `modelBreakdown` / `productBreakdown`
4. `opusPct`, `seatTier` (check `seat_overrides` first), spend limits, `behavior: { conv, proj, mem }` per user
5. **Fluency:** multi-signal if `hasBehaviorData`; else spend-only composite
6. Fill missing users with zeros; sort by total tokens descending

---

## CSV / JSON formats

**Anthropic admin export (required for core metrics):**
```
user_email, model, product, total_requests,
total_prompt_tokens, total_completion_tokens, total_net_spend_usd
```
Date range auto-parsed from filename: `YYYY-MM-DD-to-YYYY-MM-DD`

**Claude Code team CSV (optional):** `User`, `Spend this Month (USD)`, `Lines this Month`

**Claude.ai export files (optional):** `conversations.json`, `projects.json`, `memories.json`, `users.json` — metadata only; message bodies not retained.

---

## Local development

```bash
open index.html
# or
npx serve .   # http://localhost:3000
```

---

## Deploy workflow

```bash
git add index.html src/dashboard.jsx CLAUDE.md docs/AGENT_HANDOFF.md
git commit -m "feat: description"
git push origin main   # Railway auto-deploys
```

---

## Supabase schema (9 tables, all live)

| Table | Purpose |
|-------|---------|
| `uploads` | File manifest; SHA-256 dedup via `content_hash` (UNIQUE partial) |
| `periods` | Date ranges — auto-created on ingest from CSV filename dates |
| `usage_rows` | Raw Anthropic CSV rows; primary analytics source |
| `seats` | 8 users seeded; dashboard loads with fallback to USERS_MAP |
| `period_users` | Legacy snapshot cache (dormant) |
| `period_model_breakdown` | Legacy snapshot cache (dormant) |
| `period_product_breakdown` | Legacy snapshot cache (dormant) |
| `document_chunks` | RAG embeddings (`vector(1536)`) |
| `app_settings` | Key-value: dashboard_settings, spend_overrides, roi_settings, seat_overrides, team_overrides |
| `initiatives` | Module 7 tracker; 5 rows seeded |

RLS: all tables have SELECT + INSERT + DELETE for `anon` + `authenticated`. `app_settings` also has UPDATE. `seats` has full CRUD for `authenticated`, SELECT for `anon`.

---

## Roadmap

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ Done | Full Supabase persistence | Storage, uploads, usage_rows, periods, seats, initiatives, app_settings |
| ✅ Done | Auto-ingestion pipeline | Edge Function → usage_rows + periods auto-created |
| ✅ Done | Date range picker | Drives all 9 modules; auto-selects most recent period |
| ✅ Done | Dedup UX | SHA-256 amber warning banner |
| ✅ Done | UI Iteration 1 | Brand colours, mobile CSS, AU dates, fluency legend, subscription tracking |
| ✅ Done | UI Iteration 2 | First names, Tools tab, ROI formula, Admin panels (ROI/Seat/Team), Module 8 reorder |
| ✅ Done | Dashboard scaffold system | `docs/DASHBOARD_SCAFFOLD_RUNBOOK.md` + `dashboard-scaffold` Claude Code skill |
| 📋 Planned | Historical trend charts | WoW/MoM from `usage_rows` grouped by period |
| 📋 Planned | Log a Win survey + `time_logs` table | Self-reported ROI calibration; form in Tools tab |
| 📋 Planned | Day-level drill-down | Date-bucketed spend/model charts within a period |
| 📋 Planned | Auto-fetch Anthropic CSV | API key in Railway env; scheduled fetch |
| 📋 Planned | Auto-email reports | M365 SMTP |
| 📋 Planned | Auth hardening | Domain restriction at Supabase provider |

---

## Known issues

- `dashboard.jsx` uses ES imports — not runnable without a bundler; dev reference only. Live app is `index.html`.
- ROI estimates remain approximate until Log a Win self-reporting data calibrates the token-session formula.
- `team_overrides` and `seat_overrides` persist to `app_settings` when Supabase configured; reset on page reload if Supabase not configured.
- Multi-signal fluency applies org-wide once conversation export is present; users without mapped conversations get a low conversation signal until UUIDs appear in `users.json` or `UUID_MAP_BASE`.

---

## Contacts

- **Operator:** Travis Rowley — trowley@frankadvisory.com.au
- **CEO/report recipient:** James Frank
- **GitHub:** travr-a11y

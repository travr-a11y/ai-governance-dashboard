# CLAUDE.md — Frank Group AI Governance Dashboard

## Project status

**Phase 2: LIVE.** Supabase persistence is operational. DB tables (`uploads`, `periods`, `period_users`) and Storage bucket (`uploads`) are live in project `pwuapjdfrdbgcekrwlpr`. `railway.toml` now runs `npm start` so `prestart` writes `dashboard-config.json` from env vars before serving.

- GitHub: `https://github.com/travr-a11y/ai-governance-dashboard`
- Railway: connect at railway.app → `travr-a11y/ai-governance-dashboard` (auto-deploys on push to main)
- **Railway:** Set `SUPABASE_URL` + `SUPABASE_ANON_KEY` for persistence; optional `OPENROUTER_API_KEY` for Module 8 AI narrative pre-loaded from config (see `docs/DEPLOYMENT.md`).

---

## File map

```
index.html       ← THE live file. All dashboard code is inline here (JSX via Babel standalone).
package.json     ← `npm start` runs `prestart` then `npx serve` (see `railway.toml`)
railway.toml     ← `startCommand = "npm start"` so Phase 2 `prestart` runs on deploy
.gitignore       ← **/.DS_Store, .env, node_modules, dashboard-config.json
README.md        ← Public-facing docs (GitHub)
CLAUDE.md        ← This file — primary context for coding agents

src/
  dashboard.jsx  ← Dev/reference copy (keep in sync with index.html script block)

docs/
  DEPLOYMENT.md                                        ← Git + Railway deploy workflow
  DIGITAL_FLUENCY_SCORING.md                           ← Fluency formula reference (keep in sync with index.html)
  PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md ← Full product spec
  SUPABASE_PERSISTENCE_PLAN.md           ← Phase 2 handoff (uploads table, Storage, UI)
  PHASE2_SHIP_AND_OPERATIONS_CHECKLIST.md ← Pre-ship + Railway env + ops verification
  supabase-phase2.sql                    ← periods, period_users, uploads, Storage policies

  tasks/                          ← Pending work items (one file per task)
    TASK-01-code-csv-schema.md    ← New Claude Code API token CSV parser
    TASK-02-ingestion-tab-password.md ← Admin tab + PIN gate
    TASK-03-module2-fix.md        ← Module 2 stat label / org-fluency fix
    TASK-04-module8-report.md     ← Module 8 native key + report quality
    TASK-05-phase2-persistence.md ← Phase 2 Supabase persistence (large)

  archive/                        ← Historical / superseded docs (read-only reference)
    FRANK_HANDOFF_AIDashboard_2026-03-31.md ← Phase 1.5 session handoff (complete)
    PHASE_1_5_PLAN.md             ← Phase 1.5 design plan (complete)
```

**Important:** `index.html` is the source of truth. When making changes, edit `index.html`, then regenerate or sync `src/dashboard.jsx` (same `<script type="text/babel">` body with ESM imports + `export default App`).

---

## Architecture

Pure static site. Zero build step. No backend.

- **React 18** + **Recharts 2.12.7** loaded from unpkg CDN
- **Babel standalone** compiles JSX in-browser at load time
- All data processing is client-side (FileReader API + inline CSV/JSON parsers)
- No localStorage, no sessionStorage
- **Optional Phase 2:** Supabase (`@supabase/supabase-js` from esm.sh) — anon key + RLS (`anon` + `authenticated` policies); `periods` / `period_users` snapshots, private Storage bucket `uploads` + `uploads` table manifest; successful ingests persist when Supabase is configured (no Magic Link required; optional session still sets `uploaded_by`); auto-load latest file per `file_type` on load; Module 1 upload history (load/delete). Config: repo-root `dashboard-config.json` (gitignored); template `dashboard-config.example.json`. Railway: set `SUPABASE_URL` + `SUPABASE_ANON_KEY` (and optionally `OPENROUTER_API_KEY`) — `prestart` writes non-empty keys into that file before `serve` (see `docs/DEPLOYMENT.md`, `docs/PHASE2_SHIP_AND_OPERATIONS_CHECKLIST.md`). Project ref: `pwuapjdfrdbgcekrwlpr`.
- **Optional:** `fetch` to `https://api.frankfurter.app/latest?from=USD&to=AUD` when the user clicks **Refresh live** on the AUD/USD rate (CORS-friendly, no API key)
- **Optional:** Module 8 **Generate with Gemini** — OpenRouter API key from Railway env (`OPENROUTER_API_KEY` → `dashboard-config.json`), user paste (session), or local `OPENROUTER_REPORT_API_KEY` in a trusted private copy only; `fetch` to `https://openrouter.ai/api/v1/chat/completions` with model `google/gemini-2.5-pro`. **Generate template report** works without a key. Template report stays fully client-side. **Note:** Any key in `dashboard-config.json` is exposed to everyone who can load the deployed site — treat Railway + access control accordingly.

Deploy = `git push origin main`. Railway runs `npm start` (`prestart` then `npx serve`) to serve the static files.

---

## Key constants (hardcoded in both index.html and dashboard.jsx)

### USERS_MAP
8 seats across two entities:
- **Frank Advisory:** trowley (Travis — benchmark), alex, andrea, rsharma (Reginald)
- **Frank Law:** tbrcic (Tamara), bagar (Bahar), bwoodward (Ben), rlyons (Rhys)

`isBenchmark: true` on Travis — shown with "Benchmark" label in model governance module.

### SPEND_LIMITS (AUD, null = Unlimited)
```
Bahar: $20 | Tamara: $10 | Rhys: $50 | Reginald: $190
Alex, Andrea, Ben, Travis: Unlimited
```

### SEAT_TIERS / billing
- **Premium:** `alex@frankadvisory.com.au` only
- **Standard:** all other seats in `USERS_MAP`
- **Plan billing constants:** `BILLING_STANDARD_SEATS` (8) × A$25 + `BILLING_PREMIUM_SEATS` (1) × A$125 = **A$325/mo** (display in Module 1). Claude Code CSV is separate billing.

### UUID_MAP_BASE
Hardcoded Claude.ai `account.uuid` → canonical email for six users; extended at runtime when `users.json` is uploaded (`uuidOverlay` merged in App state).

### MODEL_CLASS
Maps raw Anthropic model IDs → Opus / Sonnet / Haiku tier.

### COLOURS (Frank Group Phase 1.5)
- Primary (Dark Indigo): `#1e1645` — advisory/law headers, tier1
- Accent (Yellow-Green): `#88aa00` — sonnet, highlights, active tier badge (dark text)
- Opus (functional red): `#e74c3c`
- Haiku: `#3a4a7c`
- Body / captions: `#1a1a1a` / `#4a4a4a`

### OPENROUTER_REPORT_MODEL
OpenRouter model slug for Module 8 optional AI narrative (`google/gemini-2.5-pro` in code; adjust on OpenRouter if the ID changes).

### COACHING_KEYWORDS
Regex buckets for Module 9 cross-team spotlight from **conversation titles only** (no message body).

---

## Module overview

| # | Name | Key logic |
|---|------|-----------|
| 1 | Data Ingestion | **Single upload zone** — drop or multi-select `.csv` / `.json`; CSV routed by headers (Anthropic vs Claude Code); JSON by filename (`conversations`, `projects`, `memories`, `users`). Manifest + **Clear all uploads**. AUD/USD manual + **Refresh live** (Frankfurter). Seat cost summary. |
| 2 | AI Adoption | **Spend-only fluency** if no conversations: `token×0.5 + surface×0.3 + recency×0.2`. **Multi-signal** if `conversations.json` loaded: spend×0.25 + conversation×0.4 + project×0.2 + config×0.15. Same tier bands (70 / 40 / 10). |
| 3 | Model Governance | Opus% per user. Flags. Recommendation library. |
| 4 | User Spend & Tokens | Sortable table; **Seat** column (Standard/Premium); **Claude Code** sub-row when Code CSV loaded; expandable breakdown; AUD uses live `audRate`. |
| 5 | Product Analysis | Bar chart by surface; Opus leverage callouts. |
| 6 | Savings Calculator | Opus→Sonnet migration slider; annualised. **Rendered at the bottom of the page** (after Module 9). |
| 7 | AI Committee Initiative Tracker | Editable initiatives; JSON export. *(Was numbered Module 8 in Phase 1 UI.)* |
| 8 | Report Generator | **Generate template report** + optional **Generate with Gemini** via OpenRouter (key from Railway / paste / local dev constant; aggregated JSON metrics only) + **Download .doc** + **Print / PDF** + `.txt`. *(Was Module 7.)* |
| 9 | Coaching & leaderboard | Ranked fluency list; rule-based cards (metadata only); category spotlight from conversation **titles**. |

**Header:** **Reporting period** banner under the title (demo vs live dates from CSV filename, inclusive day count when parsed).

---

## Aggregation logic (`aggregateData`)

1. Group Anthropic CSV rows by `user_email` (case-insensitive to `USERS_MAP` keys)
2. Sum spend, tokens, requests; build `modelBreakdown` / `productBreakdown`
3. `opusPct`, `seatTier`, spend limits, `behavior: { conv, proj, mem }` per user
4. **Fluency:** if `behavior.hasBehaviorData` (≥1 parsed conversation row with resolvable UUID→email), use multi-signal formula; else spend-only composite (same numeric blend as before)
5. Fill missing `USERS_MAP` users with zeros; sort by total tokens descending

`buildBehaviorMaps(convItems, projItems, memItems, uuidMap, userMetaByEmail)` prepares per-email conversation/project/memory aggregates. `userMetaByEmail` comes from `users.json` (e.g. phone verified) for the config signal.

---

## CSV / JSON formats

**Anthropic admin export (required for core metrics):**
```
user_email, model, product, total_requests,
total_prompt_tokens, total_completion_tokens, total_net_spend_usd
```

**Claude Code team CSV (optional):** columns include `User`, `Spend this Month (USD)`, `Lines this Month` (quoted numbers with commas supported).

**Claude.ai export files (optional):** `conversations.json`, `projects.json`, `memories.json`, `users.json` — parsed for metadata only; message bodies are not retained in state.

Date range auto-parsed from Anthropic CSV filename: `YYYY-MM-DD-to-YYYY-MM-DD`

---

## Local development

```bash
open index.html
# or
npx serve .
# http://localhost:3000
```

---

## Deploy workflow

```bash
git add index.html src/dashboard.jsx CLAUDE.md   # etc.
git commit -m "feat: Phase 1.5 dashboard"
git push origin main
```

---

## Phase 2 roadmap (remaining Supabase work)

| Status | Feature | Notes |
|--------|---------|-------|
| Done | Saved reporting periods | `periods`, `period_users` rows; header period selector |
| Done | Raw file persistence | Storage bucket `uploads`; DB manifest `uploads`; ingest → upload + insert (background) |
| Done | Auto-restore session | Latest row per `file_type` downloaded and parsed after sign-in |
| Done | Module 1 history UI | List, refresh, load file, delete (Storage + row) |
| Planned | Historical trend charts | WoW / MoM beyond saved periods |
| Planned | Auto-fetch Anthropic | API key in env |
| Planned | Auto-email reports | M365 SMTP |
| Planned | Auth hardening | Domain restriction at provider (hooks / allowlist) |

---

## Known issues / open questions

- `dashboard.jsx` uses ES imports — not runnable without a bundler; dev reference. Live app is `index.html`.
- Spend limits and initiatives do not persist across reload (export JSON for initiatives). Raw exports persist in Supabase when configured (anon key + env).
- Multi-signal fluency applies org-wide once conversation export is present; users without mapped conversations get a low conversation signal until their UUIDs appear in `users.json` or `UUID_MAP_BASE`.

---

## Contacts

- **Operator:** Travis Rowley — trowley@frankadvisory.com.au
- **CEO/report recipient:** James Frank
- **GitHub:** travr-a11y

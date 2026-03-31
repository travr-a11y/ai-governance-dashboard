# CLAUDE.md — Frank Group AI Governance Dashboard

## Project status

**Phase 1.5: COMPLETE (code).** Dashboard remains a pure static site on Railway. Enhanced data ingestion (Claude.ai export JSON + Claude Code team CSV), Frank Group brand colours, multi-signal fluency when conversations are loaded, seat tiers, Module 7/8 order fix, Word/PDF-friendly report export, and Module 9 coaching + leaderboard.

- GitHub: `https://github.com/travr-a11y/ai-governance-dashboard`
- Railway: connect at railway.app → `travr-a11y/ai-governance-dashboard` (auto-deploys on push to main)
- Phase 2 is next — see bottom of this file.

---

## File map

```
index.html       ← THE live file. All dashboard code is inline here (JSX via Babel standalone).
package.json     ← Railway start command: npx serve . --listen $PORT --no-clipboard
railway.toml     ← Railway deploy config
.gitignore       ← **/.DS_Store, .env, node_modules
README.md        ← Public-facing docs (GitHub)
CLAUDE.md        ← This file — primary context for coding agents

src/
  dashboard.jsx  ← Dev/reference copy (keep in sync with index.html script block)

docs/
  DEPLOYMENT.md                                        ← Git + Railway deploy workflow
  DIGITAL_FLUENCY_SCORING.md                           ← Fluency formula reference (keep in sync with index.html)
  PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md ← Full product spec

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
- **Optional:** `fetch` to `https://api.frankfurter.app/latest?from=USD&to=AUD` when the user clicks **Refresh live** on the AUD/USD rate (CORS-friendly, no API key)
- **Optional:** Module 8 **Generate with Claude** — user-pasted Anthropic API key (session only); `fetch` to `https://api.anthropic.com/v1/messages` with `anthropic-dangerous-direct-browser-access: true` (BYOK). Template report stays fully client-side.

Deploy = `git push origin main`. Railway runs `npx serve .` to serve the static files.

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

### ANTHROPIC_REPORT_MODEL
Sonnet model ID for Module 8 optional AI narrative (`claude-sonnet-4-20250514` in code; adjust if Anthropic deprecates the ID).

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
| 8 | Report Generator | **Generate report (template)** + optional **Generate with Claude** (BYOK, aggregated JSON metrics only) + **Download .doc** + **Print / PDF** + `.txt`. *(Was Module 7.)* |
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

## Phase 2 — planned next

| Feature | Notes |
|---------|-------|
| Persistent CSV history | PostgreSQL on Railway |
| Historical trend charts | WoW / MoM |
| Auto-fetch Anthropic | API key in env |
| Auto-email reports | M365 SMTP |
| Auth | Domain restriction |

---

## Known issues / open questions

- `dashboard.jsx` uses ES imports — not runnable without a bundler; dev reference. Live app is `index.html`.
- Spend limits and initiatives do not persist across reload (export JSON for initiatives).
- Multi-signal fluency applies org-wide once conversation export is present; users without mapped conversations get a low conversation signal until their UUIDs appear in `users.json` or `UUID_MAP_BASE`.

---

## Contacts

- **Operator:** Travis Rowley — trowley@frankadvisory.com.au
- **CEO/report recipient:** James Frank
- **GitHub:** travr-a11y

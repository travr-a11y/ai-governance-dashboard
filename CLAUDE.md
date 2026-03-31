# CLAUDE.md — Frank Group AI Governance Dashboard

## Project status

**Phase 1: COMPLETE.** Dashboard is built, tested locally, pushed to GitHub, and deployed on Railway.

- GitHub: `https://github.com/travr-a11y/ai-governance-dashboard`
- Railway: connect at railway.app → `travr-a11y/ai-governance-dashboard` (auto-deploys on push to main)
- Phase 2 is next — see bottom of this file.

---

## File map

```
index.html          ← THE live file. All dashboard code is inline here (JSX via Babel standalone).
dashboard.jsx       ← Dev/reference copy of the React component (same code as index.html).
package.json        ← Railway start command: npx serve . --listen $PORT --no-clipboard
railway.toml        ← Railway deploy config
.gitignore          ← .DS_Store, .env, node_modules
README.md           ← Public-facing docs
DEPLOYMENT.md       ← Deployment reference (adapted from previous projects)
PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md  ← Full spec
```

**Important:** `index.html` is the source of truth. When making changes, edit `index.html`. Keep `dashboard.jsx` in sync if you change shared logic.

---

## Architecture

Pure static site. Zero build step. No backend.

- **React 18** + **Recharts 2.12.7** loaded from unpkg CDN
- **Babel standalone** compiles JSX in-browser at load time
- All data processing is client-side (FileReader API + inline CSV parser)
- No localStorage, no sessionStorage, no API calls

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

### MODEL_CLASS
Maps raw Anthropic model IDs → Opus / Sonnet / Haiku tier.
Add new models here as Anthropic releases them.

### COLOURS
Brand palette: advisory=#1a3a5c, law=#2d7d5f, opus=#e74c3c, sonnet=#2d7d5f, haiku=#3a86c8

---

## Module overview

| # | Name | Key logic |
|---|------|-----------|
| 1 | Data Ingestion | FileReader + inline CSV parser. Validates required columns. Falls back to SAMPLE_DATA. |
| 2 | AI Adoption | `fluencyScore` = tokenVolume×0.5 + surfaceDiversity×0.3 + recency×0.2 (0–100). Tiers: ≥70=Super User, 40–69=Active, 10–39=Getting Started, <10=Not Started |
| 3 | Model Governance | Opus% per user. Flag: red >80%, amber 50–80%, green <50%. Collapsible recommendation library. |
| 4 | User Spend & Tokens | Sortable table. Expandable rows with product/model breakdown. Spend limit utilisation bars. |
| 5 | Product Analysis | Horizontal bar chart of spend by surface. Identifies high-leverage Opus→Sonnet migration targets. |
| 6 | Savings Calculator | `saving = opus_spend × migration_pct × (1 - 1/5)`. Slider 0–100%. Annualised projection. |
| 7 | Report Generator | Pure string template → copyable text. Designed for email to James (CEO). |
| 8 | Initiative Tracker | Inline editable. Auto-calculates status from `calculatedMetrics` object. Export as JSON. |

---

## Aggregation logic (`aggregateData` function)

1. Group raw CSV rows by `user_email` (case-insensitive)
2. Sum spend, tokens, requests per user
3. Build `modelBreakdown` and `productBreakdown` sub-objects
4. Calculate `opusPct` = Opus spend ÷ total spend × 100
5. Calculate `fluencyScore` (see Module 2 above)
6. Add zero-spend UserAggregates for USERS_MAP entries not in CSV (Tier 4)
7. Sort descending by total tokens

`orgAvgTokens` is calculated across active users only, used to normalise token volume score.

---

## CSV format

Required columns (from Anthropic admin → Usage → Export):
```
user_email, model, product, total_requests,
total_prompt_tokens, total_completion_tokens, total_net_spend_usd
```

Date range auto-parsed from filename pattern: `YYYY-MM-DD-to-YYYY-MM-DD`

---

## Local development

```bash
# Simplest — just open in browser:
open index.html

# Or serve locally (mirrors Railway setup):
npx serve .
# Visit http://localhost:3000
```

No install needed. CDN deps load on first open (requires internet).

---

## Deploy workflow

```bash
# Make changes to index.html (and dashboard.jsx to keep in sync)
git add index.html dashboard.jsx   # add other files as needed
git commit -m "feat/fix: description"
git push origin main
# Railway auto-redeploys — watch logs in Railway dashboard
```

Railway config is in `railway.toml`. No env vars needed.

---

## Phase 2 — planned next

Triggered when Railway is connected and Phase 1 is tested in production.

| Feature | Notes |
|---------|-------|
| Persistent CSV history | PostgreSQL on Railway. Store each upload with timestamp. |
| Historical trend charts | WoW / MoM charts once 2+ periods are stored. |
| Auto-fetch from Anthropic Console API | Store API key in Railway env vars. Replace manual CSV upload. |
| Auto-email reports | Microsoft 365 SMTP. Weekly/fortnightly cadence. Distribution: James, AI Committee. |
| Auth | Email domain restriction (frankadvisory.com.au + franklaw.com.au). |

Phase 2 will require moving from pure static to a Node.js or Python backend on Railway. The frontend component can be largely reused.

---

## Known issues / open questions

- `dashboard.jsx` imports from `react` and `recharts` as ES modules — this file is NOT directly runnable in a browser. It's a dev reference. The live code is the `<script type="text/babel">` block in `index.html`.
- Anthropic Console API CSV schema is unconfirmed. Module 1's second upload zone is wired but schema validation may need updating.
- Spend limits are hardcoded in `SPEND_LIMITS`. Module 4 has inline editing but changes don't persist across page reloads (Phase 1 limitation).
- AI Committee initiatives reset on page reload. "Export JSON" button lets Trav save state manually.

---

## Contacts

- **Operator:** Travis Rowley — trowley@frankadvisory.com.au
- **CEO/report recipient:** James Frank
- **GitHub:** travr-a11y

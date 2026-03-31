# Frank Group AI Governance Dashboard

A client-side React dashboard for monitoring Claude.ai Team usage across Frank Advisory and Frank Law. Upload a spend CSV from the Anthropic admin panel and get a full governance report in seconds — no backend, no login, no build step.

**Live:** deployed on Railway (connect via `travr-a11y/ai-governance-dashboard`)

---

## What it does

| # | Module | Purpose |
|---|--------|---------|
| 1 | **Data Ingestion** | Single drop zone for Anthropic CSV, Claude Code CSV, and Claude.ai JSON exports. AUD/USD live rate. |
| 2 | **AI Adoption** | Org adoption rate, Digital Fluency Score per user (spend-only or multi-signal), tier badges. |
| 3 | **Model Governance** | Opus / Sonnet / Haiku usage split per user. Flags. Recommendation library. |
| 4 | **User Spend & Tokens** | Sortable table: spend (AUD), tokens, requests, seat tier (Standard/Premium), spend limits, Claude Code sub-row. |
| 5 | **Product Analysis** | Spend by surface (Chat, Cowork, Research, Claude Code, etc.). Opus leverage callouts. |
| 6 | **Savings Calculator** | Slider: migrate X% of Opus → Sonnet; projected AUD saving + annualised. Rendered at page bottom. |
| 7 | **Initiative Tracker** | AI Committee initiatives with editable targets, auto status (green/amber/red), JSON export. |
| 8 | **Report Generator** | Template report + optional AI narrative (OpenRouter → Gemini 2.5 Pro, BYOK) + Download .doc / Print-to-PDF / .txt. |
| 9 | **Coaching & Leaderboard** | Ranked fluency leaderboard, rule-based coaching cards, cross-team category spotlight. |

---

## Users

- **Trav (operator):** Exports CSV weekly from Anthropic admin, uploads it, generates report for James.
- **James (CEO/MD):** Receives the weekly report by email.
- **AI Committee:** Monitors initiative progress (Module 7).
- **8 team members:** Alex, Andrea, Reginald (Frank Advisory) + Tamara, Bahar, Ben, Rhys (Frank Law) + Trav.

---

## CSV format

Export from: **Anthropic admin → Usage → Export CSV**

Required columns:
```
user_email, model, product, total_requests,
total_prompt_tokens, total_completion_tokens, total_net_spend_usd
```

Optional (ignored if missing): `account_uuid`, `total_gross_spend_usd`

---

## Running locally

Just open `index.html` in a browser. No install, no build. Dependencies load from CDN:
- React 18
- Babel standalone (in-browser JSX)
- Recharts 2.12.7

```bash
open index.html
# or serve it:
npx serve .
```

---

## Deploying changes

```bash
git add .
git commit -m "feat/fix: description"
git push origin main
# Railway auto-deploys on push to main
```

Railway URL: check the Railway dashboard → your service → **Settings → Domains**

---

## Architecture

```
index.html       ← Entry point. Loads CDN deps + inlines all JSX via Babel.
package.json     ← Tells Railway to run: npx serve . --listen $PORT
railway.toml     ← Railway deploy config (healthcheck, restart policy)
.gitignore       ← Excludes .DS_Store, .env, node_modules
CLAUDE.md        ← Agent context + handoff (for AI coding agents)

src/
  dashboard.jsx  ← Dev reference copy (keep in sync with index.html)

docs/
  DEPLOYMENT.md                          ← Full git + Railway deploy workflow
  DIGITAL_FLUENCY_SCORING.md             ← Fluency score formula reference
  PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md  ← Full product spec
  tasks/                                 ← Pending work items
  archive/                               ← Superseded planning docs
```

**No build step.** Babel compiles JSX in-browser at load time. All data processing is client-side. No auth, no database. Optional API calls: `api.frankfurter.app` (live AUD/USD rate) and `openrouter.ai` (Module 8 AI narrative — BYOK).

---

## Phase 2 (planned)

- Persistent CSV history (PostgreSQL on Railway)
- Anthropic Console API auto-fetch
- Weekly report auto-email via Microsoft 365 SMTP
- Historical WoW / MoM trend charts
- Auth via email domain restriction

See `docs/PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md` for full spec.

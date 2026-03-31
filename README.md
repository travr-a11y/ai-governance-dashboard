# Frank Group AI Governance Dashboard

A client-side React dashboard for monitoring Claude.ai Team usage across Frank Advisory and Frank Law. Upload a spend CSV from the Anthropic admin panel and get a full governance report in seconds — no backend, no login, no build step.

**Live:** deployed on Railway (connect via `travr-a11y/ai-governance-dashboard`)

---

## What it does

| Module | Purpose |
|--------|---------|
| **Data Ingestion** | Drag-and-drop Claude.ai Team spend CSV. Loads sample data on first open. |
| **AI Adoption** | Org adoption rate (active seats / 8), Digital Fluency Score per user, Tier badges |
| **Model Governance** | Opus / Sonnet / Haiku spend split. Per-user flags. Model recommendation library. |
| **User Spend & Tokens** | Sortable table: spend, tokens, requests, avg context window, surfaces, spend limits |
| **Product Analysis** | Spend by surface (Cowork, Chat, Sheet Agent, Research, Claude Code) |
| **Savings Calculator** | Slider: migrate X% of Opus to Sonnet → projected AUD saving + annualised |
| **Report Generator** | One-click formatted governance report, copy to clipboard or download as .txt |
| **Initiative Tracker** | AI Committee initiatives with auto-calculated status (green/amber/red) |

---

## Users

- **Trav (operator):** Exports CSV weekly from Anthropic admin, uploads it, generates report for James.
- **James (CEO/MD):** Receives the weekly report by email.
- **AI Committee:** Monitors initiative progress (Module 8).
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
index.html          ← Entry point. Loads CDN deps + inlines all JSX via Babel.
dashboard.jsx       ← Source component (reference / dev copy).
package.json        ← Tells Railway to run: npx serve . --listen $PORT
railway.toml        ← Railway deploy config (healthcheck, restart policy)
.gitignore          ← Excludes .DS_Store, .env, node_modules
```

**No build step.** Babel compiles JSX in-browser at load time. All data processing is client-side. No API calls, no auth, no database.

---

## Phase 2 (planned)

- Persistent CSV history (PostgreSQL on Railway)
- Anthropic Console API auto-fetch
- Weekly report auto-email via Microsoft 365 SMTP
- Historical WoW / MoM trend charts
- Auth via email domain restriction

See `PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md` for full spec.

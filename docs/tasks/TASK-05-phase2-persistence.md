# TASK-05 — Phase 2: Periodic Data Storage & Historical Review

**Type:** Architecture scoping + implementation plan
**Effort:** Large (multi-session; Phase 2)
**Prerequisite:** TASK-01 through TASK-04 complete and deployed

---

## Goal

Enable the dashboard to:
1. Store each monthly CSV upload as a named period in a database
2. Show a period selector so any past period can be reviewed
3. Display trend charts (WoW / MoM) across periods in Module 2 and Module 4
4. Retain uploaded JSON behaviour data (conversations, projects) per period

Currently all data is session-only — a page refresh clears everything.

---

## Architecture options

### Option A — Supabase (recommended)

Supabase is a hosted Postgres service with a JavaScript client that works from a static site
(no backend required). Railway continues to serve the static files.

```
Browser (index.html)
    │  supabase-js client (CDN)
    ▼
Supabase project (Postgres + Auth)
    ├── table: periods          (id, label, date_from, date_to, created_at)
    ├── table: period_users     (period_id, email, spend_usd, tokens, ...)
    └── table: period_raw_rows  (period_id, raw_json) ← optional, for re-aggregation
```

**Pros:** Free tier (500 MB), no server code, JS SDK, row-level security, built-in Auth.
**Cons:** Adds a network dependency; API key visible client-side (mitigated by RLS).

### Option B — Railway Postgres + thin API

Add a small Express/Hono API on Railway that accepts POST of aggregated data and returns
stored periods. More control, more work.

### Option C — localStorage / IndexedDB

No database needed; data persists across page refreshes in the same browser only.
Not useful for a shared team dashboard (each user has their own storage).

**Recommendation: Option A (Supabase)**

---

## Phase 2 task breakdown (each = one context window)

### P2-TASK-01: Supabase project setup
- Create Supabase project via dashboard.supabase.com
- Create schema (periods, period_users tables — DDL below)
- Add Supabase project URL and anon key to `index.html` as constants
- Add supabase-js from CDN to `index.html`
- Smoke-test: `supabase.from("periods").select()` returns empty array

### P2-TASK-02: Save period on upload
- After `aggregateData` runs, show a "Save period" button (or auto-save prompt)
- Collect: period label (from filename date range or user-editable), date_from, date_to
- Insert one row to `periods`, then insert per-user rows to `period_users`
- Show success / error in Module 1 manifest area

### P2-TASK-03: Period selector + historical view
- On load, fetch all rows from `periods` (most recent first)
- Add a `<select>` dropdown in the page header: "Viewing: [current upload]" | saved periods
- Selecting a saved period loads `period_users` rows and re-renders all modules in read-only mode
- "Current upload" option returns to the in-memory session data

### P2-TASK-04: Trend charts in Module 2 and Module 4
- In Module 2, add a small line chart (Recharts LineChart) showing org adoption % and avg fluency
  over the last N periods
- In Module 4, add a spend trend sparkline per user (last 3–6 periods)
- Data sourced from `period_users` Supabase query grouped by period

### P2-TASK-05: Auth gate (domain restriction)
- Add Supabase Auth with Magic Link email sign-in
- Restrict to `@frankadvisory.com.au` and `@franklaw.com.au` domains
- Replace the PIN gate (TASK-02) with proper session auth
- Row-level security on Supabase tables: authenticated users can read/insert; no delete from UI

---

## Supabase DDL (for P2-TASK-01)

```sql
-- Periods
create table periods (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  date_from   date,
  date_to     date,
  created_at  timestamptz default now()
);

-- Per-user metrics per period
create table period_users (
  id               uuid primary key default gen_random_uuid(),
  period_id        uuid references periods(id) on delete cascade,
  email            text not null,
  name             text,
  entity           text,
  seat_tier        text,
  total_spend_usd  numeric,
  total_tokens     bigint,
  total_requests   integer,
  opus_pct         numeric,
  fluency_score    numeric,
  fluency_tier     integer,
  model_breakdown  jsonb,
  product_breakdown jsonb,
  created_at       timestamptz default now()
);

-- Indexes
create index on period_users (period_id);
create index on period_users (email);
```

---

## Environment variables / config

When P2 is implemented, move these out of the HTML source and into Railway environment variables
served via a lightweight config endpoint (avoids exposing them in the public source):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `ANTHROPIC_API_KEY` | Report generation key (currently hardcoded in TASK-04) |

A simple Railway `GET /config` endpoint can return these as JSON to the browser on load,
keeping secrets out of the committed source while remaining zero-build.

---

## Notes

- The current `initiatives` (Module 7) state is a good candidate for Supabase persistence too —
  add an `initiatives` table linked to the current user session in P2-TASK-02 or later.
- Conversation/project/memory JSON files contain PII (conversation titles) — consider whether
  to store raw data in Supabase or only the aggregated per-email metadata.
- Railway free tier: 512 MB RAM, $5/month Hobby plan is sufficient for this static + API setup.

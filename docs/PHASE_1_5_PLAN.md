# Phase 1.5 — Dashboard Enhancement Plan
**Date:** 2026-03-31
**Author:** Trav (synthesised by Claude)
**Status:** Planning — ready to execute

---

## Context

Phase 1 is live on Railway. The dashboard ingests the Anthropic admin CSV (spend + tokens) and produces 8 modules. Good foundation.

Phase 1.5 expands the data layer and module quality significantly without requiring a backend. Everything stays client-side. This sets up Phase 2 (PostgreSQL, auto-fetch, auth) with a much richer model.

**New data sources available:**
- `conversations.json` — 358 conversations, 74 MB, linked via `account.uuid`
- `projects.json` — 31 projects, 1.2 MB, linked via `creator.uuid`
- `memories.json` — 4 records (Trav, Bahar, Ben, Rhys), indicates advanced config
- `users.json` — 8 users, canonical UUID→email→name mapping

These are Claude.ai data exports. They give us **behavioural signals** that the spend CSV alone cannot.

---

## Changes Summary

### Category A — Immediate fixes (no new data required)

| # | Fix | Effort |
|---|-----|--------|
| A1 | Swap Module 7/8 numbering — Module 7 = Initiative Tracker, Module 8 = Report Generator | 5 min |
| A2 | AUD/USD live rate with refresh button | 1 hr |
| A3 | Seat tier display — Premium vs Standard, cost per seat breakdown | 1 hr |

---

### Category B — Data layer expansion

#### B1 — Claude.ai Export Ingestion

Add a second upload zone in Module 1 (Data Ingestion) accepting the Claude.ai data export files:

- Upload: `conversations.json` + `projects.json` + `memories.json` + `users.json`
- Parse and join on `account.uuid` → `users.json.uuid` → email → USERS_MAP
- Store as `conversationData`, `projectData`, `memoryData` in component state
- All existing modules continue to work from the spend CSV only; conversation data **enriches** them

**UUID → email join table** (derived from users.json):
```
d5e0fc6e → trowley@frankadvisory.com.au  (Travis Rowley)
e5b76c83 → Alex@frankadvisory.com.au
a4470fc5 → andrea@frankadvisory.com.au
[rsharma uuid] → rsharma@frankadvisory.com.au
75a71888 → bagar@franklaw.com.au          (Bahar)
[tbrcic uuid] → tbrcic@franklaw.com.au
63966804 → rlyons@franklaw.com.au          (Rhys)
[bwoodward uuid] → bwoodward@franklaw.com.au (Ben)
```

Note: 4 users (Bahar, Trav, Ben, Rhys) have memory records — indicator of advanced configuration.

**Performance note:** 74 MB conversations.json is heavy for a browser parse. Strategy:
1. Parse on upload, extract only the fields we need (uuid, account.uuid, message count, timestamps, name)
2. Drop `chat_messages` content from memory after extraction — we don't need the raw text
3. Store derived `conversationMetrics` object (~50 KB) in state

#### B2 — Claude Code Team CSV Ingestion

Trav uses Claude Code (separate billing to the Team plan). CSV schema confirmed:

```
User,Spend this Month (USD),Lines this Month
trowley@frankadvisory.com.au,$135.85,"35,497"
```

**Confirmed:** Only Trav appears in this CSV — he's the only team member on Claude Code.

**March 2026 data:** Trav spent $135.85 USD, generated 35,497 lines of code in the period 1 Mar–1 Apr 2026.

**Dashboard changes:**
- Module 1 gets a third upload zone: "Claude Code Usage (Optional)" — accepts the Claude Code Team CSV
- Module 4 table: Trav gets a second row "Travis (Claude Code)" showing the Claude Code spend and lines generated
- New metric in Module 1 summary: "Claude Code Lines Generated: 35,497"
- Flag clearly as different billing so it doesn't skew org averages or fluency calculations
- Lines of code = a useful proxy for developer-tier AI adoption depth

---

### Category C — Enhanced Digital Fluency Score (Module 2)

#### Current formula (CSV-only)
```
fluencyScore = tokenVolume×0.5 + surfaceDiversity×0.3 + recency×0.2
```
This is purely spend-derived. A user could have high tokens but use Claude for one repetitive task.

#### Proposed formula (multi-signal)

When conversation data is loaded, replace with:

```
fluencyScore = (spendSignal × 0.25) + (conversationSignal × 0.40) + (projectSignal × 0.20) + (configSignal × 0.15)
```

**spendSignal (0–100):** Token volume relative to org average + surface diversity — existing logic

**conversationSignal (0–100):**
- Conversation count score (normalised, cap at 50 convos = 100)
- Avg messages per conversation (depth): 1–2 msgs = 20pts, 3–5 = 50pts, 6–10 = 75pts, 10+ = 100pts
- Topic diversity: unique conversation categories / total categories × 100
- Recency: days since last conversation (same as existing)

**projectSignal (0–100):**
- Projects created ≥1 = 40pts base
- Has custom prompt_template = +30pts (sophisticated usage)
- Doc uploads ≥3 = +20pts
- Private projects ≥1 = +10pts (using Claude for real work, not just exploration)

**configSignal (0–100):**
- Memory record exists = 60pts (intentional configuration)
- Memory length >2000 chars = +20pts (detailed context setup)
- Phone verified = +20pts (full account activation)

#### Revised tier definitions

| Tier | Score | Definition |
|------|-------|------------|
| **Super User** | ≥70 | Daily active, complex multi-turn tasks, uses projects with custom prompts, memory configured |
| **Active** | 40–69 | Regular usage (3–4×/week), starting to build structured workflows, some project usage |
| **Getting Started** | 10–39 | Occasional usage, mostly single-turn Q&A, not yet using structured features |
| **Not Started** | <10 | Minimal or no activity |

When only spend CSV is loaded (no conversation data), fall back to the existing formula — label it "Spend-based estimate. Upload conversation data for full score."

---

### Category D — Seat Tier Differentiation (Modules 1, 4)

**Current state:** All 8 seats shown as equal. This is misleading.

**From Anthropic admin screenshot:**
- Alex = **Premium** seat
- All others = **Standard** seat (7 seats)

**Changes:**
1. Add `SEAT_TIERS` constant: `{ 'Alex@frankadvisory.com.au': 'Premium', ... rest: 'Standard' }`
2. Module 4 table: add "Seat Tier" column with badge (Premium = gold, Standard = grey)
3. Module 1 summary: show seat cost breakdown
   - Standard seat cost (USD/month) — hardcode or make editable
   - Premium seat cost (USD/month) — hardcode or make editable
   - Total seat cost vs total actual spend — shows % of seat cost being "used"
4. Cost per seat = actual spend ÷ seat count (by tier separately)

**Seat cost constants (confirmed from billing screenshot):**
- Standard seat: AUD $25/month per user
- Premium seat: AUD $125/month per user
- Current org setup: 8 Standard (1 unclaimed) + 1 Premium (0 unclaimed)
- Total monthly seat cost: (8 × A$25) + (1 × A$125) = A$200 + A$125 = **A$325/month**
- Plus Trav's Claude Code: $135.85 USD/month (separate billing)
- Cost per active seat = total seat cost ÷ active seats (7 active Standard + 1 Premium = 8 active)

---

### Category E — Module 9: Personalised User Coaching

New module below Module 8. Each team member gets a card.

**Card structure:**
```
[User name] | [Fluency tier badge] | [Entity badge]

What you're doing well:
- [2–3 positives derived from their usage data]

To level up:
- [2–3 specific, actionable recommendations]

[Encouragement line]
```

**Logic for "doing well" signals:**
- High conversation count → "You're building a strong Claude habit — X conversations this period"
- High avg message depth → "You're working iteratively — your avg conversation is X turns deep"
- Custom project prompts → "You've configured structured projects — that's advanced usage"
- Memory set up → "Memory configured — Claude knows your context across sessions"
- Multi-surface usage → "Using Claude across X surfaces shows good integration thinking"
- Low Opus% (good cost hygiene) → "Model selection is efficient — X% on Sonnet/Haiku"

**Logic for "to level up" recommendations:**
- No projects created → "Create a project for [their work area] to give Claude persistent context"
- No memory set up → "Set up memory to stop re-explaining your role every session"
- Low avg message depth (1–2) → "Try multi-turn iteration — share a draft and ask Claude to improve it"
- Only one surface used → "Try Cowork mode for document work or Claude Code for automation"
- High Opus% → "Switch default to Sonnet for standard drafting — saves cost with no quality loss"
- No conversations for 7+ days → "You haven't used Claude this week — even a quick task helps build the habit"

**Cross-team learning spotlight (within Module 9):**
- Identify the top user per use-case category (from conversation name analysis)
- Show: "Alex is getting strong results with [GTM/research/drafting]. Their approach: [summary]"
- Pull from conversation names — no content exposure, just topic patterns

**Privacy note:** Module 9 shows patterns, not content. No message text is displayed. Conversation names only.

---

### Category E2 — Report Export: Frank-branded Word & PDF

The current Module 8 report generator outputs a plain text block for copy-paste. This needs to be a proper downloadable document for James (MD).

**Two export buttons:**
- "Download .docx" — Word document, Frank Group branded
- "Download .pdf" — PDF rendered from the same template

**Document structure (mirrors the text report but formatted):**

```
[Cover block]
Frank Group — AI Governance Report
Period: [DD Month YYYY – DD Month YYYY]
Prepared by: Travis Rowley
Date: [generated date]

[Section 1] Executive Summary
- Key metrics (org adoption rate, avg fluency, total spend, Opus%)
- Period highlights

[Section 2] Team Overview
- Adoption table (name, tier, score, seat type)
- Fluency leaderboard

[Section 3] Model Governance
- Opus/Sonnet/Haiku split
- Per-user flags
- Savings opportunity

[Section 4] Spend & Seat Cost
- Total spend vs seat cost
- Per-user spend table
- Spend limit utilisation

[Section 5] Initiatives
- Current status of each AI Committee initiative (from Module 7 tracker)

[Section 6] Recommendations
- Top 3 recommended actions this period

[Footer]
Frank Advisory | AI Governance Dashboard | Confidential
```

**Branding applied to export:**
- Cover page: Dark Indigo (`#1e1645`) background, white "Frank Group" wordmark, Vivid Yellow-Green (`#88aa00`) accent line
- Section headings: Dark Indigo, bold
- Key metric callouts: Vivid Yellow-Green accents
- Table headers: Dark Indigo background, white text
- Body text: `#1a1a1a`
- Footer: Frank Advisory branding, address, confidential label

**Technical approach:**
- `.docx`: Use `docx.js` (CDN) or `pizzip` + `docxtemplater` — pure client-side, no server needed
- `.pdf`: Use `jsPDF` (CDN) — render the same content to PDF client-side
- Both generated in-browser from the same data state, no backend required
- Filename: `FrankGroup_AI_Governance_[YYYY-MM-DD].docx` / `.pdf`

---

### Category F — Module Order Fix

Current rendered order (from screenshot): Module 6 → Module 8 (Initiative Tracker) → Module 7 (Report Generator)

Fix: Reorder JSX so:
- Module 7 = AI Committee Initiative Tracker
- Module 8 = Report Generator

Update heading strings only — no logic changes.

---

## Implementation Order

### Sprint 1 — Quick fixes (deploy same day)
1. A1: Fix module numbering
2. A2: AUD/USD refresh button
3. A3: Seat tier display
4. F: Module order fix

### Sprint 2 — Data ingestion
5. B1: Claude.ai export ingestion (conversations + projects + memories)
6. UUID join table hardcode
7. Performance-safe parsing (extract and drop)

### Sprint 3 — Enhanced analytics
8. C: New fluency score formula (multi-signal)
9. Revised tier definitions and labels
10. B2: API plan upload zone

### Sprint 4 — New modules
11. E: Module 9 personalised coaching cards
12. Cross-team learning spotlight

---

## Data Schema Reference

### Conversations.json
```
account.uuid       → join to users.json uuid
chat_messages[]    → count = engagement depth
created_at         → onboarding date (first ever) / recency
updated_at         → last activity
name               → topic label (use for category classification)
```

### Projects.json
```
creator.uuid       → join to users.json uuid
prompt_template    → non-empty = sophisticated usage
is_private         → real work signal
docs[]             → length = project maturity
created_at         → project creation (adoption timeline)
```

### Memories.json
```
account_uuid       → join to users.json uuid
conversations_memory → non-empty = memory configured; length = depth of config
```

### Users.json
```
uuid               → primary join key
email_address      → maps to USERS_MAP
full_name          → display name
verified_phone_number → null = unverified account
```

---

### Category G — Gamification & Internal Leaderboard (Module 9 extension)

**Concept:** Weekly digital fluency leaderboard to drive friendly internal competition and accelerate adoption. Keep it fun, not punitive.

#### Leaderboard component (within Module 9 or as its own sub-panel)

**Weekly Fluency Leaderboard:**
- Ranked by fluency score (highest to lowest)
- Tier badge next to each name
- Points displayed prominently: "56.1 pts"
- Delta from last week: "+4.2 ▲" or "-1.0 ▼" (requires two periods of data — Phase 2 with persistent storage; Phase 1.5 shows current period only)
- Top player gets a crown/trophy icon (no em dashes, just a simple visual treatment)

**Sample render:**
```
#1  Travis Rowley   🏆  Super User   91.2 pts
#2  Alex            ⭐  Active       68.4 pts
#3  Rhys            ⭐  Active       55.7 pts
#4  Bahar              Getting Started  38.1 pts
...
```

**Streak indicator:** Consecutive weeks in the same tier or improving = streak counter. "Week 3 streak" shown on card.

#### Weekly Personal Scorecard (email-ready)

When Trav generates the weekly report (Module 8), include a section each person can receive:

```
Hi [Name], here's your AI fluency score for the week of [date]:

Score: [X] / 100  |  Tier: [Tier]  |  Rank: #[N] of 8

What moved your score:
- [Top driver]
- [Second driver]

This week's focus: [One specific recommendation]

[Encouragement line]
```

Designed as a paste-in to email or Slack DM — keeps it informal and human.

#### Gamification mechanics (Phase 1.5 — simple)
- **Tier progression celebration:** First time a user hits a new tier, Module 9 shows a highlight card (confetti optional but fun)
- **Org milestone badges:** When the team collectively hits a milestone (e.g., 500M tokens, all 8 seats active, avg fluency ≥60), a banner appears at the top of the dashboard
- **"Most improved" callout:** User with the highest score increase week-over-week gets called out in the report

#### Gamification mechanics (Phase 2 — with persistence)
- Week-over-week delta tracking (need historical data in PostgreSQL)
- "Streak" badges for consecutive weeks of improvement
- Cumulative leaderboard across the full year

**Tone guidance for all gamification copy:** Positive, fun, slightly competitive — never shaming. Low scorers get encouragement, not negative framing. Think internal Slack announcement energy, not performance review.

---

### Category H — Frank Group Branding

The dashboard is now live and will be seen by James (CEO) and the AI Committee. Current colours are close but not brand-compliant. Update to The Frank Group visual identity.

#### Colour changes

| Element | Current | Replace With | Hex |
|---------|---------|--------------|-----|
| Entity header — Frank Advisory | `#1a3a5c` (close but wrong) | Dark Indigo | `#1e1645` |
| Entity header — Frank Law | `#2d7d5f` | Dark Indigo | `#1e1645` |
| Module headings / H1–H4 | Various | Dark Indigo | `#1e1645` |
| Key metrics / callout highlights | Various | Vivid Yellow-Green | `#88aa00` |
| Body text | `#333` or default | Near-black | `#1a1a1a` |
| Captions, labels, footnotes | Various | Dark grey | `#4a4a4a` |
| Page / card backgrounds | White | White | `#ffffff` |
| Model tier — Opus (danger) | `#e74c3c` | Keep red — functional colour, not brand |  |
| Model tier — Sonnet (good) | `#2d7d5f` | Vivid Yellow-Green | `#88aa00` |
| Model tier — Haiku (neutral) | `#3a86c8` | Muted Dark Indigo variant | `#3a4a7c` |
| Fluency tier badges | Various | Dark Indigo bg + white text for Super User; `#88aa00` for Active; grey for lower tiers | — |
| Progress bars — positive | Green | Vivid Yellow-Green | `#88aa00` |
| Progress bars — warning/amber | Amber | Keep amber — functional | — |
| Progress bars — red | Red | Keep red — functional | — |
| Leaderboard #1 highlight | — | Dark Indigo background + `#88aa00` accent | — |

**Forbidden colours to remove:** any Tailwind greys (`#1F2937`, `#374151`, `#4B5563`, `#6B7280`, `#9CA3AF`). Any generic blues (`#3a86c8`) from current palette outside of functional model-tier coding.

#### Typography
- All module headings: Bold, Dark Indigo `#1e1645`
- Section labels and card headings: Bold, Dark Indigo
- Body text: `#1a1a1a`
- Accent/highlight numbers (key metrics): Vivid Yellow-Green `#88aa00`
- Footnotes / data source labels: `#4a4a4a`

#### Header bar
- Background: Dark Indigo `#1e1645`
- Text: White `#ffffff`
- Accent element (divider or logo mark): Vivid Yellow-Green `#88aa00`
- Add "The Frank Group" wordmark or "Frank Advisory" text to header (not just "AI Governance Dashboard")

#### Entity badges
- Frank Advisory badge: Dark Indigo bg, white text
- Frank Law badge: Dark Indigo bg, `#88aa00` text or border (to distinguish without using off-brand colours)

#### COLOURS constant update (in index.html)
```js
const COLOURS = {
  advisory: '#1e1645',      // Dark Indigo
  law: '#1e1645',           // Dark Indigo (differentiated by badge style, not colour)
  opus: '#e74c3c',          // Keep red — functional (danger signal)
  sonnet: '#88aa00',        // Vivid Yellow-Green — efficient model
  haiku: '#3a4a7c',         // Muted indigo — lowest tier model
  superUser: '#1e1645',     // Dark Indigo
  active: '#88aa00',        // Vivid Yellow-Green
  gettingStarted: '#6b7280', // Neutral grey
  notStarted: '#d1d5db',    // Light grey
  accent: '#88aa00',        // Vivid Yellow-Green
  bodyText: '#1a1a1a',
  captionText: '#4a4a4a',
  background: '#ffffff',
}
```

---

## Open Questions

1. **Conversation data privacy** — CONFIRMED: metadata only. No message text displayed. Extract and drop raw content after parsing.

2. **Seat pricing** — CONFIRMED from billing screenshot: Standard A$25/month, Premium A$125/month. 8 Standard + 1 Premium = A$325/month total seat cost.

3. **Claude Code CSV** — CONFIRMED schema. Only Trav appears. $135.85 USD / 35,497 lines for March 2026.

~~4. API plan CSV schema~~ — Resolved. It's the Claude Code Team CSV, not a raw API CSV.

---

## Files to Update

| File | Change |
|------|--------|
| `index.html` | All logic changes (source of truth) |
| `src/dashboard.jsx` | Keep in sync with index.html |
| `CLAUDE.md` | Update with Phase 1.5 constants and new modules |
| `docs/PRD_FrankGroup_AI_Governance_Dashboard_2026-03-31.md` | Append Phase 1.5 spec |

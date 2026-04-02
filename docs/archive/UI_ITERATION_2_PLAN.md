# Dashboard UI Iteration 2 — Execution Plan

## Context
Second UI review pass. Travis reviewed the live preview and identified 12 targeted improvements across every section. No backend/Supabase changes required. All edits to `index.html` only (source of truth). Do not push to GitHub until Travis approves locally.

**ROI methodology:** Updated based on LLM Council research (`docs/council-answer-2026-04-01.md`). Token-based session estimation replaces flat request-counting; task benchmarks from HBS/BCG/Stanford replace generic McKinsey percentages.

---

## Change 1 — Header: Remove demo pill, fix sub-title

**File:** `index.html` ~line 3191

**What:**
- Remove the "Demo mode — upload CSV to load real data" blue pill entirely. It appears when `!rawRows && !usageRowsData`. Remove that `React.createElement` branch completely. Keep the "DB ·" and "Live:" pill for when data is present — those stay.
- Change sub-title from `"Frank Advisory · Frank Law · Phase 2 preview"` → `"Frank Advisory · Frank Law · Frank Capital"`

---

## Change 2 — ROI stat boxes: number formatting + updated disclaimer

**File:** `index.html` ~lines 1502–1521

**What:**
1. The "Est. Value Delivered" StatBox displays without commas (e.g. `A$14686.67`). Fix by adding `.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2})` to the value so it renders `A$14,686.67`.
2. The disclaimer paragraph (lines 1516–1521): replace the entire string with:
   `"Estimates use role-weighted task benchmarks (HBS/BCG/Stanford). Calibrate accuracy by logging completed tasks with the 'Log a Win' button. Hourly rate: A$" + settings.roiHourlyRate + ". Adjust in Settings."`
3. Add a small inline "📝 Log a Win" button after the disclaimer text, styled as an accent-coloured pill (`background: #88aa00, color: #1a1a1a, fontSize: 11, padding: "3px 10px", borderRadius: 9999, border: "none", cursor: "pointer", marginLeft: 8`). For now the `onClick` handler is: `() => window.alert("Time log feature coming soon. Contact Travis to set up your first workflow.")`. This is a Phase 3 placeholder.

---

## Change 3 — AI Adoption: Move Model Efficiency, reorder "How is this calculated?"

**File:** `index.html` ~lines 1534–1585

**What:**
1. **Remove** the Model Efficiency mini-stat bar (lines ~1534–1539) from AI Adoption entirely. The block starts with `React.createElement("div", { style:{ background:"#f8fafc"...} }, React.createElement("span",...,"Model Efficiency: ")`. Remove it completely — it will appear in Module 3 instead (Change 5a).
2. **Move** the "ⓘ How is this calculated?" button + collapsible legend panel (lines ~1554–1585) to appear **below** the fluency tier cards. Currently it sits above the cards (`fluentUsers` map). Move the entire block (button + the `showFluencyLegend &&` panel) to after the closing `</div>` of the tier cards map.

---

## Change 4 — First names only (global)

**File:** `index.html`

**What:** Wherever `u.name` is used as a visible display label, replace with `u.name.split(' ')[0]`. Key confirmed locations:
- Fluency tier cards (~line 1592)
- Coaching & Leaderboard / Module 9 (~line 2567)
- Any other `u.name` in rendered output (tables, cards, banners)

**Rules:**
- Do **not** change `u.name` in the `USERS_MAP` constant definition itself
- Do **not** change `u.name` used as a data key, sort key, or in non-rendered logic
- Special case in Model Governance table: `Travis Rowley (Benchmark)` — change to `Travis (Benchmark)` by applying `.split(' ')[0]` before appending ` (Benchmark)`

---

## Change 5 — Model Governance: Fix pie chart + move Model Efficiency + recolor

**File:** `index.html` ~lines 1534–1539 (Model Efficiency block), 1621–1679 (Module 3)

### 5a — Add Model Efficiency to top of Module 3
Take the Model Efficiency block removed in Change 3 and re-render it at the top of the Module 3 card, before the `div` containing the pie chart and table. Same JSX, same logic (`metrics.org_opus_pct`), same styling.

### 5b — Fix pie chart legend
Current problem: inline `label` prop on `<Pie>` pushes small slices (3% Haiku) off-screen — the label renders outside the SVG boundary.

Fix:
- Remove the `label` prop from the `<Pie>` component entirely
- Add a `<Legend />` component (Recharts, already available via CDN) inside the `<PieChart>` container, positioned below the chart
- OR use a custom `renderCustomizedLabel` function that suppresses labels where `value < 8` (avoid off-screen renders for tiny slices)
- Preferred: `<Legend />` component for simplicity

### 5c — Recolor model tiers (not status)
Update the `COLOURS` object (~lines 144–158):
```js
opus:  "#1e1645",   // was #e74c3c — now navy (flagship model, not a danger signal)
haiku: "#f59e0b",   // was #2563eb — now amber (matches tier3 colour, lighter usage)
// sonnet stays #88aa00 (green, efficient middle tier)
```

This propagates automatically to:
- Pie chart Cell fills (`COLOURS[e.name.toLowerCase()]`)
- Opus% and Haiku% column text in the governance table (`COLOURS.opus` / `COLOURS.haiku`)
- Module 5 BarChart cells (where `COLOURS.opus` is referenced)

**Critical:** The Status column (High / Moderate / OK) uses **inline** `#dc2626`/`#f59e0b`/`#166534` colors — do NOT change those. Verify lines ~1669–1679 to confirm the status column is not affected by the COLOURS object change.

---

## Change 6 — Product Analysis (Module 5): Frank Group brand bar colors

**File:** `index.html` ~lines 1939–1951

**What:** The BarChart Cell fill currently uses a status-style conditional (`opus > 80 → red, opus > 50 → amber, else → green`). Surface bars show WHERE people work — this isn't a status signal. Replace with brand-palette cycling colors:

```js
const SURFACE_PALETTE = ["#1e1645", "#88aa00", "#f59e0b", "#3b82f6", "#6366f1", "#0ea5e9"];
// Use: fill: SURFACE_PALETTE[index % SURFACE_PALETTE.length]
```

Pass `index` via the `.map((e, i) => ...)` callback on the `surfaceData` array.

If there is a separate Opus-by-surface chart/overlay that specifically signals Opus overuse, that chart can retain its red/green encoding — it IS a status signal. Only change the main surface usage bars.

Update the legend colours to match.

---

## Change 7 — Admin tab: ROI Settings panel

**File:** `index.html` — Module1 Admin section (~lines 1168+)

**Research basis:** `docs/council-answer-2026-04-01.md` — token-session estimation is more defensible than request-counting; task-specific benchmarks from HBS/BCG/Stanford replace generic % estimates.

### 7a — New state fields
Add to the `settings` state initial object in `App` (find the existing `useState` for settings):
```js
roiHourlyRate: 200,          // A$/hr
roiMinutesPerTask: 20,       // avg task time (minutes)
roiSavingLegal: 0.40,        // HBS/BCG + Stanford/LegalBench
roiSavingFinance: 0.35,      // Microsoft/GitHub Copilot RCT
roiSavingAdvisory: 0.40,     // HBS/BCG "Cyborg" study
```

### 7b — Update ROI formula in Module 2
Find the current calculation that does `requests × 20 × ROI_PRESETS[role].timeSavingPct / 60`.

Replace with token-based session estimation:
```js
const AVG_TOKENS_PER_SESSION = 8000; // typical professional task session
const roleSaving = settings['roiSaving' + (roleType.charAt(0).toUpperCase() + roleType.slice(1))] || 0.35;
const estimatedSessions = Math.min(u.totalTokens / AVG_TOKENS_PER_SESSION, 3 * u.totalRequests);
const hoursSaved = estimatedSessions * settings.roiMinutesPerTask * roleSaving / 60;
const valueSaved = hoursSaved * settings.roiHourlyRate;
```

The `3 * totalRequests` cap prevents token outliers from producing absurd multipliers (implements the 3× cap from the research).

### 7c — Admin ROI Settings UI
Add a new collapsible section "⚙️ ROI Settings" in the Admin panel (after the existing AUD rate + seat settings, before data management). The section contains:
- **Hourly Rate (A$/hr):** number input, `min=50 max=1000 step=10`, bound to `settings.roiHourlyRate`
- **Avg Minutes per Task:** number input, `min=5 max=120 step=5`, bound to `settings.roiMinutesPerTask`
- **Legal saving %:** number input showing as `%` (multiply/divide by 100 for display), bound to `settings.roiSavingLegal`
- **Finance saving %:** same pattern, `settings.roiSavingFinance`
- **Advisory saving %:** same pattern, `settings.roiSavingAdvisory`
- Small italic caption: `"Benchmarks: Legal 40% (HBS/BCG/Stanford), Finance 35% (GitHub Copilot RCT), Advisory 40% (BCG Cyborg study). Replace with your own data as you log tasks."`

Also add a read-only **Task Taxonomy reference** (collapsed by default behind a "View task categories" toggle) showing the 12 task types from the research as a simple unordered list grouped by role. This is reference-only — it will feed the "Log a Win" survey in Phase 3.

### 7d — Remove ROI_PRESETS constant
Delete or comment out the hardcoded `const ROI_PRESETS = {...}` block near the top of the file (lines ~77–81) since it's now replaced by `settings` state.

---

## Change 8 — Admin tab: Seat tier management

**File:** `index.html` — Module1 Admin section

**What:** Add a "Seat Configuration" section in Admin showing each user from `USERS_MAP` with a `<select>` dropdown for their tier (`Standard` / `Premium`).

- Store overrides in `settings.seat_overrides` as `{ [email]: "Standard" | "Premium" }`
- Persist to `app_settings` in Supabase (same key/value pattern as other settings)
- In `aggregateData`, update `seatTier` logic to check `settings.seat_overrides[email]` first, then fall back to `BILLING_PREMIUM_SEATS` list
- Display: a compact table with columns User, Email, Current Tier (dropdown)
- On change: update `settings.seat_overrides` in state → triggers re-calculation of seat costs in Module 1 and Module 4

---

## Change 9 — Admin tab: Team member management

**File:** `index.html` — Module1 Admin section

**What:** Add a "Team Members" section in Admin with full CRUD for the user roster.

**Display:** A table with columns:
- Name (editable text input inline or on row click)
- Email (read-only — primary key)
- Entity: dropdown (Frank Advisory / Frank Law / Frank Capital)
- Role Type: dropdown (advisory / finance / legal)
- Seat Tier: dropdown (Standard / Premium)
- Active: checkbox
- Remove button (soft-delete — sets `active: false`)

**Add member:** "＋ Add member" button opens an inline form row at the bottom with fields for email, name, entity, role, tier.

**Persistence:** Store as `settings.team_overrides = [{ email, name, entity, roleType, tier, active }]`. Persist to `app_settings`.

**Runtime merge:** At app load, after resolving `USERS_MAP`, merge `team_overrides` over the base map: overrides win on name/entity/roleType/tier; `active: false` entries are excluded from all module calculations.

**Auto-add from ingest:** When a CSV row contains an email not in the resolved user map, add it to `team_overrides` with `{ name: email.split('@')[0], entity: "Frank Advisory", roleType: "advisory", tier: "Standard", active: true }` as defaults. The admin can then edit from the panel.

---

## Change 10 — New "Tools" tab + move Savings Calculator

**File:** `index.html` ~lines 975–1001 (TabBar), App render area

**What:**
1. Add a third tab to the `tabs` array in `TabBar`:
   ```js
   { id: "tools", label: "Tools" }
   ```
2. In the App render, wrap Module 6 (`<Module6 ... />`) in `activeTab === "tools" && ...`
3. Remove Module 6 from the Dashboard tab render
4. Add a heading in the Tools tab area: "Cost Optimisation Tools" with a caption: "Scenario modelling and what-if calculators."
5. The Tools tab is also the future home of the "Log a Win" survey form (Phase 3) and any other operational tools.

---

## Change 11 — Report Generator (Module 8): Reorder + clean up API key

**File:** `index.html` ~lines 2228–2350+ (Module 8), App render

**What:**
1. **Move Module 8 below Module 9** in the Dashboard tab render order. Currently it renders as: `...Module 9... Module 8...` — wait, check: Module 8 is at line 2228 and Module 9 at line 2538, so Module 8 currently renders FIRST. Swap so Module 9 (Coaching) renders before Module 8 (Report Generator).
2. **Remove the OpenRouter API key paste input** from Module 8 UI. The key should come only from `runtimeCfg.openrouterKey` (injected via Railway env → `dashboard-config.json`). Find the paste input field (~lines 2323–2340) and replace it with a static inline message when no key is configured: `"AI narrative generation requires OPENROUTER_API_KEY to be configured in Railway environment variables — contact your administrator."` styled as a muted caption.
3. The "Generate template report" button (no API key required) stays exactly as-is.

---

## Change 12 — Coaching & Leaderboard (Module 9): Improved nudge copy

**File:** `index.html` ~lines 2538–2610+

**What:**
1. First-name-only: covered by Change 4 above — confirm it applies to coaching cards here too.
2. Find the rule-based nudge/card generation logic and replace the nudge messages with more specific, actionable copy based on usage signals:

| Condition | New nudge message |
|-----------|------------------|
| `fluencyTier === 1` (Super User) | `"Top of the board this period. Consider sharing one workflow with the team at the next AI committee meeting."` |
| `fluencyTier === 2` (Active) and `opusPct > 80` | `"You're relying heavily on Claude's most powerful model. Try Sonnet for drafting, reformatting and summarising — it's faster and costs less."` |
| `fluencyTier === 2` (Active) | `"Solid usage this period. Your next step: tackle one more recurring task and build it into a repeatable prompt."` |
| `fluencyTier === 3` (Getting Started) | `"You're getting started — great. Pick one task you do every week and delegate it entirely to Claude. Run it 3 times this week."` |
| `fluencyTier === 4` (Not Yet Active) or `requestCount === 0` | `"No usage logged this period. Book 15 minutes with Travis to set up your first Claude workflow."` |

All nudges remain metadata-only (no message body access). Logic keys off `u.fluencyTier`, `u.opusPct`, `u.totalRequests`.

---

## Execution strategy — 2 sequential agents

All changes are in `index.html`. Parallel agents on the same file create merge conflicts. Run sequentially:

### Agent A — Presentation layer (Changes 1, 2, 3, 4, 6, 11, 12)
Pure JSX/text changes. No new state, no new components, no tab restructuring.

### Agent B — Structure + features (Changes 5, 7, 8, 9, 10)
New admin panels, new state fields, tab restructure, ROI formula update.

**Agent B must `git pull` before starting** — Agent A's commits will be in the history.

---

## Agent A — Full execution prompt

```
You are an execution agent. Your task is to apply UI changes to a React dashboard.

Read these files first (in order):
1. docs/AGENT_HANDOFF.md
2. CLAUDE.md
3. docs/UI_ITERATION_2_PLAN.md — implement Changes 1, 2, 3, 4, 6, 11, 12 ONLY

Your scope: index.html only. You will apply 7 presentation-layer changes:
- Change 1: Remove demo pill from header. Change sub-title to "Frank Advisory · Frank Law · Frank Capital"
- Change 2: Fix A$ number formatting (add commas). Update ROI disclaimer text. Add "Log a Win" placeholder button.
- Change 3: Remove Model Efficiency bar from AI Adoption. Move "How is this calculated?" to below the tier cards.
- Change 4: Replace u.name display labels with u.name.split(' ')[0] globally (first names only). Do NOT change USERS_MAP constants or data keys.
- Change 6: Replace conditional red/green BarChart fills in Module 5 with brand-palette cycling colors using SURFACE_PALETTE array.
- Change 11: Swap Module 8 and Module 9 render order (Coaching before Report). Remove OpenRouter API key paste input from Module 8 — replace with static message if key not configured.
- Change 12: Update nudge copy in Module 9 per the table in the plan.

DO NOT touch:
- Tab structure (TabBar tabs array)
- New admin settings panels
- COLOURS constant
- Model Governance section (Module 3)
- Any Supabase/Edge Function code

After applying all 7 changes:
1. Verify index.html opens in browser without console errors
2. Sync changes to src/dashboard.jsx (same script block, add ESM imports + export default App at top/bottom)
3. Update docs/AGENT_HANDOFF.md — add a one-line entry under "Recent changes" noting UI Iteration 2 Part A complete
4. Commit: git add index.html src/dashboard.jsx docs/AGENT_HANDOFF.md && git commit -m "feat: UI iteration 2 part A — presentation layer, first names, brand colors, nudge copy"
```

---

## Agent B — Full execution prompt

```
You are an execution agent. Your task is to apply structural and feature changes to a React dashboard.

IMPORTANT: Run `git pull` first — Agent A's commits are already in the repo.

Read these files first (in order):
1. docs/AGENT_HANDOFF.md
2. CLAUDE.md
3. docs/UI_ITERATION_2_PLAN.md — implement Changes 5, 7, 8, 9, 10 ONLY
4. docs/council-answer-2026-04-01.md — ROI methodology research (informs Change 7)

Your scope: index.html only. You will apply 5 structural/feature changes:

- Change 5: (a) Move Model Efficiency stat to top of Module 3. (b) Fix pie chart by replacing inline `label` prop with a Recharts `<Legend />` component. (c) Update COLOURS.opus to "#1e1645" and COLOURS.haiku to "#f59e0b".
- Change 7: (a) Add 5 new fields to settings state initial object (roiHourlyRate, roiMinutesPerTask, roiSavingLegal, roiSavingFinance, roiSavingAdvisory). (b) Replace ROI formula in Module 2 with token-based session estimation using AVG_TOKENS_PER_SESSION = 8000 and 3× cap. (c) Add "ROI Settings" collapsible panel in Admin tab with number inputs for all 5 fields. (d) Remove hardcoded ROI_PRESETS constant.
- Change 8: Add "Seat Configuration" section in Admin tab — per-user dropdown for Standard/Premium tier. Store in settings.seat_overrides. Update aggregateData to check seat_overrides first.
- Change 9: Add "Team Members" section in Admin tab — table with edit/add/remove for all USERS_MAP users. Store overrides in settings.team_overrides. Merge at runtime. Auto-add unknown emails from CSV ingest.
- Change 10: Add "Tools" tab to TabBar. Move Module 6 (Savings Calculator) to render only when activeTab === "tools". Add heading "Cost Optimisation Tools".

DO NOT re-apply Changes 1–4, 6, 11, 12 (Agent A already committed those).
DO NOT touch Supabase Edge Function code.

After applying all 5 changes:
1. Verify index.html opens in browser without console errors. Check Admin tab shows all 3 new panels. Check Tools tab shows Savings Calculator.
2. Sync to src/dashboard.jsx
3. Update docs/AGENT_HANDOFF.md
4. Commit: git add index.html src/dashboard.jsx docs/AGENT_HANDOFF.md && git commit -m "feat: UI iteration 2 part B — ROI formula, admin panels, team management, tools tab"
```

---

## New state fields summary

```js
// Add to settings useState initial value:
roiHourlyRate: 200,
roiMinutesPerTask: 20,
roiSavingLegal: 0.40,
roiSavingFinance: 0.35,
roiSavingAdvisory: 0.40,
seat_overrides: {},
team_overrides: [],
```

## Tab structure after changes

```
Dashboard | Admin | Tools
```
- **Dashboard:** Data Ingestion → AI Adoption → Model Governance → Team Spend → Product Analysis → Coaching → Report Generator
- **Admin:** [existing] + ROI Settings + Seat Config + Team Members
- **Tools:** Savings Calculator (+ future: Log a Win survey form, what-if tools)

## Verification checklist

| Check | Expected |
|-------|----------|
| Header | No demo pill; sub-title shows "Frank Capital" |
| AI Adoption | No Model Efficiency bar; tier cards show first names; "How is this calculated?" below cards |
| Model Governance | Model Efficiency at top; pie chart legend visible; Opus = navy, Haiku = amber |
| Module 5 | Bars use brand palette, not red/green |
| Admin tab | ROI Settings, Seat Config, Team Members panels all visible |
| Tools tab | Savings Calculator visible |
| Report Generator | Below Coaching; no API key paste input |
| ROI boxes | Commas in A$ values; updated disclaimer; "Log a Win" button |
| Nudges | Specific actionable copy per tier |
| Mobile 375px | No layout overflow |

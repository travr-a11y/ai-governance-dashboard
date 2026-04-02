# UI Redesign Plan — The Frank Group AI Governance Dashboard

## Purpose

Self-contained implementation brief for an execution agent. Read this file, `docs/AGENT_HANDOFF.md`, and `CLAUDE.md` before touching any code. No conversation history needed.

**Repo:** `travr-a11y/ai-governance-dashboard`
**Live URL:** `https://ai-governance-dashboard-production.up.railway.app/`
**Supabase project:** `pwuapjdfrdbgcekrwlpr`

---

## What this plan achieves

Nine targeted UI improvements that reframe the dashboard for executive and client audiences, add ROI context, improve mobile usability, and tighten the spend reporting. None of these changes touch `aggregateData`, `buildBehaviorMaps`, the Supabase persistence layer, or the ingestion pipeline.

1. **Strip "Module X —" prefixes** from all headings and add one-line plain-English sub-headings
2. **ROI / time savings estimates** — three new stat boxes at the top of AI Adoption with role-weighted calculations
3. **Haiku colour update** — true blue replaces the dark-indigo near-match
4. **Max-width container** — constrain the dashboard to 1400 px with centred auto margins
5. **Mobile responsiveness** — CSS media queries + `className` props on key grid containers
6. **Australian date format everywhere** — `en-AU` locale on all `toLocaleString` / `toLocaleDateString` calls
7. **Demo mode indicator** — amber banner at the top of each module (except Data Ingestion) when showing sample data
8. **Fluency scoring legend** — collapsible explainer + tier band strip in AI Adoption module
9. **Subscription + usage spend** — structured cost breakdown card in Module 1, new columns + totals row + spend notice banner in Module 4

---

## Current state (what already exists — do not redo)

- `index.html` is the live app. All code is inline in a single `<script type="text/babel">` block.
- `src/dashboard.jsx` is an ESM mirror kept in sync — not used at runtime.
- The automatic ingestion pipeline (date range picker, `usageRowsData` state, periods table) is live and must not be disturbed.
- `aggregateData` takes a `rows` array derived from `usageRowsData || rawRows || SAMPLE_DATA`. This derivation must stay unchanged.
- `COLOURS`, `USERS_MAP`, `SPEND_LIMITS`, `BILLING_STANDARD_SEATS`, `BILLING_PREMIUM_SEATS` are hardcoded constants near the top of the `<script>` block.
- Module components are React function components that receive all data as props from the `App` component.
- The date range picker row is already rendered in the header area — do not remove or restructure it.

Key code locations in `index.html` (line numbers drift — search by function/constant name):

| Symbol | Purpose |
|--------|---------|
| `COLOURS` | Colour constants object |
| `USERS_MAP` | 8-user object keyed by username |
| `BILLING_STANDARD_SEATS`, `BILLING_PREMIUM_SEATS` | Seat count constants |
| `aggregateData` | Main aggregation function — do not modify |
| `buildBehaviorMaps` | Behaviour signal builder — do not modify |
| `usageRowsToRawRows` | DB → rawRows converter — do not modify |
| `rows` derivation | `usageRowsData ? usageRowsToRawRows(...) : (rawRows \|\| SAMPLE_DATA)` |
| `liveUsersBase` | useMemo that calls `aggregateData(rows, ...)` |
| `dateRangeFrom`, `dateRangeTo` | ISO date strings driving the date range picker |
| `rawRows` | In-browser parsed CSV state |
| `usageRowsData` | DB-sourced rows state (null when not loaded) |

---

## Changes required

### Change 1 — Remove "Module X —" from all headings and add sub-headings

**Where to look:** Search for the heading strings in the module component render returns. They appear as `React.createElement("h2", ...)` or inside a section header JSX block.

**For each module, apply the following heading and sub-heading:**

| Find (exact string) | Replace heading with | Sub-heading text |
|---------------------|---------------------|-----------------|
| `"Module 1 — Data Ingestion"` | `"Data Ingestion"` | `"Upload your team's Claude usage exports to populate the dashboard."` |
| `"Module 2 — AI Adoption (North Star)"` | `"AI Adoption"` | `"How actively the team is using AI tools and how proficient each person has become."` |
| `"Module 3 — Model Governance"` | `"Model Governance"` | `"Which AI models the team is using — and whether they're choosing the right tool for each job."` |
| `"Module 4 — User Spend & Token Breakdown"` | `"Team Spend & Usage"` | `"A full breakdown of what each person has spent, including their seat subscription and any additional usage."` |
| `"Module 5 — Product / Surface Analysis"` | `"Usage by Surface"` | `"Which Claude products the team is using most — Chat, Code, Research, and more."` |
| `"Module 6 — Savings Opportunity Calculator"` | `"Cost Optimisation"` | `"How much the firm could save by using more efficient AI models for routine tasks."` |
| `"Module 7 — AI Committee Initiative Tracker"` | `"Initiative Tracker"` | `"Progress against the AI Committee's key goals for this quarter."` |
| `"Module 8 — Report Generator"` | `"Generate Report"` | `"Create a formatted governance report to share with leadership or the board."` |
| `"Module 9 — Coaching & Fluency Leaderboard"` | `"Coaching & Leaderboard"` | `"A ranked view of AI proficiency across the team, with personalised next steps for each person."` |

**After replacing the heading text**, immediately after the `h2` element add the sub-heading:

```jsx
React.createElement("p", {
  style: { margin: "2px 0 12px", fontSize: 13, color: "#4a4a4a", fontWeight: 400 }
}, subHeadingText)
```

Where `subHeadingText` is the exact string from the table above for that module.

---

### Change 2 — ROI / time savings estimates in AI Adoption

#### 2a — Add `roleType` to USERS_MAP

Find the `USERS_MAP` constant. Add a `roleType` field to each entry (place it alongside the existing fields, order does not matter):

```javascript
// trowley (Travis):  roleType: "advisory"
// alex:              roleType: "finance"
// andrea:            roleType: "advisory"
// rsharma (Reginald): roleType: "advisory"
// tbrcic (Tamara):   roleType: "advisory"
// bagar (Bahar):     roleType: "legal"
// bwoodward (Ben):   roleType: "legal"
// rlyons (Rhys):     roleType: "legal"
```

Example — the `trowley` entry should look like:

```javascript
trowley: { displayName: "Travis", entity: "Frank Advisory", isBenchmark: true, roleType: "advisory", /* ...existing fields */ },
```

Apply the same pattern to all eight entries.

#### 2b — Add ROI_PRESETS constant

Place these constants immediately after the `USERS_MAP` block (before `SPEND_LIMITS` or whichever constant follows):

```javascript
const ROI_PRESETS = {
  legal:    { timeSavingPct: 0.40 },
  finance:  { timeSavingPct: 0.35 },
  advisory: { timeSavingPct: 0.30 },
};
const ROI_DEFAULT_SAVING_PCT = 0.30;
const ROI_MINS_PER_REQUEST   = 20;    // 20 min average per AI-assisted request
const ROI_HOURLY_RATE_AUD    = 200;   // A$200/hr default
```

#### 2c — ROI calculation in App component

Find the `App` component. Locate where `liveUsersBase` / `userData` is computed (the useMemo that calls `aggregateData`). Immediately after `userData` is available, add:

```javascript
const estHoursSaved = userData.reduce((acc, u) => {
  const preset = ROI_PRESETS[USERS_MAP[u.username]?.roleType]
    || { timeSavingPct: ROI_DEFAULT_SAVING_PCT };
  return acc + (u.totalRequests * ROI_MINS_PER_REQUEST * preset.timeSavingPct / 60);
}, 0);
const estValueAUD    = estHoursSaved * ROI_HOURLY_RATE_AUD;
const activeUserCount = userData.filter(u => u.totalRequests > 0).length;
```

Note: `u.username` must resolve to a key in `USERS_MAP`. If `aggregateData` already attaches `username` to each user object, use that. Otherwise, look up the user by `u.email` against `USERS_MAP` values — use whichever field `aggregateData` already produces.

Pass `estHoursSaved`, `estValueAUD`, and `activeUserCount` as props to the Module 2 component.

#### 2d — Three new ROI stat boxes at the top of Module 2

Inside the Module 2 component render, at the very top of the content (before any existing stat boxes), add:

```jsx
React.createElement("div", {
  className: "roi-stats",
  style: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 8
  }
},
  // Box 1
  React.createElement("div", { style: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px" } },
    React.createElement("div", { style: { fontSize: 12, color: "#4a4a4a", marginBottom: 4 } }, "Est. Time Recaptured"),
    React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#1e1645" } },
      `${fmtDec(estHoursSaved, 1)} hrs this period`
    )
  ),
  // Box 2
  React.createElement("div", { style: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px" } },
    React.createElement("div", { style: { fontSize: 12, color: "#4a4a4a", marginBottom: 4 } }, "Est. Value Delivered"),
    React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#1e1645" } },
      fmtAUD(estValueAUD)
    )
  ),
  // Box 3
  React.createElement("div", { style: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px" } },
    React.createElement("div", { style: { fontSize: 12, color: "#4a4a4a", marginBottom: 4 } }, "Avg per Person"),
    React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#1e1645" } },
      `${fmtDec(estHoursSaved / Math.max(1, activeUserCount), 1)} hrs`
    )
  )
)
```

Immediately after the ROI stat boxes grid, add the footnote:

```jsx
React.createElement("p", {
  style: { fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 8, marginBottom: 20 }
},
  "Time estimate: requests × 20 min avg task × role savings benchmark (Legal 40%, Finance 35%, Advisory 30%). " +
  "Sources: McKinsey, Harvard Business School, BCG — conservative lower-bound estimates. " +
  "Hourly rate: A$200. Adjust in Settings."
)
```

`fmtDec` and `fmtAUD` are existing helper functions already present in the codebase — do not redefine them.

---

### Change 3 — Update haiku colour

Find the `COLOURS` constant. Change only the `haiku` value:

```javascript
// Before:
haiku: "#3a4a7c",
// After:
haiku: "#2563eb",   // True blue — clearly distinct from advisory dark indigo
```

No other colour values change. After making this edit, grep the entire file for `COLOURS.haiku` (or the old value `#3a4a7c`) to confirm all usages — pie chart slices, legend items, tier badges — will pick up the new value automatically through the `COLOURS` reference.

---

### Change 4 — Max-width container

Find the outermost dashboard wrapper `div` in the `App` component's JSX return — this is the root element that wraps the header and all module sections. Add or update its `style` to include:

```javascript
style: {
  maxWidth: 1400,
  margin: "0 auto",
  padding: "0 16px",
  // ...retain any existing style properties
}
```

If the wrapper already has a `style` prop, merge these properties in — do not replace the entire style object.

---

### Change 5 — Mobile responsiveness

#### 5a — Add CSS media query block to `<head>`

In `index.html`, locate the `<head>` section. Add the following `<style>` block after any existing `<style>` tags (do not replace them):

```html
<style>
@media (max-width: 768px) {
  .m3-grid { grid-template-columns: 1fr !important; }
  .m2-stats { grid-template-columns: repeat(2, 1fr) !important; }
  .m4-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .date-range-row { flex-direction: column !important; gap: 8px !important; }
  .section-card { padding: 16px !important; }
  .dash-title { font-size: 20px !important; }
  .roi-stats { grid-template-columns: 1fr !important; }
}
@media (max-width: 480px) {
  .m2-stats, .m1-stats { grid-template-columns: 1fr !important; }
}
</style>
```

#### 5b — Add `className` props to targeted elements

Search for each element below and add the specified `className`. When an element already has a `className`, append with a space (e.g., `className="existing-class section-card"`).

| Element | `className` to add |
|---------|-------------------|
| Module 3 outer grid container (the `div` with `gridTemplateColumns` for the user cards) | `m3-grid` |
| Module 2 stat boxes grid (the `div` with `display: "grid"` containing the fluency/stat boxes) | `m2-stats` |
| Module 4 table wrapper div (the `div` that wraps the `<table>`) | `m4-table-wrap` |
| Module 1 stat boxes grid (seat cost summary grid) | `m1-stats` |
| Dashboard title `<h1>` (the "The Frank Group AI Governance Dashboard" heading) | `dash-title` |
| ROI stat boxes grid (added in Change 2d) | `roi-stats` |
| Date range picker row (the flex row containing the period dropdown and date inputs) | `date-range-row` |
| Every section card div (the white or light-background container wrapping each module's content) | `section-card` |

For the "every section card" rule: search for the pattern `borderRadius` near `padding` in module container divs — each module is wrapped in a card div with those style properties. Add `className="section-card"` to each one. There are 9 modules so there should be 9 card divs receiving this class.

---

### Change 6 — Australian date format everywhere

Search the entire `index.html` file for the following patterns and replace as specified. Use exact string matching — do not alter calls that already pass `"en-AU"`.

**Pattern A:**
```javascript
// Find:
.toLocaleString()
// Replace with:
.toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
```

**Pattern B:**
```javascript
// Find:
.toLocaleDateString()
// Replace with:
.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
```

Check each replacement in context — the method call may be on a `new Date(x)` expression or a date variable. Ensure the replacement is syntactically valid in each location. Calls that already include a locale string argument must not be changed.

---

### Change 7 — Demo mode per-module indicator

#### 7a — Compute `isSampleData` in App and pass to modules

In the `App` component, add this derivation alongside the `rows` derivation:

```javascript
const isSampleData = !rawRows && !usageRowsData;
```

Pass `isSampleData` as a prop to module components 2 through 9. Do NOT pass it to Module 1 (Data Ingestion).

#### 7b — Add amber banner inside each module (2–9)

At the very top of each module component's JSX return — inside the section card, before all other content — add:

```jsx
isSampleData && React.createElement("div", {
  style: {
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    color: "#92400e",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 6
  }
}, "\u26a0 Showing sample data — upload a CSV in Data Ingestion to see your team's real data")
```

The `\u26a0` is the warning sign character ⚠. Place this block as the first child of the section card — before the `h2` heading, before any stat boxes. Apply to modules 2, 3, 4, 5, 6, 7, 8, and 9 only.

---

### Change 8 — Fluency scoring legend in AI Adoption

#### 8a — Add `showFluencyLegend` state to Module 2

Inside the Module 2 component (which is a React function component), add local state:

```javascript
const [showFluencyLegend, setShowFluencyLegend] = React.useState(false);
```

#### 8b — Tier band strip (always visible)

Immediately above the user list / fluency cards in Module 2 (below the ROI stat boxes and footnote from Change 2, above the individual user rows), add the tier band strip:

```jsx
React.createElement("div", {
  style: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12 }
},
  [
    { tier: 1, label: "★ Super User",     desc: "≥ 70 pts",  color: "#1e1645" },
    { tier: 2, label: "Active",           desc: "40–69 pts", color: "#88aa00" },
    { tier: 3, label: "Getting Started",  desc: "10–39 pts", color: "#f59e0b" },
    { tier: 4, label: "Not Yet Active",   desc: "< 10 pts",  color: "#9ca3af" },
  ].map(t =>
    React.createElement("span", {
      key: t.tier,
      style: { display: "flex", alignItems: "center", gap: 4 }
    },
      React.createElement("span", {
        style: { width: 10, height: 10, borderRadius: "50%", background: t.color, display: "inline-block" }
      }),
      React.createElement("span", { style: { color: "#1a1a1a" } }, t.label),
      React.createElement("span", { style: { color: "#9ca3af" } }, `(${t.desc})`)
    )
  )
)
```

#### 8c — Collapsible "How is this calculated?" toggle

Immediately below the tier band strip, add the toggle button:

```jsx
React.createElement("button", {
  onClick: () => setShowFluencyLegend(v => !v),
  style: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: "#2563eb",
    cursor: "pointer",
    marginBottom: 12,
    textDecoration: "underline"
  }
}, "\u24d8 How is this score calculated?")
```

#### 8d — Expanded legend panel (shown when `showFluencyLegend` is true)

Immediately after the toggle button, conditionally render:

```jsx
showFluencyLegend && React.createElement("div", {
  style: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "16px 20px",
    marginTop: 0,
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 1.7
  }
},
  React.createElement("p", { style: { fontWeight: 600, marginBottom: 8, margin: "0 0 8px" } },
    "Digital Fluency Score (0\u2013100)"
  ),
  React.createElement("p", { style: { marginBottom: 12, color: "#4a4a4a", margin: "0 0 12px" } },
    "Each person receives a score based on how actively and broadly they\u2019re using AI tools."
  ),
  React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } },
    // Column 1: with behaviour data
    React.createElement("div", null,
      React.createElement("p", { style: { fontWeight: 600, marginBottom: 6, margin: "0 0 6px", fontSize: 12, color: "#1e1645" } },
        "When conversation export is uploaded"
      ),
      React.createElement("ul", { style: { margin: 0, paddingLeft: 16, color: "#4a4a4a" } },
        React.createElement("li", null, "Spend signal \u00d7 0.25"),
        React.createElement("li", null, "Conversation depth \u00d7 0.40"),
        React.createElement("li", null, "Project usage \u00d7 0.20"),
        React.createElement("li", null, "Config / settings \u00d7 0.15")
      )
    ),
    // Column 2: spend-only
    React.createElement("div", null,
      React.createElement("p", { style: { fontWeight: 600, marginBottom: 6, margin: "0 0 6px", fontSize: 12, color: "#1e1645" } },
        "Spend-only (no conversation export)"
      ),
      React.createElement("ul", { style: { margin: 0, paddingLeft: 16, color: "#4a4a4a" } },
        React.createElement("li", null, "Spend signal \u00d7 0.50"),
        React.createElement("li", null, "Surface diversity \u00d7 0.30"),
        React.createElement("li", null, "Recency \u00d7 0.20")
      )
    )
  ),
  React.createElement("p", { style: { marginTop: 12, color: "#4a4a4a", fontSize: 12, margin: "12px 0 0" } },
    "Tier bands: \u2605 Super User \u2265 70 \u2502 Active 40\u201369 \u2502 Getting Started 10\u201339 \u2502 Not Yet Active < 10"
  )
)
```

---

### Change 9 — Subscription + usage spend

#### 9a — Module 1 cost breakdown card

Find the existing "seat cost summary" block in Module 1. Replace it entirely with the following structured cost breakdown card. (If no seat cost summary exists, add this block below the upload zone / above the uploads history list.)

Compute these values in the Module 1 component (or pass as props from App — use whichever pattern the existing seat cost summary uses):

```javascript
const seatSubMonthly = BILLING_STANDARD_SEATS * 25 + BILLING_PREMIUM_SEATS * 125; // 325
const apiSpendUSD    = userData.reduce((s, u) => s + (u.totalSpendUSD || 0), 0);
const apiSpendAUD    = apiSpendUSD * audRate;
const codeSpendAUD   = /* sum of Claude Code spend for all users, already tracked in state */;
const totalPeriod    = seatSubMonthly + apiSpendAUD + (codeSpendAUD || 0);
const annualised     = (seatSubMonthly * 12) + ((apiSpendAUD + (codeSpendAUD || 0)) * 12);
```

Note: `audRate` is the existing AUD/USD rate state variable. `codeSpendAUD` — check whether the existing code tracks Claude Code spend separately; if it does not, omit that line from the rendered card rather than computing it incorrectly.

Render as:

```jsx
React.createElement("div", {
  style: {
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
    padding: "18px 22px", marginBottom: 20, fontSize: 13, lineHeight: 2
  }
},
  React.createElement("div", { style: { fontWeight: 700, marginBottom: 10, fontSize: 14 } }, "Cost Summary"),
  // Seat subscription header row
  React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
    React.createElement("span", null, "Claude.ai Seat Subscription (A$/mo)"),
    React.createElement("span", { style: { fontWeight: 600 } }, `A$${seatSubMonthly}`)
  ),
  // Standard seats sub-row
  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", paddingLeft: 16, color: "#4a4a4a", fontSize: 12 } },
    React.createElement("span", null, `${BILLING_STANDARD_SEATS} Standard seats \u00d7 A$25`),
    React.createElement("span", null, `A$${BILLING_STANDARD_SEATS * 25}`)
  ),
  // Premium seat sub-row
  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", paddingLeft: 16, color: "#4a4a4a", fontSize: 12, marginBottom: 6 } },
    React.createElement("span", null, `${BILLING_PREMIUM_SEATS} Premium seat (Alex) \u00d7 A$125`),
    React.createElement("span", null, `A$${BILLING_PREMIUM_SEATS * 125}`)
  ),
  // API usage row
  React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
    React.createElement("span", null, "API Usage this period"),
    React.createElement("span", { style: { fontWeight: 600 } }, `A$${apiSpendAUD.toFixed(2)}`)
  ),
  // Claude Code row — only render if codeSpendAUD > 0
  codeSpendAUD > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
    React.createElement("span", null, "Claude Code this period"),
    React.createElement("span", { style: { fontWeight: 600 } }, `A$${codeSpendAUD.toFixed(2)}`)
  ),
  // Divider
  React.createElement("hr", { style: { border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" } }),
  // Total
  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontWeight: 700 } },
    React.createElement("span", null, "Total cost this period"),
    React.createElement("span", null, `A$${totalPeriod.toFixed(2)}`)
  ),
  // Annualised
  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", color: "#4a4a4a", fontSize: 12 } },
    React.createElement("span", null, "Annualised run rate"),
    React.createElement("span", null, `\u007eA$${Math.round(annualised).toLocaleString("en-AU")}/yr`)
  )
)
```

#### 9b — Module 4 new columns: "Seat (A$/mo)" and "Period Total"

Find the Module 4 spend table. Add two new columns.

**Compute per-user values:**

```javascript
// Inside the row render loop:
const seatCostMonthly  = u.seatTier === "Premium" ? 125 : 25;
const periodDays       = (dateRangeFrom && dateRangeTo)
  ? Math.round((new Date(dateRangeTo) - new Date(dateRangeFrom)) / 86400000) + 1
  : null;
const seatCostProrated = periodDays
  ? (seatCostMonthly / 30) * periodDays
  : seatCostMonthly;
const seatLabel        = periodDays ? `A$${seatCostProrated.toFixed(2)}` : `~A$${seatCostMonthly}`;
const periodTotal      = seatCostProrated + (u.totalSpendAUD || 0);
```

**Add to table header row:**
```jsx
React.createElement("th", { style: { /* match existing th style */ } }, "Seat (A$/mo)"),
React.createElement("th", { style: { /* match existing th style */ } }, "Period Total"),
```

**Add to each data row:**
```jsx
React.createElement("td", { style: { /* match existing td style */ } }, seatLabel),
React.createElement("td", { style: { /* match existing td style */ } }, `A$${periodTotal.toFixed(2)}`),
```

**Add totals row** at the bottom of the table body (after the last user row):

```jsx
React.createElement("tr", {
  style: { borderTop: "2px solid #e2e8f0", fontWeight: 700, background: "#f8fafc" }
},
  React.createElement("td", null, "Total"),
  React.createElement("td", null, /* sum of all totalSpendAUD formatted */),
  React.createElement("td", null, /* sum of all totalTokens formatted */),
  // ... repeat for every existing numeric column in the same order ...
  React.createElement("td", null, `A$${userData.reduce((s, u) => s + (u.seatTier === "Premium" ? 125 : 25), 0)}`),
  React.createElement("td", null, `A$${userData.reduce((s, u) => s + (u.seatTier === "Premium" ? 125 : 25) / 30 * (periodDays || 30) + (u.totalSpendAUD || 0), 0).toFixed(2)}`)
)
```

Match the totals row column count exactly to the number of columns in the table — count headers first.

#### 9c — Spend notice banner in Module 4

Add this banner above the Module 4 table (below the module heading / sub-heading, above the table itself). Compute `spendUtilisation` from existing fields — `aggregateData` already produces `spendLimitAUD` per user; divide `u.totalSpendAUD` by `u.spendLimitAUD * audRate / 1` if limits are in AUD, or adjust for USD. Check how `aggregateData` exposes the limit.

```jsx
const atRisk = userData.filter(u => u.spendLimitAUD && (u.totalSpendAUD / u.spendLimitAUD) >= 0.75);

atRisk.length > 0 && React.createElement("div", {
  style: {
    background: "#fffbeb",
    border: "1px solid #d97706",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 16,
    fontSize: 13
  }
},
  React.createElement("strong", null, "Spend Notice \u2014 "),
  `${atRisk.length} team member${atRisk.length > 1 ? "s are" : " is"} approaching their monthly limit: `,
  atRisk.map(u => `${u.displayName} (${Math.round((u.totalSpendAUD / u.spendLimitAUD) * 100)}%)`).join(", ")
)
```

Note: verify whether `u.totalSpendAUD` and `u.spendLimitAUD` are the correct field names produced by `aggregateData`. If `aggregateData` uses different names (e.g., `totalSpend` in USD and `spendLimit` in USD), adjust the ratio computation accordingly.

---

## Files to modify

| File | Changes |
|------|---------|
| `index.html` | All 9 changes — this is source of truth |
| `src/dashboard.jsx` | Mirror all changes from `index.html` after completion |
| `docs/AGENT_HANDOFF.md` | Add note: "ROI_PRESETS constant and roleType field added to USERS_MAP — see UI_REDESIGN_PLAN.md Change 2" |

No Supabase migrations required. No Edge Function changes. No package.json changes.

---

## Execution order

Implement changes in this order to minimise merge conflicts and enable incremental testing:

1. Change 4 (max-width container) — single-line style change, lowest risk
2. Change 3 (haiku colour) — single-value constant change
3. Change 6 (AU date format) — mechanical find-and-replace, verify each context
4. Change 5 (mobile CSS + classNames) — additive, no logic changes
5. Change 1 (heading strings + sub-headings) — pure JSX changes per module
6. Change 7 (demo mode banner) — additive prop + conditional render
7. Change 8 (fluency legend) — additive to Module 2 only
8. Change 2 (ROI estimates) — new constants + calculation + three stat boxes
9. Change 9 (spend breakdown) — most complex, involves table column additions

After all changes to `index.html` are complete, mirror everything to `src/dashboard.jsx`.

---

## Verification checklist

Test at `http://localhost:3000` using `npx serve .` from the repo root. No Supabase config is required for these UI checks — sample data is sufficient for most items.

### Headings (Change 1)
- [ ] All 9 module headings no longer contain "Module X —"
- [ ] Each heading is followed by a `<p>` sub-heading in `#4a4a4a`, 13px, matching the exact strings in the table
- [ ] No module heading says "AI Adoption (North Star)" — it must read "AI Adoption"
- [ ] Module 4 heading reads "Team Spend & Usage" (not "User Spend & Token Breakdown")

### ROI estimates (Change 2)
- [ ] Three green stat boxes appear at the top of the AI Adoption section
- [ ] Boxes are labelled "Est. Time Recaptured", "Est. Value Delivered", "Avg per Person"
- [ ] Values are non-zero when sample data or real data is loaded
- [ ] Footnote appears below the three boxes in 11px italic grey
- [ ] `ROI_PRESETS`, `ROI_DEFAULT_SAVING_PCT`, `ROI_MINS_PER_REQUEST`, `ROI_HOURLY_RATE_AUD` are all present in the constants block
- [ ] Each entry in `USERS_MAP` has a `roleType` field

### Haiku colour (Change 3)
- [ ] Search `index.html` for `#3a4a7c` — zero results
- [ ] Search `index.html` for `COLOURS.haiku` — all references now resolve to `#2563eb`
- [ ] In Module 3 pie chart / legend, Haiku appears in a clear blue (visually distinct from the dark indigo `#1e1645`)

### Max-width (Change 4)
- [ ] At a wide viewport (1600px+), the dashboard content is constrained and centred
- [ ] No content is clipped or cut off at 1400px width

### Mobile (Change 5)
- [ ] At 375px viewport width (iPhone SE): all grids stack to single column
- [ ] Module 3 user cards stack vertically
- [ ] Module 2 stat boxes show 2-per-row at 768px and 1-per-row at 480px
- [ ] ROI stat boxes stack at 768px
- [ ] Date range picker row stacks vertically at 768px
- [ ] Module 4 table scrolls horizontally rather than breaking layout
- [ ] Dashboard title font-size reduces at 768px
- [ ] All section cards have `className="section-card"` in the DOM (verify in browser DevTools)

### AU date format (Change 6)
- [ ] All dates throughout the dashboard render in day-month-year order (e.g., "2 Apr 2026" not "4/2/2026")
- [ ] Upload timestamps in Module 1 history use 12-hour or 24-hour time with en-AU locale
- [ ] No `.toLocaleString()` or `.toLocaleDateString()` call is missing the `"en-AU"` locale argument

### Demo mode indicator (Change 7)
- [ ] When no CSV is uploaded and Supabase is not configured: amber "Showing sample data" banner appears in modules 2–9
- [ ] Module 1 (Data Ingestion) does NOT show the banner
- [ ] After uploading a real CSV: banners disappear from all modules
- [ ] Banner text reads exactly: "⚠ Showing sample data — upload a CSV in Data Ingestion to see your team's real data"

### Fluency legend (Change 8)
- [ ] Tier band strip (four coloured dots with labels) appears above the user list in Module 2
- [ ] "ⓘ How is this score calculated?" link is visible and clickable below the tier strip
- [ ] Clicking the link expands the legend panel
- [ ] Legend panel shows two columns: "When conversation export is uploaded" and "Spend-only"
- [ ] Clicking again collapses the panel

### Spend breakdown (Change 9)
- [ ] Module 1 shows the cost breakdown card with seat subscription, API usage, and totals
- [ ] Module 1 cost card shows correct line items: "8 Standard seats × A$25 = A$200" and "1 Premium seat (Alex) × A$125 = A$125"
- [ ] Module 4 table has two new columns: "Seat (A$/mo)" and "Period Total"
- [ ] A totals row appears at the bottom of the Module 4 table in bold with `#f8fafc` background
- [ ] When any user is at ≥75% of their spend limit: amber "Spend Notice" banner appears above the Module 4 table
- [ ] Bahar (limit A$20), Tamara (limit A$10), Rhys (limit A$50), Reginald (limit A$190) are the users who can trigger the banner; Alex, Andrea, Ben, Travis have no limit and never trigger it

---

## Commit message

```
feat: UI redesign — executive framing, ROI estimates, mobile responsive, subscription spend tracking

- Remove "Module X —" prefixes from all 9 module headings; add plain-English sub-headings
- Add ROI stat boxes to AI Adoption: Est. Time Recaptured, Est. Value Delivered, Avg per Person
- Add ROI_PRESETS constant and roleType field to USERS_MAP (legal/finance/advisory)
- Update haiku colour from #3a4a7c to #2563eb (true blue, distinct from dark indigo)
- Constrain dashboard to max-width 1400px, centred with 16px side padding
- Add CSS media queries for 768px and 480px; add className props to all key grid containers
- Normalise all date formatting to en-AU locale
- Add isSampleData amber banner to modules 2–9 when showing sample data
- Add collapsible fluency scoring legend + tier band strip to AI Adoption module
- Add cost breakdown card to Module 1 (seat sub + API usage + totals + annualised run rate)
- Add Seat and Period Total columns to Module 4 table; add totals row; add spend notice banner
- Sync src/dashboard.jsx with index.html
- Update docs/AGENT_HANDOFF.md
```

---

## Key notes for execution agent

1. **Search by function name, not line number** — the file is large and line numbers drift with every edit.
2. **`index.html` is the only source of truth** — make all changes there first, then sync `src/dashboard.jsx`. The JSX mirror in `dashboard.jsx` uses ESM imports and `export default App` at the bottom; add those to any new constants/functions you introduce.
3. **Do not touch** `aggregateData`, `buildBehaviorMaps`, `usageRowsToRawRows`, the Supabase init effects, the ingestion pipeline, or the date range picker logic.
4. **`fmtAUD` and `fmtDec`** are already defined in the codebase — search for them and use the existing functions. Do not redefine them.
5. **`BILLING_STANDARD_SEATS` and `BILLING_PREMIUM_SEATS`** are already defined — use them directly in the cost card arithmetic.
6. **The haiku colour change** affects every reference to `COLOURS.haiku` — confirm by grepping. The change to the `COLOURS` constant is the only edit needed; all references pick it up automatically.
7. **Module 2 local state** (`showFluencyLegend`) lives inside the Module 2 component function, not in App. Do not lift it to App state.
8. **Module 4 spend notice** — `spendLimitAUD` may be null for unlimited users (Travis, Alex, Andrea, Ben). The `atRisk` filter must check `u.spendLimitAUD &&` before computing the ratio to avoid division errors.
9. **Test at 375px viewport width** — use browser DevTools device emulation. All `.m3-grid`, `.roi-stats`, `.m2-stats`, `.m1-stats` grids must collapse to a single column. The `.m4-table-wrap` must show a horizontal scrollbar rather than overflowing.
10. **Claude Code spend** in Change 9a — if the existing code does not already track a separate `codeSpendAUD` value, set `codeSpendAUD = 0` and omit the Claude Code row from the rendered card rather than computing it incorrectly.
11. **After all changes**: update `docs/AGENT_HANDOFF.md` to note that `ROI_PRESETS` and `roleType` in `USERS_MAP` were added as part of the UI redesign, and reference this plan file.

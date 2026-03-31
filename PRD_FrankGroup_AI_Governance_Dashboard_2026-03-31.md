# PRD: Frank Group AI Governance Dashboard — Phase 1
**Date:** 2026-03-31
**Status:** Draft — Ready for build
**Author context:** Developed across a multi-session planning conversation with Trav (Frank Advisory). Full conversation history, actual CSV data, and all JSON exports were analysed before writing this PRD. All data shapes, column names, and calculations are grounded in real exports.

---

## Problem Statement

Frank Group (Frank Advisory + Frank Law) operates an 8-seat Claude.ai Team plan with no programmatic governance layer. Usage data exists in the admin panel and a manual CSV export but there is no dashboard that surfaces adoption rates, model efficiency, per-user token consumption, or spend against limits. The team is in the first month of org-wide AI adoption, 3 of 8 seats are inactive, 93% of spend is on Opus (the most expensive model), and there is no reporting cadence to the CEO or AI Committee. This dashboard solves the visibility and reporting gap for Phase 1.

---

## What We're Building

A single-file React artifact (`.jsx`) that accepts a manually uploaded Claude.ai Team spend CSV and optionally a second CSV from the Anthropic Console API account. It processes both client-side (no backend), renders a full governance dashboard across 8 modules, and generates a copyable weekly/fortnightly report formatted for distribution to the CEO. It is designed to be opened inside Claude (Cowork) each week when the CSV is exported, with zero infrastructure required for Phase 1.

---

## Users and Actors

- **Trav (operator):** Exports the CSV weekly, uploads it, reviews the dashboard, and triggers report generation before sending to James.
- **James (CEO/MD):** Receives the generated report by email or direct share. Does not interact with the dashboard directly.
- **AI Committee:** Tracks initiative progress visible in Module 8. Trav updates initiatives via an inline editable config within the dashboard.
- **Team members (8 total):** Appear as data subjects in the dashboard. Do not use the dashboard themselves.

---

## Functional Requirements

### Core (must have at launch)

**Module 1 — Data Ingestion**
- [ ] Drag-and-drop / click-to-upload zone for the Claude.ai Team spend CSV
- [ ] Auto-detect and display date range from CSV filename and/or data content
- [ ] Optional second upload zone for Anthropic Console API CSV (same schema or similar — render separately if schema differs)
- [ ] Configurable AUD/USD exchange rate input (default: 1.55)
- [ ] Configurable Opus-to-Sonnet cost ratio for savings calculator (default: 5x)
- [ ] On load, show a placeholder/demo state using embedded sample data so the dashboard is never blank
- [ ] Clear data button to reset state

**Module 2 — North Star: AI Adoption**
- [ ] Primary headline metric: **Org Adoption Rate** — active users (users with any spend/tokens in the period) ÷ total seats (configurable, default 8), shown as a large percentage with an out-of count (e.g. "5 / 8 seats active")
- [ ] Entity split: separate adoption count for Frank Advisory (frankadvisory.com.au) vs Frank Law (franklaw.com.au)
- [ ] **Digital Fluency Score** per user — composite of three signals:
  - Token volume score: user's total tokens ÷ org average (normalised 0–100)
  - Surface diversity score: count of distinct products used (Chat=1, Cowork=2, Sheet Agent=3, Research=4, Claude Code=5) × 20, capped at 100
  - Recency: calculated from last_active if available (for Phase 1, treat any user with data as recently active)
  - Overall score = (token_volume_score × 0.5) + (surface_diversity × 0.3) + (recency × 0.2), displayed as 0–100
- [ ] Fluency tier badge auto-assigned:
  - Tier 1 Super User: score ≥ 70
  - Tier 2 Active: score 40–69
  - Tier 3 Getting Started: score 10–39
  - Tier 4 Not Started: score < 10 or no data
- [ ] Visual tier breakdown: horizontal bar or icon grid showing each user's tier
- [ ] Secondary sub-metric: **Model Efficiency Ratio** — % of total spend on non-Opus models, shown beneath the adoption headline as a governance watch metric (not the primary focus)
- [ ] Week-over-week delta cards for both metrics (shows "N/A" if only one CSV period loaded)

**Module 3 — Model Governance**
- [ ] Org-wide model split: donut or stacked bar showing Opus / Sonnet / Haiku as % of total spend
- [ ] Per-user model breakdown table: user, Opus%, Sonnet%, Haiku%, with colour-coded flag:
  - Green: Opus < 50%
  - Amber: Opus 50–80%
  - Red: Opus > 80%
- [ ] Travis Rowley displayed as "Benchmark" with a distinguishing label (he is the internal gold standard at 47% Opus)
- [ ] Embedded **Model Recommendation Library** — a collapsible reference panel showing:

  | Task Type | Recommended Model | Reason |
  |-----------|------------------|--------|
  | Daily Cowork sessions, drafting, emails | Sonnet | Fast, sufficient quality, 1/5 Opus cost |
  | Sheet Agent data processing | Sonnet or Haiku | Repetitive; Opus overkill |
  | Research queries | Sonnet | Most research doesn't need Opus reasoning depth |
  | Complex M&A analysis, LBO logic | Opus | High-stakes, multi-step reasoning |
  | Contract review (complex) | Opus | Nuance and accuracy critical |
  | Claude Code (general) | Sonnet | Code generation is Sonnet-sufficient |
  | Claude Code (complex architecture) | Opus | Deliberate choice only |
  | Chat — quick questions | Haiku or Sonnet | Reserve Opus for deep work |

- [ ] Flag panel: list of users whose Opus% is above 80% with a single recommended action per user

**Module 4 — User Spend and Token Breakdown**
- [ ] Sortable table with columns: Name, Entity, Fluency Tier, Spend (AUD), Spend (USD), Total Tokens, Prompt Tokens, Completion Tokens, Requests, Avg Tokens/Request, Surfaces Used, Opus%
- [ ] All columns sortable ascending/descending on click
- [ ] Spend limit per user: editable inline field (pre-populated with known limits from screenshot: Alex=Unlimited, Andrea=Unlimited, Bahar=A$20, Ben=Unlimited, Rhys=A$50, Reginald=A$190, Tamara=A$10, Travis=Unlimited). Show utilisation % and flag amber >75%, red >90%
- [ ] Expandable row per user showing:
  - Spend breakdown by product (Cowork, Chat, Sheet Agent, Research, Claude Code)
  - Spend breakdown by model (Opus, Sonnet, Haiku)
  - Mini bar chart of spend by product
- [ ] "Super User" badge on Tier 1 users with tooltip: "Candidate internal AI trainer"
- [ ] Users with zero spend shown at bottom with "Not active this period" label
- [ ] Avg tokens/request stat is especially important — display prominently in expanded row (catches heavy context-loaders like Reginald at 1.4M avg)

**Module 5 — Product / Surface Analysis**
- [ ] Org-wide horizontal bar chart: spend by product surface (Cowork, Chat, Sheet Agent, Research, Claude Code)
- [ ] Each bar coloured by dominant model used on that surface
- [ ] Per-surface Opus% shown as a secondary label on each bar
- [ ] Insight callout: surfaces where Sonnet migration has highest leverage (calculated: surfaces where Opus% > 80% AND spend > $20 USD)

**Module 6 — Savings Opportunity Calculator**
- [ ] Slider: "% of Opus usage migrated to Sonnet" (0–100%, default 50%)
- [ ] Real-time calculation:
  - Current Opus spend (USD and AUD)
  - Projected spend after migration
  - Projected saving (USD and AUD)
  - Show working: `saving = opus_spend × migration_pct × (1 - 1/opus_sonnet_ratio)`
- [ ] Preset buttons: "Conservative (30%)", "Target (60%)", "Aggressive (90%)"
- [ ] Annualised projection (multiply period saving by 12 ÷ months_in_period)
- [ ] "At current run rate" note showing annualised total spend for context

**Module 7 — Report Generator**
- [ ] "Generate Report" button produces a formatted governance report as copyable text
- [ ] Report template structure (see full format in Key Flows section)
- [ ] Report is populated entirely from calculated dashboard values — no manual input required except AI Committee initiative statuses (from Module 8)
- [ ] "Copy to clipboard" button
- [ ] "Download as .txt" button
- [ ] Report is designed for email to James — no editing required before sending

**Module 8 — AI Committee Initiative Tracker**
- [ ] Inline editable list of AI Committee initiatives (stored in component state, persists until page reload)
- [ ] Each initiative has: Name, Owner, Target Metric (dropdown selecting from available calculated metrics), Target Value (number), Current Value (auto-calculated from data), Status (auto: green/amber/red based on progress %, overridable)
- [ ] Metric options in dropdown: active_users_count, org_adoption_pct, frank_law_adoption_pct, org_opus_pct, total_tokens, avg_fluency_score
- [ ] Add / remove / edit initiatives via the UI
- [ ] Pre-populated with placeholder initiatives (see Assumptions)
- [ ] Initiative status appears in Module 7 report output
- [ ] "Export initiatives as JSON" button for future Railway config import

### Phase 2 (after core works — Railway version)
- [ ] Persistent CSV upload history (PostgreSQL)
- [ ] Anthropic Console API auto-fetch via stored API key
- [ ] Weekly/fortnightly report auto-generation and email via Microsoft 365 SMTP
- [ ] Auth via email domain restriction
- [ ] GitHub → Railway auto-deploy
- [ ] Historical trend charts (WoW, MoM)

### Out of scope (Phase 1)
- No backend, no database, no authentication
- No API calls of any kind
- No persistent state between browser sessions (CSV must be re-uploaded each time)
- No PDF export (copyable text only)
- No mobile layout optimisation
- No conversations.json or projects.json processing (spend CSV is sole data source)

---

## Technical Spec

**Stack:** React 18 with hooks, single `.jsx` file, Tailwind CSS (core utilities only — no compiler), Recharts for all charts, PapaParse for CSV parsing

**Key integrations:** None in Phase 1. PapaParse is available at `https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js` and must be imported via CDN script tag equivalent. In the artifact, import from the available libraries list.

**Auth:** None (Phase 1)

**Data model:**

```
SpendRow {
  user_email: string
  account_uuid: string
  product: "Chat" | "Cowork" | "Sheet Agent" | "Research" | "Claude Code"
  model: "claude_opus_4_6" | "claude_sonnet_4_6" | "claude_haiku_4_5_20251001" | ...
  total_requests: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_net_spend_usd: number
  total_gross_spend_usd: number
}

UserAggregate {
  email: string
  name: string              // resolved from USERS_MAP constant
  entity: "Frank Advisory" | "Frank Law"
  totalSpendUSD: number
  totalSpendAUD: number     // totalSpendUSD × audRate
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalRequests: number
  avgTokensPerRequest: number
  modelBreakdown: { [model]: { spend, tokens, requests } }
  productBreakdown: { [product]: { spend, tokens, requests } }
  opusPct: number           // % of spend on any Opus model
  surfaceCount: number      // distinct products used
  fluencyScore: number      // computed composite 0–100
  fluencyTier: 1 | 2 | 3 | 4
  spendLimit: number | null // "Unlimited" = null
  spendUtilisation: number | null
}

Initiative {
  id: string
  name: string
  owner: string
  targetMetric: string      // key into calculatedMetrics object
  targetValue: number
  currentValue: number      // auto-calculated
  status: "green" | "amber" | "red"
  statusOverride: boolean
}
```

**Constants to hardcode:**

```js
// User display names (email → display name mapping)
const USERS_MAP = {
  "trowley@frankadvisory.com.au": { name: "Travis Rowley", entity: "Frank Advisory", isBenchmark: true },
  "Alex@frankadvisory.com.au":    { name: "Alex", entity: "Frank Advisory" },
  "andrea@frankadvisory.com.au":  { name: "Andrea", entity: "Frank Advisory" },
  "rsharma@frankadvisory.com.au": { name: "Reginald", entity: "Frank Advisory" },
  "tbrcic@franklaw.com.au":       { name: "Tamara", entity: "Frank Law" },
  "bagar@franklaw.com.au":        { name: "Bahar", entity: "Frank Law" },
  "bwoodward@franklaw.com.au":    { name: "Ben", entity: "Frank Law" },
  "rlyons@franklaw.com.au":       { name: "Rhys", entity: "Frank Law" },
};

// Spend limits (AUD) — null = Unlimited
const SPEND_LIMITS = {
  "Alex@frankadvisory.com.au":    null,
  "andrea@frankadvisory.com.au":  null,
  "bagar@franklaw.com.au":        20,
  "bwoodward@franklaw.com.au":    null,
  "rlyons@franklaw.com.au":       50,
  "rsharma@frankadvisory.com.au": 190,
  "tbrcic@franklaw.com.au":       10,
  "trowley@frankadvisory.com.au": null,
};

// Model classification
const MODEL_CLASS = {
  "claude_opus_4_6":              "Opus",
  "claude_opus_4_5_20251101":     "Opus",
  "claude_sonnet_4_6":            "Sonnet",
  "claude_sonnet_4_5_20250929":   "Sonnet",
  "claude_haiku_4_5_20251001":    "Haiku",
};

// Colour scheme
const COLOURS = {
  opus:    "#e74c3c",
  sonnet:  "#2d7d5f",
  haiku:   "#3a86c8",
  advisory:"#1a3a5c",
  law:     "#2d7d5f",
  tier1:   "#1a3a5c",
  tier2:   "#2d7d5f",
  tier3:   "#f59e0b",
  tier4:   "#e5e7eb",
};
```

---

## Key Flows

### Flow 1 — CSV Upload and Parse
1. User drags CSV file onto upload zone or clicks to select
2. Component reads file using FileReader API
3. PapaParse (imported from recharts/available libs — use `import * as Papa from 'papaparse'` if available, otherwise implement a simple CSV parser inline) parses the file with `header: true, dynamicTyping: true`
4. Validate that required columns exist: `user_email`, `model`, `product`, `total_requests`, `total_prompt_tokens`, `total_completion_tokens`, `total_net_spend_usd`
5. If validation fails, show an error message with the expected columns listed
6. If valid, run `aggregateData(rows)` to compute all `UserAggregate` objects
7. Set component state with aggregated data and re-render all modules
8. Auto-detect date range from filename: parse `YYYY-MM-DD-to-YYYY-MM-DD` from filename string
9. Show "Data loaded: [period] · [N] rows · [N] users · $X AUD total" confirmation strip

### Flow 2 — Aggregation Logic
1. Group rows by `user_email`
2. For each user, sum tokens, requests, spend across all rows
3. Build model breakdown object (group by MODEL_CLASS mapping)
4. Build product breakdown object
5. Calculate `opusPct` = sum of spend where MODEL_CLASS = "Opus" ÷ total spend × 100
6. Calculate `fluencyScore`:
   - tokenVolumeScore = min(100, (userTotalTokens / orgAvgTokens) × 50) — normalised so avg user = 50
   - surfaceDiversityScore = min(100, surfaceCount × 20)
   - recencyScore = 100 if user has any data (Phase 1 simplification)
   - fluencyScore = tokenVolumeScore × 0.5 + surfaceDiversityScore × 0.3 + recencyScore × 0.2
7. Assign fluency tier based on thresholds above
8. Merge USERS_MAP to get display name and entity
9. Add SPEND_LIMITS data and calculate utilisation %
10. For users in USERS_MAP but absent from CSV, create a zero-spend UserAggregate (Tier 4)

### Flow 3 — Report Generation
1. User clicks "Generate Report" button
2. Pull current values for all calculated metrics
3. Pull current AI Committee initiative states from Module 8
4. Fill the report template (see format below):

```
FRANK GROUP — AI GOVERNANCE REPORT
Period: [date_range]
Prepared: [today's date]
Distribution: James Frank, AI Committee
─────────────────────────────────────

EXECUTIVE SUMMARY

Adoption: [active_users]/[total_seats] seats active ([adoption_pct]%)
— Frank Advisory: [advisory_active]/[advisory_total] | Frank Law: [law_active]/[law_total]
Total spend: A$[total_aud] ([period_months] months)
Annualised run rate: ~A$[annualised] per year
Model efficiency: [opus_pct]% Opus / [sonnet_pct]% Sonnet / [haiku_pct]% Haiku
Savings opportunity: Switch [slider_pct]% Opus → Sonnet = save ~A$[saving_aud]/period

─────────────────────────────────────
AI COMMITTEE INITIATIVE STATUS

[For each initiative:]
[green/amber/red] [initiative_name] — [owner]
  Target: [target_metric] = [target_value] | Current: [current_value] | [progress_pct]%

─────────────────────────────────────
USER BREAKDOWN (ranked by tokens)

[For each active user:]
[tier_badge] [name] ([entity])
  Spend: A$[spend] | Tokens: [total_tokens] | Requests: [requests] | Avg context: [avg_tokens_per_req]
  Model mix: [opus_pct]% Opus / [sonnet_pct]% Sonnet | Surfaces: [products_list]
  [FLAG if opus_pct > 80%: "⚑ Recommend model review — defaulting to Opus for routine tasks"]
  [FLAG if spend_utilisation > 75%: "⚑ Approaching spend limit ([utilisation]%)"]

[For each inactive user:]
— [name] ([entity]): No activity this period

─────────────────────────────────────
SUPER USERS — INTERNAL AI TRAINERS

These team members are candidates to lead internal AI upskilling:
[List Tier 1 users with their token volume and surface diversity]

─────────────────────────────────────
MODEL GOVERNANCE FLAGS

[List all users with Opus > 80% and their top Opus-consuming product]
Recommended action: Set Sonnet as default in Cowork and Sheet Agent settings.
Reference: Model Selection Guide in the governance dashboard.

─────────────────────────────────────
RECOMMENDED FOCUS — NEXT [PERIOD]

1. [Auto-generated based on lowest-score initiative from Module 8]
2. [Auto-generated: onboarding nudge if Frank Law adoption < 50%]
3. [Auto-generated: model governance if org Opus% > 80%]

─────────────────────────────────────
Generated by Frank Group AI Governance Dashboard
```

### Flow 4 — Initiative Edit
1. User clicks "Add Initiative" or edit icon on existing initiative
2. Inline form appears: name text field, owner text field, target metric dropdown, target value number field
3. On save, initiative added/updated in state
4. Current value auto-updates by looking up the metric key in `calculatedMetrics` object
5. Status auto-calculated: green ≥ 90% of target, amber 50–89%, red < 50% (or inverse for Opus% target where lower is better)
6. User can override status manually via dropdown
7. "Export JSON" button dumps current initiatives array as downloadable `.json`

---

## Error Handling

- **Wrong CSV format:** Display error banner listing the expected columns. Do not crash.
- **Missing users in USERS_MAP:** Display email address as fallback name, assign entity based on email domain (frankadvisory → Advisory, franklaw → Law, unknown → "Unknown Entity").
- **All-zero data:** Show empty state with upload prompt, not a broken chart.
- **PapaParse not available:** Implement a minimal inline CSV parser as fallback (split by newline, split first line for headers, parse remaining lines).
- **NaN / division by zero:** Guard all division operations. Default to 0 or "N/A" on display.
- **Spend limit exceeded (utilisation > 100%):** Show red badge and surface in report.

---

## Assumptions

- Phase 1 is entirely client-side. No API calls, no backend, no authentication.
- PapaParse is available via the `papaparse` import in the artifact environment. If not, a simple inline CSV parser is sufficient for this data shape.
- The spend CSV schema is stable: `user_email, account_uuid, product, model, total_requests, total_prompt_tokens, total_completion_tokens, total_net_spend_usd, total_gross_spend_usd`. If Anthropic changes this, the column validation step will surface it immediately.
- AUD/USD rate defaults to 1.55. This is configurable by the operator.
- Opus costs approximately 5× Sonnet. This is the basis for the savings calculator and is configurable.
- Total seats = 8. Configurable in the UI.
- AI Committee initiatives are placeholder at launch (see below). Trav will edit them to reflect actual committee work.
- The "benchmark" user for model governance is Travis Rowley (`trowley@frankadvisory.com.au`). This is hardcoded but could be made configurable in Phase 2.
- Date range is parsed from the CSV filename pattern `YYYY-MM-DD-to-YYYY-MM-DD`. Fallback: display first and last dates found in data if available, or "Unknown period".

**Placeholder AI Committee initiatives (pre-loaded):**
```json
[
  { "name": "Get all 8 seats active", "owner": "Trav", "targetMetric": "active_users_count", "targetValue": 8 },
  { "name": "Frank Law onboarding", "owner": "Trav", "targetMetric": "frank_law_adoption_pct", "targetValue": 100 },
  { "name": "Sonnet as default model", "owner": "AI Committee", "targetMetric": "org_opus_pct", "targetValue": 50, "lowerIsBetter": true },
  { "name": "Average fluency score", "owner": "AI Committee", "targetMetric": "avg_fluency_score", "targetValue": 60 },
  { "name": "Team token milestone (org AI depth)", "owner": "Trav", "targetMetric": "total_tokens", "targetValue": 1000000000 }
]
```

---

## Open Questions

- [ ] **API Console CSV schema:** The Anthropic Console usage export format has not been confirmed. Module 1's second upload zone should accept a file and attempt to parse it with the same schema. If it differs, a separate parser will be needed. This can be deferred — just show raw row count and total spend from the second file in Phase 1 if the schema doesn't match.
- [ ] **Spend limits per user:** The limits shown in the screenshot (Bahar A$20, Rhys A$50, Reginald A$190, Tamara A$10) are hardcoded in `SPEND_LIMITS`. These should be editable inline in Module 4. Confirm whether Trav wants to edit them in-dashboard or keep them as code constants for now.

---

## Handoff Notes for Claude Code

Build the component top-down: start with the CSV parsing and aggregation logic (`aggregateData` function), verify it produces correct `UserAggregate` objects against the known data (Alex should show ~$302 USD, 316M tokens, Opus 95%), then build each module as a sub-component. The biggest technical risk is PapaParse availability in the artifact environment — write the CSV parser so it can be swapped to an inline implementation without touching the rest of the code. All chart data should be derived from the aggregated user objects, not the raw rows. The report generator is a pure string-template function — build it last. Do not use localStorage or sessionStorage anywhere.

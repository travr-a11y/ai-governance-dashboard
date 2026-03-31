# TASK-03 — Module 2 Adoption / Fluency Stat Alignment

**File to edit:** `index.html` (then sync `src/dashboard.jsx`)
**Estimated lines touched:** ~40 lines (metrics memo, Module2 component, stat boxes)
**Prerequisite:** None (independent)

---

## Context & Root Cause

The current Module 2 display shows three stats that appear to conflict:

| Stat | Value | Source |
|---|---|---|
| Org Adoption | 63% | `active.length / totalSeats` = 5/8 |
| Frank Advisory | 4 / 4 | correct |
| Frank Law | 1 / 4 | only Rhys has usage this period |
| Avg Fluency | 72 | average of the **5 active** users only |

The confusion arises from two presentation issues:

1. **"Avg Fluency Score" is the average of active users only**, not all 8 seats. So 63% of seats
   are active, but those active users score 72 on average. These are consistent figures — they
   just need better labelling to not appear contradictory.

2. **"Frank Law 1 / 4"** is correct (only Rhys has recorded usage), but the label says "seats
   active" which implies the other 3 are broken rather than simply not having used Claude in this
   period. Clearer copy would be "used Claude this period".

3. **Org-wide fluency** is arguably more useful to a manager than active-only fluency, because it
   shows the drag from unengaged seats.

---

## Changes

### 3a — Add `org_fluency_score` (all-seats average) to metrics

In the `metrics` useMemo (~line 1628), add alongside `avg_fluency_score`:

```js
// Active-only avg (existing)
avg_fluency_score: active.length > 0
  ? active.reduce((s, u) => s + u.fluencyScore, 0) / active.length
  : 0,

// All-seats avg (inactive seats score 0)
org_fluency_score: users.length > 0
  ? users.reduce((s, u) => s + u.fluencyScore, 0) / users.length
  : 0,
```

### 3b — Update Module 2 stat boxes

Replace the 4-box grid in `Module2` with this updated layout:

```
┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐
│  Org Adoption   │ Frank Advisory   │  Frank Law       │  Avg Fluency     │
│  63%            │  4 / 4           │  1 / 4           │  72              │
│  5 of 8 seats   │ used this period │ used this period │ active users     │
│  used Claude    │                  │                  │ Org-wide: 45     │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Sub-label changes:**
- "seats active" → "used Claude this period"
- "/ 100" → "active users avg\nOrg-wide: {org_fluency_score}"

Code for the Avg Fluency stat box (replacing the current StatBox call):

```jsx
React.createElement(StatBox, {
  label: "Avg Fluency Score",
  value: fmtDec(metrics.avg_fluency_score, 0),
  sub: `active users avg · org-wide: ${fmtDec(metrics.org_fluency_score, 0)}`,
  colour: COLOURS.accent,
})
```

### 3c — Update Org Adoption stat box sub-label

```jsx
React.createElement(StatBox, {
  label: "Org Adoption",
  value: `${fmtDec(adoptionPct, 0)}%`,
  sub: `${active.length} of ${settings.totalSeats} seats used Claude this period`,
  colour: COLOURS.advisory,
})
```

### 3d — Add a footnote below the fluency tiers

After the Digital Fluency Tiers row, add a small explanatory note:

```jsx
React.createElement("div", {
  style: { fontSize: 11, color: COLOURS.captionText, marginTop: 8 },
},
  "Fluency is scored per active user. Seats with no usage this period are not included in the" +
  " active avg but count in the org-wide score. Frank Law seats with no recorded usage have" +
  " not been excluded — they hold active seats with no spend logged this period."
)
```

### 3e — "Model Efficiency" line: keep as-is

The `6% non-Opus spend (94% Opus)` line is intentionally a flag and does not need changing.

---

## Acceptance criteria

- [ ] Stat box sub-labels read "used Claude this period" not "seats active"
- [ ] Avg Fluency stat box shows both active-user avg and org-wide avg
- [ ] A footnote below the tiers explains inactive seats
- [ ] Numbers remain consistent: 63% adoption + 72 active avg + lower org-wide avg all make sense
- [ ] No change to the fluency tier chart or the model efficiency callout

---

## Files changed
- `index.html` — `metrics` useMemo (~line 1628), `Module2` component (~line 742)
- `src/dashboard.jsx` — sync same sections

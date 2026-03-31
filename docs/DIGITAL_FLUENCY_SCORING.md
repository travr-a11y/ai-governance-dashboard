# Digital Fluency Scoring (AI Adoption)

This document describes how the Frank Group AI Governance Dashboard computes **digital fluency** (the “AI adoption” score shown in Module 2, Module 4, Module 9, and related badges). It mirrors the implementation in `index.html` (`aggregateData`, `buildBehaviorMaps`, and the `compute*Signal` helpers).

**Scope:** Fluency is a **0–100 composite score** per seat (user). It is **not** the same as billing seat tier (Standard / Premium) or Opus spend percentage. It is also separate from **Module 9 coaching copy** and **category spotlight** (those use rules and conversation titles; see “Related UI” below).

---

## Fluency tiers (labels)

After the numeric score is computed, a **tier** is assigned from thresholds only:

| Tier ID | Score range | Label shown in UI |
|--------:|-------------|-------------------|
| 1 | ≥ 70 | Super User (badge shows “★ Super User”) |
| 2 | ≥ 40 and < 70 | Active |
| 3 | ≥ 10 and < 40 | Getting Started |
| 4 | < 10 | Not Started |

Implementation: `fluencyTier` in `aggregateData`; labels via `tierLabel` (tier index 1–4 maps to the names above).

**How to read “progress” between tiers (conceptually):**

- **Not Started → Getting Started:** Any meaningful activity in the spend-based signals (e.g. at least some team usage in the period) or, in multi-signal mode, non-zero behavioural signals once UUID mapping exists.
- **Getting Started → Active:** Stronger relative token volume, more product surfaces, and/or (in multi-signal mode) healthier conversation, project, and config signals.
- **Active → Super User:** Sustained depth across spend and (when enabled) Claude.ai behaviour—high conversation signal, projects, and configuration, on top of solid usage.

Exact numbers depend on org averages and export coverage; the dashboard does not expose per-tier “checklists” in code beyond the formulas below.

---

## Two scoring modes

### When multi-signal mode is ON

**Condition:** At least one row exists in the parsed **conversations** export (`convItems.length > 0`). That sets `hasBehaviorData === true` for the whole org for that session.

**Important:** Once conversations are loaded, **every** user’s score uses the multi-signal blend. Users with **no** mapped conversations still get `convSignal = 0` (and often low `proj` / `config` if unmapped), so their fluency can drop relative to spend-only mode until their Claude.ai UUID appears in `users.json` or the hardcoded UUID map.

**Formula:**

`fluencyScore = spendSignal × 0.25 + convSignal × 0.40 + projSignal × 0.20 + configSignal × 0.15`

Module 2 surfaces this as: conversations 40%, spend 25%, projects 20%, config 15%.

### When multi-signal mode is OFF (spend-only estimate)

**Condition:** No `conversations.json` (or equivalent) loaded, so `hasBehaviorData === false`.

**Formula:**

`fluencyScore = spendSignal`

There is **no** separate conversation/project/config term; Module 2 explains that uploading `conversations.json` enables the full behavioural score.

---

## Spend signal (`spendSignal`)

Used in **both** modes. Built from Anthropic team CSV aggregates per user, compared to the org.

**Sub-components (each capped at 0–100 before weighting):**

1. **Token volume**  
   `tokenVolumeScore = min(100, (totalTokens / orgAvgTokens) × 50)`  
   - `totalTokens` = prompt + completion tokens for that user in the CSV period.  
   - `orgAvgTokens` = mean `totalTokens` over users with `totalRequests > 0`. If there are no such users, the code uses `1` to avoid division by zero.

2. **Surface diversity**  
   `surfaceDiversityScore = min(100, surfaceCount × 20)`  
   - `surfaceCount` = number of distinct `product` values in that user’s rows.

3. **Recency / activity**  
   `recencyScore = totalRequests > 0 ? 100 : 0`  
   - Binary: any requests in the period → 100; none → 0.

**Blend:**

`spendSignal = tokenVolumeScore × 0.5 + surfaceDiversityScore × 0.3 + recencyScore × 0.2`

---

## Conversation signal (`convSignal`) — multi-signal only

Derived from per-user buckets built from **conversation export metadata only** (titles, message counts, dates). Message bodies are not stored or scored.

If the user has **no** mapped conversations (`conv.count === 0`), `convSignal = 0`.

Otherwise, four sub-scores (0–100) are averaged:

1. **Count:** `min(100, (count / 50) × 100)` — more conversations (up to 50) increase the score.

2. **Depth (average messages per conversation):**  
   From `avgDepth` (mean of per-conversation message counts):  
   - ≥ 10 → 100  
   - ≥ 6 → 75  
   - ≥ 3 → 50  
   - ≥ 2 → 35  
   - else → 20  

3. **Topic breadth:** `min(100, (uniqueTitles / max(min(count, 20), 1)) × 100)`  
   - `uniqueTitles` = distinct conversation names in the export for that user.

4. **Recency (last conversation activity):** Based on latest `updated_at` or `created_at`:  
   - ≤ 7 days → 100  
   - ≤ 14 days → 80  
   - ≤ 30 days → 55  
   - else → 30  
   - If no valid date → base 40  

`convSignal = average(countScore, depthScore, topicScore, recencyScore)`.

---

## Project signal (`projSignal`) — multi-signal only

If the user has **no** projects with `count > 0` in the mapped export data, `projSignal = 0`.

Otherwise start at **40**, then add:

- **+30** if at least one project has a non-empty custom prompt template.  
- **+20** if total attached docs across projects ≥ 3; **+10** if ≥ 1.  
- **+10** if any project is private.

Then `projSignal = min(100, s)`.

---

## Config signal (`configSignal`) — multi-signal only

Combines **memories** export and **users** export metadata (for that email):

- Start at 0.  
- **+60** if `memoryLen > 0` (from memories export for that account).  
- **+20** if `memoryLen > 2000`.  
- **+20** if `phoneVerified` is true (from `users.json`-style metadata).  

`configSignal = min(100, s)`.

---

## Org-level metric: average fluency

**`avg_fluency_score`** (used in initiatives and Module 9 milestones) is the **mean of `fluencyScore` over users with `totalRequests > 0`** only. Inactive seats (zero requests in the CSV period) are excluded from that average.

---

## Related UI (not part of the numeric score)

- **Module 9 coaching cards** use rule-based text from behaviour + spend + Opus mix; they do not recompute `fluencyScore`.  
- **Category spotlight** uses `COACHING_KEYWORDS` regexes against **conversation titles only**.  
- **Claude Code team CSV** affects Module 4 display; it does **not** change `fluencyScore` or `fluencyTier` in `aggregateData`.

---

## Implementation map (maintenance)

| Concept | Location in `index.html` |
|--------|---------------------------|
| `computeConversationSignal` | `computeConversationSignal` |
| `computeProjectSignal` | `computeProjectSignal` |
| `computeConfigSignal` | `computeConfigSignal` |
| Behaviour buckets + `hasBehaviorData` | `buildBehaviorMaps` |
| `spendSignal`, fluency blend, `fluencyTier` | `aggregateData` |
| Tier labels | `tierLabel` |

When formulas change, update this document in the same change as `index.html` (and sync `src/dashboard.jsx` if you maintain it from the inline script).

---

*Last aligned with dashboard source: 2026-03-31.*

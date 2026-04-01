# Scaffold System Fixes — Execution Brief

## Purpose

This brief patches three specific gaps in the dashboard scaffold system so it is
fully self-contained and executable by a fresh agent with zero prior context.

**Files to modify:**
1. `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/anthropic-skills/skills/dashboard-scaffold/SKILL.md`
2. `/Users/trav/Desktop/ai_projects/ai_governance_dashboard/docs/DASHBOARD_SCAFFOLD_RUNBOOK.md`

**Do NOT modify** any dashboard code, Supabase schema, or Edge Function files.

---

## Gap 1 — SKILL.md Step 4: Wrong migration file reference

**Problem:** Step 4 currently says "Each migration is in `docs/migrations.sql`" — that file does not exist. The correct sources are two separate files with a specific run order.

**Fix:** Replace the Step 4 migration block entirely. Find this text in `SKILL.md`:

```
Each migration is in `docs/migrations.sql`. Run them sequentially.
```

Replace the entire Step 4 migration execution order section with:

```markdown
**Migration execution order (run in this exact sequence):**

### Block A — Base schema (run first, always)
Source: `docs/supabase-phase2.sql` from the reference repo
(`git clone https://github.com/travr-a11y/ai-governance-dashboard.git`)

Contains: periods, period_users, uploads (+ Storage bucket), document_chunks,
app_settings — all with RLS policies for both `anon` and `authenticated` roles.

Run the full file as a single SQL execution.

### Block B — Hardening migrations (run in order after Block A)
Source: `docs/schema-hardening-migrations.sql` from the reference repo

Run each of the following migration blocks in sequence:
1. `fix_constraints_and_indexes` — UNIQUE constraints, NOT NULL, composite indexes
2. `add_analytics_rows_table` — **USE THE CUSTOMISED VERSION from Step 2b** (not the Frank Group version)
3. `add_period_breakdown_tables` — period_model_breakdown + period_product_breakdown
4. `add_seats_table` — **USE THE CUSTOMISED SEED from Step 2a** (replace Frank Group emails)
5. `data_quality_fixes` — CHECK constraints, column type corrections, triggers
6. `add_initiatives_table` — initiatives with 5 starter rows (update text for this org)
7. `add_periods_unique_and_is_auto` — UNIQUE(date_from,date_to) + is_auto column
8. `add_usage_rows_composite_indexes` — composite indexes for date-range queries

Each migration block in the file is separated by a `-- Migration:` comment header.
```

---

## Gap 2 — SKILL.md Step 2c: No concrete Edge Function diff example

**Problem:** Step 2c tells the agent WHAT to change but gives no example of HOW. An agent following this step without context could produce an unusable diff.

**Fix:** Find the Step 2c section in `SKILL.md` (it starts with "### 2c. Edge Function diff") and append the following concrete example immediately after the existing "Key customisation points" list:

```markdown
**Example — changing from Anthropic CSV to a custom HR CSV:**

```typescript
// BEFORE (Frank Group reference — Anthropic admin export):
const required = [
  "user_email", "model", "product", "total_requests",
  "total_prompt_tokens", "total_completion_tokens", "total_net_spend_usd",
];

const insertRows = rows.filter(r => r.user_email && r.model).map(r => ({
  upload_id: uploadId,
  user_email: r.user_email.toLowerCase().trim(),
  model_id: r.model.trim(),
  model_class: classifyModel(r.model),
  product: r.product?.trim() || null,
  requests: parseInt(r.total_requests || "0", 10) || 0,
  prompt_tokens: parseInt(r.total_prompt_tokens || "0", 10) || 0,
  completion_tokens: parseInt(r.total_completion_tokens || "0", 10) || 0,
  net_spend_usd: parseFloat(r.total_net_spend_usd || "0") || 0,
  row_date: rowDate,
}));

// AFTER (example HR dashboard — CSV: employee_id,department,tenure_months,salary_aud,performance_score):
const required = [
  "employee_id", "department", "tenure_months", "salary_aud", "performance_score",
];

const insertRows = rows.filter(r => r.employee_id && r.department).map(r => ({
  upload_id: uploadId,
  user_email: r.employee_id.toLowerCase().trim(),  // employee_id maps to user_email field
  model_id: r.department.trim(),                    // department maps to model_id (category field)
  model_class: r.department.trim(),                 // same
  product: null,
  requests: 1,                                      // each row = 1 record
  prompt_tokens: parseInt(r.tenure_months || "0", 10) || 0,
  completion_tokens: 0,
  net_spend_usd: parseFloat(r.salary_aud || "0") / 1.55 || 0,  // AUD → USD for consistency
  row_date: rowDate,
}));
```

The column mapping is flexible — `user_email` becomes the primary grouping key (person identifier),
`model_class` becomes the category, and `net_spend_usd` becomes the primary numeric metric.
Rename columns in `aggregateData` only if the semantic meaning changes significantly.
```

---

## Gap 3 — SKILL.md: No instruction to access the reference repo in execution steps

**Problem:** The SKILL.md frontmatter mentions `travr-a11y/ai-governance-dashboard` as a reference implementation, but none of the 7 execution steps tell the agent to actually clone or access it. Steps 2b, 2c, 2e, and 4 all implicitly require it.

**Fix:** Find the start of Step 2 in `SKILL.md` (it begins with `## Step 2` or `### Step 2`). Insert the following block immediately before Step 2's content (after the Step 2 heading line):

```markdown
> **Before generating any artifacts in Steps 2–6, clone the reference implementation:**
> ```bash
> git clone https://github.com/travr-a11y/ai-governance-dashboard.git _reference
> ```
> You will need:
> - `_reference/supabase/functions/ingest-process/index.ts` — Edge Function template (Step 2c)
> - `_reference/docs/supabase-phase2.sql` — Base schema SQL (Step 4, Block A)
> - `_reference/docs/schema-hardening-migrations.sql` — Hardening migrations (Step 4, Block B)
> - `_reference/index.html` — Full `aggregateData`, `usageRowsToRawRows`, and module code (Step 6)
>
> Do not copy Frank Group-specific constants (USERS_MAP, SPEND_LIMITS, ADMIN_PIN, SAMPLE_DATA).
> These are generated fresh from the brief in Steps 2a and 2d.
```

---

## Gap 4 — RUNBOOK.md M0 section: External file reference, not self-contained

**Problem:** The M0 section says "Copy from `docs/supabase-phase2.sql` in the reference repo" but doesn't embed the SQL. If the reference repo is unavailable, the runbook hits a dead end at the first migration.

**Fix:** Find the M0 section in `DASHBOARD_SCAFFOLD_RUNBOOK.md`. It will contain a line similar to:
```
> Copy from `docs/supabase-phase2.sql` in the reference repo. Contains all five foundational tables...
```

Replace that line (and any instruction to copy from an external file) with:

```markdown
> The full SQL is embedded below. Run the entire block as a single execution in the Supabase SQL Editor.
> This is idempotent — safe to re-run on an existing project.
```

Then immediately after, insert the full contents of `docs/supabase-phase2.sql` wrapped in a SQL code fence:

```sql
[EMBED FULL CONTENTS OF docs/supabase-phase2.sql HERE — 249 lines]
```

The execution agent should read `docs/supabase-phase2.sql` from this repo (at the path
`/Users/trav/Desktop/ai_projects/ai_governance_dashboard/docs/supabase-phase2.sql`)
and embed its full contents inline in the runbook's M0 section.

---

## After making all fixes

1. Verify `SKILL.md` has no remaining references to `docs/migrations.sql` (non-existent file)
2. Verify Step 2 in `SKILL.md` now starts with the reference repo clone instruction
3. Verify Step 2c in `SKILL.md` has the before/after TypeScript example
4. Verify the M0 section in `DASHBOARD_SCAFFOLD_RUNBOOK.md` now embeds SQL inline
5. Commit:
   ```
   docs: patch scaffold system — self-contained migrations, Edge Function diff example, reference repo step
   ```

## Do NOT change

- Any dashboard code (`index.html`, `src/dashboard.jsx`)
- Any Supabase migration files
- The Edge Function (`supabase/functions/ingest-process/index.ts`)
- `CLAUDE.md`, `AGENT_HANDOFF.md`, or any other docs

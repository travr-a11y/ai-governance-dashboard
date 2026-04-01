# Ingestion Layer Plan — Frank Group AI Governance Dashboard

## Purpose

Self-contained implementation brief for an execution agent. Read this file, `docs/AGENT_HANDOFF.md`, and `CLAUDE.md` before touching any code. No conversation history needed.

**Repo:** `travr-a11y/ai-governance-dashboard`
**Supabase project:** `pwuapjdfrdbgcekrwlpr`
**Live URL:** `https://ai-governance-dashboard-production.up.railway.app/`

---

## What this plan achieves

Replaces the current "upload file → manually save period snapshot" model with a fully automatic ingestion pipeline:

1. **User drops a file** → SHA-256 dedup check → if already uploaded, clear message + stop
2. **New file** → Storage + `uploads` row → Edge Function fires automatically
3. **Edge Function** → parses CSV rows into `usage_rows` → **auto-creates a period** from filename dates → done
4. **Dashboard** → date range picker at top → all modules query `usage_rows` filtered by that range
5. **Custom ranges** → pick any arbitrary start/end date → modules re-calculate instantly

No "Save period snapshot" button. No manual steps. Upload once, explore any date range.

---

## Current state (what already exists — do not redo)

### Supabase (all live, 15 migrations applied)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `uploads` | File manifest, dedup via `content_hash` | file_name, file_type, storage_path, content_hash (UNIQUE partial), period_id FK |
| `periods` | Date ranges (now auto-created on ingest) | label, date_from NOT NULL, date_to NOT NULL, is_auto bool, UNIQUE(date_from,date_to) |
| `usage_rows` | Raw CSV rows — source of truth for all analytics | user_email, model_id, model_class, product, requests, prompt_tokens, completion_tokens, total_tokens (GENERATED), net_spend_usd, row_date, upload_id FK |
| `seats` | 8 users seeded | email PK, display_name, entity, seat_tier, spend_limit_aud, is_benchmark, active |
| `period_users` | Legacy snapshot cache (keep, not primary anymore) | — |
| `period_model_breakdown` | Legacy snapshot cache (keep, not primary anymore) | — |
| `period_product_breakdown` | Legacy snapshot cache (keep, not primary anymore) | — |
| `document_chunks` | RAG embeddings | embedding vector(1536) |
| `app_settings` | Key-value: dashboard_settings, spend_overrides | key PK, value jsonb |
| `initiatives` | Module 7 tracker | 5 rows seeded |

### Edge Function `ingest-process` (v2, ACTIVE)
- Already parses Anthropic CSV → inserts into `usage_rows` (deduped by UNIQUE constraint)
- Already generates OpenRouter embeddings → `document_chunks`
- **Missing:** does NOT yet auto-upsert `periods` from filename dates

### `index.html` — current ingestion flow
- `sha256HexFromUtf8()` — SHA-256 hash function exists (~line 539)
- `persistIngestToSupabase()` — dedup check + Storage upload + uploads row + invoke Edge Function (~line 548)
- Dedup currently works at DB level but **UI does not inform the user clearly** — it just silently calls `onDuplicate()` which shows a toast; user may not understand the file was skipped
- **"Save period snapshot" button exists** in Module 1 — remove it
- Auto-restore on load currently downloads latest file per `file_type` from Storage and re-parses in browser — this stays as a fallback but is no longer the primary data source
- `handleSavePeriod` function exists — remove it and its UI trigger
- `trendFlatRows` state reads from `period_users` — replace with `usage_rows` queries

---

## Changes required

### Part A — Edge Function (`supabase/functions/ingest-process/index.ts`)

After inserting `usage_rows`, add auto-upsert of `periods`:

```typescript
// After ingestUsageRows() completes, auto-register the period
if (row.file_type === "anthropic-csv" && rowDate) {
  await autoRegisterPeriod(sb, row.file_name, rowDate);
}
```

Add `autoRegisterPeriod` function:

```typescript
async function autoRegisterPeriod(
  sb: ReturnType<typeof createClient>,
  fileName: string,
  startDateStr: string,
): Promise<void> {
  // Extract end date from filename: YYYY-MM-DD-to-YYYY-MM-DD
  const endMatch = fileName.match(/\d{4}-\d{2}-\d{2}-to-(\d{4}-\d{2}-\d{2})/);
  if (!endMatch) return;
  const dateFrom = startDateStr;        // e.g. "2026-03-01"
  const dateTo = endMatch[1];           // e.g. "2026-03-31"

  // Auto-generate a human label: "Mar 2026" or "Mar 1–15, 2026"
  const label = buildPeriodLabel(dateFrom, dateTo);

  const { error } = await sb.from("periods").upsert(
    { label, date_from: dateFrom, date_to: dateTo, is_auto: true },
    { onConflict: "date_from,date_to", ignoreDuplicates: false }
  );
  if (error) console.error("autoRegisterPeriod error:", error);
  else console.log(`Period auto-registered: ${label} (${dateFrom} → ${dateTo})`);
}

function buildPeriodLabel(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + "T00:00:00Z");
  const to = new Date(dateTo + "T00:00:00Z");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fromMonth = months[from.getUTCMonth()];
  const toMonth = months[to.getUTCMonth()];
  const fromYear = from.getUTCFullYear();
  const toYear = to.getUTCFullYear();

  if (fromYear === toYear && from.getUTCMonth() === to.getUTCMonth()) {
    // Same month: "Mar 2026" or "Mar 1–15 2026"
    const d1 = from.getUTCDate(), d2 = to.getUTCDate();
    const totalDays = (to.getTime() - from.getTime()) / 86400000 + 1;
    if (totalDays >= 28) return `${fromMonth} ${fromYear}`;
    return `${fromMonth} ${d1}–${d2} ${fromYear}`;
  }
  // Cross-month: "Mar–Apr 2026"
  if (fromYear === toYear) return `${fromMonth}–${toMonth} ${fromYear}`;
  return `${fromMonth} ${fromYear}–${toMonth} ${toYear}`;
}
```

The `autoRegisterPeriod` call should be inside `ingestUsageRows` (at the end, after rows are inserted) OR called from the main handler right after `ingestUsageRows` returns. Either works — the main handler approach is cleaner.

In `ingestUsageRows`, expose `rowDate` and `endDate` as return values so the main handler can pass them to `autoRegisterPeriod`. Or simply call `autoRegisterPeriod` inside `ingestUsageRows` — whichever is cleaner.

**Deploy the updated Edge Function** using `mcp__supabase-frank-dashboard__deploy_edge_function` after editing.

---

### Part B — `index.html` changes

All changes below must also be mirrored in `src/dashboard.jsx` after completion.

#### B1 — Dedup UX: clear user message when duplicate detected

Current: `onDuplicate` fires a generic toast. User doesn't understand the file was skipped.

**Find `persistIngestToSupabase` (~line 548).** Change the `onDuplicate` callback handling so the caller in `processIngestFile` / `runIngestBatch` shows a specific, prominent message:

Replace the generic `onDuplicate` toast with a named banner that appears in Module 1's upload zone. The message must include:
- The filename
- The date it was originally uploaded
- Clear language: "Already in Supabase — skipping upload"

To show the original upload date, the dedup check query already returns the existing row:
```js
const { data: existing } = await supabase
  .from("uploads")
  .select("id, file_name, uploaded_at")   // add uploaded_at here
  .eq("content_hash", content_hash)
  .maybeSingle();
```

Pass `existing.uploaded_at` to `onDuplicate(fileName, existing.uploaded_at)` so the UI can show: **"[filename] was already uploaded on [date]. No action taken."**

In the Module 1 component, add a `duplicateWarnings` state (array of `{fileName, uploadedAt}`) that renders as amber warning cards above the upload zone, dismissible individually. These clear when a new batch is started.

#### B2 — Remove "Save period snapshot" button and `handleSavePeriod`

Search for `handleSavePeriod` in `index.html` and remove:
- The function definition itself
- The button/UI element that calls it in Module 1
- Any prop passing of this handler to child components
- The `savingPeriod` / `periodSaveStatus` state variables if they exist

Do NOT remove the `periods` or `period_users` reads — they are still used for trend data.

#### B3 — Replace period selector with date range picker

Currently the dashboard has a "reporting period" banner that shows dates parsed from the CSV filename. Replace this with an interactive date range picker that drives all modules.

**New state (add to App component):**
```js
const [dateRangeFrom, setDateRangeFrom] = useState(null); // ISO date string "YYYY-MM-DD"
const [dateRangeTo, setDateRangeTo] = useState(null);
const [availablePeriods, setAvailablePeriods] = useState([]);
const [periodsLoading, setPeriodsLoading] = useState(false);
```

**Load available periods from Supabase on startup:**
```js
useEffect(() => {
  if (!supabaseClient) return;
  setPeriodsLoading(true);
  supabaseClient
    .from("periods")
    .select("id, label, date_from, date_to, is_auto")
    .order("date_from", { ascending: false })
    .then(({ data, error }) => {
      if (!error && data?.length) {
        setAvailablePeriods(data);
        // Auto-select the most recent period
        if (!dateRangeFrom) {
          setDateRangeFrom(data[0].date_from);
          setDateRangeTo(data[0].date_to);
        }
      }
      setPeriodsLoading(false);
    });
}, [supabaseClient]);
```

**Date range picker UI (replace the old period banner):**

Add a compact row below the main header containing:
- A dropdown of available periods (from `availablePeriods`) — selecting one sets `dateRangeFrom` / `dateRangeTo`
- Two date inputs (from / to) for custom ranges — changing either updates state immediately
- A label that shows the active range: e.g. **"Mar 2026 · 31 days"**
- A "Clear" button that resets to null (falls back to full dataset or CSV-parsed date range)

Style: use the existing Frank Group colour palette. Compact single-row layout. The dropdown should show period labels; the date inputs appear alongside for custom overrides.

```jsx
// Rough JSX structure (adapt to existing component style):
React.createElement("div", { style: { display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", padding:"10px 0" } },
  // Period preset dropdown
  React.createElement("select", {
    value: selectedPeriodId || "custom",
    onChange: e => {
      const p = availablePeriods.find(p => p.id === e.target.value);
      if (p) { setDateRangeFrom(p.date_from); setDateRangeTo(p.date_to); setSelectedPeriodId(p.id); }
    },
    style: { ... }
  },
    React.createElement("option", { value: "custom" }, "Custom range"),
    ...availablePeriods.map(p =>
      React.createElement("option", { key: p.id, value: p.id }, p.label)
    )
  ),
  // From date
  React.createElement("input", { type:"date", value: dateRangeFrom||"", onChange: e => { setDateRangeFrom(e.target.value); setSelectedPeriodId("custom"); } }),
  React.createElement("span", null, "→"),
  // To date
  React.createElement("input", { type:"date", value: dateRangeTo||"", onChange: e => { setDateRangeTo(e.target.value); setSelectedPeriodId("custom"); } }),
  // Active range label
  dateRangeFrom && dateRangeTo && React.createElement("span", { style:{ color: COLOURS.caption, fontSize:12 } },
    daysBetween(dateRangeFrom, dateRangeTo) + " days"
  )
)
```

Add helper: `function daysBetween(a, b) { return Math.round((new Date(b)-new Date(a))/86400000)+1; }`

#### B4 — Query `usage_rows` for module data when Supabase is configured

This is the **core change**. When `supabaseClient` is available AND `dateRangeFrom` / `dateRangeTo` are set, fetch data from `usage_rows` instead of (or in addition to) the parsed CSV state.

**Add `usageRowsData` state:**
```js
const [usageRowsData, setUsageRowsData] = useState(null); // null = not yet loaded from DB
const [usageRowsLoading, setUsageRowsLoading] = useState(false);
```

**Add fetch effect (runs when date range changes):**
```js
useEffect(() => {
  if (!supabaseClient || !dateRangeFrom || !dateRangeTo) {
    setUsageRowsData(null);
    return;
  }
  let cancelled = false;
  setUsageRowsLoading(true);
  supabaseClient
    .from("usage_rows")
    .select("user_email, model_id, model_class, product, requests, prompt_tokens, completion_tokens, total_tokens, net_spend_usd, row_date, upload_id")
    .gte("row_date", dateRangeFrom)
    .lte("row_date", dateTo)
    .then(({ data, error }) => {
      if (cancelled) return;
      if (!error && data?.length) setUsageRowsData(data);
      else setUsageRowsData(null);
      setUsageRowsLoading(false);
    });
  return () => { cancelled = true; };
}, [supabaseClient, dateRangeFrom, dateRangeTo]);
```

**Feed `usageRowsData` into `aggregateData`:**

`aggregateData` currently takes `rawRows` (array of parsed CSV row objects). The `usage_rows` DB rows have the same fields, just slightly different column names. Add a conversion step:

```js
// Convert usage_rows DB shape → rawRows shape that aggregateData expects
function usageRowsToRawRows(dbRows) {
  return dbRows.map(r => ({
    user_email: r.user_email,
    model: r.model_id,
    product: r.product || "",
    total_requests: r.requests,
    total_prompt_tokens: r.prompt_tokens,
    total_completion_tokens: r.completion_tokens,
    total_net_spend_usd: r.net_spend_usd,
  }));
}
```

Then in the `rows` derivation:
```js
// Prefer DB-sourced rows when available; fall back to parsed CSV; fall back to sample data
const rows = usageRowsData
  ? usageRowsToRawRows(usageRowsData)
  : (rawRows || SAMPLE_DATA);
```

This makes all 9 modules — which all read from `rows` via `aggregateData` — automatically respond to the date range picker without any other changes.

#### B5 — Update the "Reporting period" header banner

The existing header shows dates parsed from the CSV filename. After this change:
- If `dateRangeFrom` and `dateRangeTo` are set: show those dates (e.g. "1 Mar 2026 → 31 Mar 2026 · 31 days")
- If date range comes from a named period in `availablePeriods`: show the period label too
- If no date range selected and `usageRowsData` is null: fall back to CSV filename-parsed dates as before

#### B6 — "Loading" states

When `usageRowsLoading` is true, show a subtle loading indicator in the header area (a small spinner or pulsing text "Loading data…"). Modules should continue to show the previous data or sample data during loading to avoid a flash of empty content.

#### B7 — Auto-select period after upload

After a successful upload and Edge Function completion, re-fetch `availablePeriods` and auto-select the newly registered period. This is the "it just works" moment — user uploads a March CSV, the date range picker automatically switches to March, all modules refresh.

Wire this to the existing `bumpUploadsRefresh` callback pattern. After `onUploadsChanged()` fires, also trigger a periods re-fetch:

```js
const bumpPeriodsRefresh = useCallback(() => {
  // Re-fetch availablePeriods (increment a refresh key)
  setPeriodsRefreshKey(k => k + 1);
}, []);
```

Add `periodsRefreshKey` to the availablePeriods useEffect dependency array.

---

### Part C — Remove legacy period snapshot writes from `handleSavePeriod`

Since periods are now auto-created on ingest, the `handleSavePeriod` function (which writes to `period_users`, `period_model_breakdown`, `period_product_breakdown`) should be removed entirely.

The `period_users` / `period_model_breakdown` / `period_product_breakdown` tables remain in Supabase (they're not dropped) but nothing writes to them anymore. They become dormant — available for future use as pre-computed caches if needed at scale.

---

## File changes summary

| File | Changes |
|------|---------|
| `supabase/functions/ingest-process/index.ts` | Add `autoRegisterPeriod` + `buildPeriodLabel`; call after `ingestUsageRows` |
| `index.html` | B1 dedup UX; B2 remove save period button; B3 date range picker; B4 usageRowsData state + fetch + usageRowsToRawRows; B5 header banner; B6 loading states; B7 auto-select after upload |
| `src/dashboard.jsx` | Mirror all index.html changes |
| `docs/AGENT_HANDOFF.md` | Update "current phase" and data flow sections |
| `CLAUDE.md` | Update module overview and data flow |

---

## Verification

After completing all changes, test in this order:

### 1. Edge Function — period auto-registration
```sql
-- After uploading an Anthropic CSV through the dashboard:
SELECT label, date_from, date_to, is_auto FROM public.periods ORDER BY date_from DESC;
-- Expect: a new row with is_auto=true and dates matching the CSV filename
SELECT COUNT(*) FROM public.usage_rows;
-- Expect: > 0 rows
```

### 2. Dedup UX
- Upload the same CSV file twice
- Expected: second upload shows amber warning banner "Already uploaded on [date]. No action taken."
- Nothing new appears in `uploads` table
- `usage_rows` count unchanged

### 3. Date range picker
- Load dashboard at `localhost:3000` (with `dashboard-config.json` configured)
- Period dropdown should show available periods from DB
- Selecting a period → all modules update
- Custom date inputs → modules update
- All 8 users appear in the spend table for the selected range

### 4. Different date ranges give different results
- If you have multiple CSVs uploaded covering different months: selecting each period should show different spend/token numbers in Module 4

### 5. Auto-select after upload
- Upload a new CSV
- Period dropdown should automatically switch to the newly uploaded period
- Modules should show data for that period without any manual steps

### 6. Fallback behaviour (no Supabase)
- Open `index.html` directly (no dashboard-config.json, no Supabase)
- Dashboard should still work with sample data
- CSV upload → file parses in browser → modules populate → no errors in console

---

## Commit message

```
feat: automatic ingestion pipeline — dedup UX, auto-periods, date range picker

- Edge Function: auto-upsert periods table from CSV filename dates on ingest
- Dedup UX: clear amber warning banner when duplicate file detected (shows
  original upload date), replaces silent toast
- Remove "Save period snapshot" button and handleSavePeriod — periods now
  created automatically on CSV upload
- Add date range picker to dashboard header: period preset dropdown + custom
  date inputs; drives all 9 modules
- Add usageRowsData state: queries usage_rows filtered by date range when
  Supabase configured; falls back to parsed CSV or sample data
- Add usageRowsToRawRows converter so existing aggregateData() works unchanged
- Modules auto-refresh when date range changes; auto-select new period after upload
- Sync src/dashboard.jsx with index.html
- Update AGENT_HANDOFF.md and CLAUDE.md
```

---

## Notes for execution agent

- **Do not change `aggregateData`, `buildBehaviorMaps`, or any module component internals** — the date range filtering happens at the data source level (`rows` derivation), so all modules pick it up automatically.
- **Keep the auto-restore from Storage** — this is the fallback when Supabase is not configured or `usageRowsData` is null. Don't remove it.
- **Keep `period_users` reads for trendFlatRows** — the trend chart code still reads from `period_users`. Leave it. It will show empty charts until period snapshots are written, which is fine — the trend chart is a future feature.
- **Test locally with `npx serve .`** before committing. The date range picker is the most visible UI change; make sure it looks clean and doesn't break the header layout on narrow screens.
- **The `dateTo` variable in B4** is a bug — should be `dateRangeTo`. Watch for that copy-paste error in the useEffect.
- Line numbers in `index.html` drift — search for function names, not line numbers.

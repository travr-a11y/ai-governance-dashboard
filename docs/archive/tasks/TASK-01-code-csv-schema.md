# TASK-01 — Claude Code CSV New Schema + Travis Row Merge

**File to edit:** `index.html` (then sync `src/dashboard.jsx`)
**Estimated lines touched:** ~60 lines (parser + merge logic in Module 4)
**Prerequisite:** None

---

## Context

The Claude Code API token export has a new schema. The old parser (`parseCodeCSV`) expects
`User, Spend this Month (USD), Lines this Month` but the new format is a per-day / per-model
token-level breakdown:

```
usage_date_utc, model_version, api_key, workspace, usage_type, context_window,
usage_input_tokens_no_cache, usage_input_tokens_cache_write_5m,
usage_input_tokens_cache_write_1h, usage_input_tokens_cache_read,
usage_output_tokens, web_search_count, inference_geo, speed
```

The dashboard must:
1. Detect the new format in `sniffCsvKind`
2. Parse ALL rows, filtering to `workspace === "Claude Code"` only
3. Calculate USD spend from token counts using model pricing
4. Merge the resulting spend/tokens into Travis's existing user row in Module 4
   (eliminate the separate "Travis Rowley (Claude Code)" display row)

---

## Step 1 — Add model pricing table

Insert a `CODE_MODEL_PRICING` constant near the top of the `<script>` block (around line 100),
after `MODEL_CLASS`:

```js
const CODE_MODEL_PRICING = {
  // key: lowercase model_version prefix → { in, out, cw, cr } per million tokens (USD)
  "claude-opus-4":    { in: 15.00, out: 75.00, cw: 18.75, cr: 1.50 },
  "claude-sonnet-4":  { in:  3.00, out: 15.00, cw:  3.75, cr: 0.30 },
  "claude-haiku-4":   { in:  0.80, out:  4.00, cw:  1.00, cr: 0.08 },
  "claude-opus-3":    { in: 15.00, out: 75.00, cw: 18.75, cr: 1.50 },
  "claude-sonnet-3":  { in:  3.00, out: 15.00, cw:  3.75, cr: 0.30 },
  "claude-haiku-3":   { in:  0.25, out:  1.25, cw:  0.30, cr: 0.03 },
};

function codeModelPrice(modelVersion) {
  const mv = (modelVersion || "").toLowerCase();
  for (const prefix of Object.keys(CODE_MODEL_PRICING)) {
    if (mv.startsWith(prefix)) return CODE_MODEL_PRICING[prefix];
  }
  // Fallback to Sonnet pricing if unrecognised
  return CODE_MODEL_PRICING["claude-sonnet-4"];
}
```

---

## Step 2 — Update `sniffCsvKind`

Replace the existing `code` branch detection inside `sniffCsvKind` (~line 299):

**Old condition (keep Anthropic check, change Code check):**
```js
const idxUser   = headers.findIndex(h => h === "user" || h.includes("email"));
const idxSpend  = headers.findIndex(h => h.includes("spend"));
const idxLines  = headers.findIndex(h => h.includes("line"));
if (idxUser >= 0 && idxSpend >= 0 && idxLines >= 0) return "code";
```

**New — detect new API export by required columns:**
```js
const newCodeRequired = ["usage_date_utc", "model_version", "workspace", "usage_output_tokens"];
if (newCodeRequired.every(r => headers.includes(r))) return "code-api";

// Legacy format (keep as fallback)
const idxUser  = headers.findIndex(h => h === "user" || h.includes("email"));
const idxSpend = headers.findIndex(h => h.includes("spend"));
const idxLines = headers.findIndex(h => h.includes("line"));
if (idxUser >= 0 && idxSpend >= 0 && idxLines >= 0) return "code";
```

---

## Step 3 — Replace `parseCodeCSV` with `parseCodeApiCSV`

Add this NEW function after the existing `parseCodeCSV` (keep the old one for legacy fallback):

```js
/**
 * Parse the new Claude API token export CSV.
 * Filters to rows where workspace === "Claude Code".
 * Returns { row: { email, spendUsd, totalTokens, modelBreakdown }, errors }
 */
function parseCodeApiCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { row: null, errors: ["File appears empty"] };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const col = name => headers.indexOf(name);

  const iDate      = col("usage_date_utc");
  const iModel     = col("model_version");
  const iApiKey    = col("api_key");
  const iWorkspace = col("workspace");
  const iInNoCache = col("usage_input_tokens_no_cache");
  const iInCW5     = col("usage_input_tokens_cache_write_5m");
  const iInCW1h    = col("usage_input_tokens_cache_write_1h");
  const iInCR      = col("usage_input_tokens_cache_read");
  const iOut       = col("usage_output_tokens");

  if ([iModel, iWorkspace, iOut].some(i => i < 0)) {
    return { row: null, errors: ["Missing required columns: model_version, workspace, usage_output_tokens"] };
  }

  let totalSpendUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const modelBreakdown = {};

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const workspace = (vals[iWorkspace] || "").trim();
    if (workspace !== "Claude Code") continue;   // ← filter

    const model        = (vals[iModel] || "").trim();
    const inNoCache    = parseInt(vals[iInNoCache] || "0", 10) || 0;
    const inCW5        = parseInt(vals[iInCW5]     || "0", 10) || 0;
    const inCW1h       = parseInt(vals[iInCW1h]    || "0", 10) || 0;
    const inCR         = parseInt(vals[iInCR]       || "0", 10) || 0;
    const outTokens    = parseInt(vals[iOut]         || "0", 10) || 0;

    const p = codeModelPrice(model);
    const rowSpend = (
      (inNoCache / 1e6) * p.in  +
      (inCW5     / 1e6) * p.cw  +
      (inCW1h    / 1e6) * p.cw  +
      (inCR      / 1e6) * p.cr  +
      (outTokens / 1e6) * p.out
    );

    totalSpendUsd     += rowSpend;
    totalInputTokens  += inNoCache + inCW5 + inCW1h + inCR;
    totalOutputTokens += outTokens;

    // Group by MODEL_CLASS tier
    const tier = MODEL_CLASS[model] || (model.toLowerCase().includes("opus") ? "Opus"
                                     : model.toLowerCase().includes("haiku") ? "Haiku" : "Sonnet");
    if (!modelBreakdown[tier]) modelBreakdown[tier] = { tokens: 0, spend: 0 };
    modelBreakdown[tier].tokens += inNoCache + inCW5 + inCW1h + inCR + outTokens;
    modelBreakdown[tier].spend  += rowSpend;
  }

  return {
    row: {
      email: "trowley@frankadvisory.com.au",  // Always Travis for Claude Code
      spendUsd: totalSpendUsd,
      totalTokens: totalInputTokens + totalOutputTokens,
      modelBreakdown,
    },
    errors: [],
  };
}
```

---

## Step 4 — Wire up the new kind in the upload handler

Find the ingestion branch for `kind === "code"` (~line 601) and add a peer branch:

```js
} else if (kind === "code-api") {
  const { row, errors } = parseCodeApiCSV(text);
  if (errors.length) errs.push(errors[0]);
  else if (!row) errs.push(`${file.name}: could not parse Claude Code API CSV`);
  else onCodeRow(row, file.name);
}
```

---

## Step 5 — Update `onCodeRow` / App state + Module 4 merge

**Current behaviour:** Claude Code is stored as `codeRow` state, displayed as a separate row in
Module 4 under "Travis Rowley (Claude Code)".

**Target behaviour:** Merge the Claude Code spend/tokens INTO Travis's aggregated user row and show
a compact sub-line "incl. A$X Claude Code" rather than a standalone row.

### 5a — Extend `aggregateData` signature to accept `codeRow`

Change:
```js
function aggregateData(rows, audRate, behavior) {
```
To:
```js
function aggregateData(rows, audRate, behavior, codeRow) {
```

At the end of the function, before `.sort(...)`, after building `allUsers`, merge codeRow into
Travis:

```js
if (codeRow && codeRow.email) {
  const travisKey = Object.keys(USERS_MAP).find(
    k => k.toLowerCase() === codeRow.email.toLowerCase()
  );
  const travisUser = allUsers.find(u => u.email?.toLowerCase() === travisKey?.toLowerCase());
  if (travisUser) {
    travisUser.totalSpendUSD   += codeRow.spendUsd || 0;
    travisUser.totalSpendAUD    = travisUser.totalSpendUSD * audRate;
    travisUser.totalTokens     += codeRow.totalTokens || 0;
    travisUser.codeSpendUSD     = codeRow.spendUsd || 0;   // store separately for sub-row display
    travisUser.codeTokens       = codeRow.totalTokens || 0;
    // Merge modelBreakdown
    Object.entries(codeRow.modelBreakdown || {}).forEach(([tier, v]) => {
      if (!travisUser.modelBreakdown[tier]) travisUser.modelBreakdown[tier] = { tokens: 0, spend: 0 };
      travisUser.modelBreakdown[tier].tokens += v.tokens;
      travisUser.modelBreakdown[tier].spend  += v.spend;
    });
  }
}
```

### 5b — Pass `codeRow` to `aggregateData` at the call site (~line 1617)

```js
const agg = aggregateData(rows, settings.audRate, behavior, codeRow);
```

### 5c — Module 4 table row: replace the separate Code row with an inline callout

Find the existing special-case rendering that shows "Travis Rowley (Claude Code)" as a separate
`<tr>` and replace it with a small sub-line inside Travis's normal row:

In the expanded breakdown section of Travis's row, add:
```jsx
{u.codeSpendUSD > 0 && (
  <div style={{ fontSize: 11, color: COLOURS.captionText, marginTop: 4 }}>
    Claude Code (API) — A${fmtDec(u.codeSpendUSD * settings.audRate, 2)} incl. above
    &nbsp;·&nbsp; {fmt(u.codeTokens)} tokens
  </div>
)}
```

Remove the standalone `codeRow && ...` render block that creates the separate Module 4 row.

---

## Step 6 — Update Module 1 manifest label

Change the manifest row label from:
```
Claude Code CSV
```
To:
```
Claude Code (API export)
```

And update the helper text from:
```
Expected columns: User, Spend this Month (USD), Lines this Month
```
To:
```
Expected columns: usage_date_utc, model_version, workspace, usage_output_tokens (+ token columns)
```

---

## Acceptance criteria

- [ ] Upload the new `claude_api_tokens_2026_03.csv` — no error, manifest shows file loaded
- [ ] Travis's Module 4 row shows combined spend (main + Code) in a single row
- [ ] A sub-line "Claude Code (API) — A$X incl. above · Y tokens" appears in Travis's expanded row
- [ ] No separate "Travis Rowley (Claude Code)" row exists
- [ ] Module 2 org totals include the merged tokens
- [ ] Legacy old-format Code CSV still parses (sniffCsvKind returns "code", old parser runs)

---

## Files changed
- `index.html` — lines ~100 (pricing constant), ~278–310 (parsers), ~405–497 (aggregateData), ~601 (upload handler), ~1617 (call site), Module 4 table row
- `src/dashboard.jsx` — sync same sections

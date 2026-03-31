# TASK-04 — Module 8 Native API Key + Report Quality

**File to edit:** `index.html` (then sync `src/dashboard.jsx`)
**Estimated lines touched:** ~200 lines (Module 8 component + report template + system prompt)
**Prerequisite:** Make GitHub repo private BEFORE this task (see security note below)

---

## Security Note — API Key in Source Code

The Anthropic API key will be embedded directly in `index.html`.  
Because `index.html` is committed to GitHub, the repository **must be set to private** before
this task is executed, or the key will be publicly exposed.

Steps to make private:
1. GitHub → `travr-a11y/ai-governance-dashboard` → Settings → Danger Zone → Change visibility → Private
2. Confirm, then proceed with this task.

The Claude Code API key (`claude_code_key_trowley_kcur`) is already present in uploaded CSVs and
is a different credential — no changes needed there.

---

## Changes

### 4a — Update model constant

At ~line 100, change:
```js
const ANTHROPIC_REPORT_MODEL = "claude-sonnet-4-20250514";
```
To:
```js
const ANTHROPIC_REPORT_MODEL = "claude-sonnet-4-6";
```

### 4b — Add hardcoded API key constant

Below the model constant:
```js
// Hardcoded for internal team use. Repo must be private. Do not commit a real key in this doc.
const ANTHROPIC_REPORT_API_KEY = "<paste Anthropic API key when implementing; never commit>";
```

### 4c — Remove API key input from Module 8 UI

In `Module8` component (~line 1394), remove:
- The `anthropicKey` state: `const [anthropicKey, setAnthropicKey] = React.useState("");`
- The `<input type="password" ... placeholder="Anthropic API key...">` element
- The `"Paste your Anthropic API key below (session only — not saved)."` error text
- The "Requires Anthropic browser access header..." helper text

Replace `const key = anthropicKey.trim();` in `generateWithClaude` with:
```js
const key = ANTHROPIC_REPORT_API_KEY;
```

Remove the guard:
```js
if (!key) { setAiError("Paste your Anthropic API key below..."); return; }
```

### 4d — Merge the two generate buttons into one primary button

Remove the separate `"Generate report (template)"` button.
Rename `"Generate with Claude (claude-sonnet-4-6)"` to simply `"Generate Report"`.
This button always calls the Claude API (no template fallback exposed to end users).

Keep a hidden `generate()` (template) function as a private fallback in case the API is down,
but do not surface it in the UI.

**Button order in the toolbar:**
1. **Generate Report** (primary, dark indigo, calls Claude)
2. Download .doc (Word)
3. Print / PDF
4. Download .txt

### 4e — Make report textarea editable

Find the textarea (~line 1455):
```jsx
React.createElement("textarea", { readOnly: true, value: report, ... })
```
Change to:
```jsx
React.createElement("textarea", {
  value: report,
  onChange: e => setReport(e.target.value),
  style: { ... fontFamily: "monospace", ... },
})
```
Add `const [report, setReport] = React.useState("");` if it is currently a derived value rather
than state. (Check whether `report` is already useState — if so, just remove `readOnly`.)

Add a small hint below the textarea:
```jsx
React.createElement("div", {
  style: { fontSize: 11, color: COLOURS.captionText, marginTop: 4 },
}, "You can edit this report before downloading.")
```

### 4f — Update `REPORT_CLAUDE_SYSTEM` — remove emojis, improve format

Replace the existing `REPORT_CLAUDE_SYSTEM` array with:

```js
const REPORT_CLAUDE_SYSTEM = [
  "You are a senior AI governance analyst writing an internal report for Frank Group,",
  "a professional services firm with two entities: Frank Advisory and Frank Law, based in Australia.",
  "",
  "AUDIENCE: This report will be read by the CEO and non-technical team members.",
  "Write at the level of a clear, well-structured professional services report.",
  "A first-year university graduate should be able to read this and fully understand every metric,",
  "what it means, why it matters, and what action to take.",
  "",
  "STYLE RULES:",
  "- No emojis. No bullet-point-only sections. Use prose where explanation adds value.",
  "- Avoid jargon without definition. If you use a term like 'fluency score', explain it in plain English.",
  "- Numbers in AUD unless stated otherwise.",
  "- All section headers in UPPERCASE with a blank line before and after.",
  "- Do not pad with filler. Every sentence should add information.",
  "",
  "REPORT STRUCTURE — follow this exactly:",
  "1. EXECUTIVE SUMMARY (3–4 sentences: period, key wins, key risks, recommended next action)",
  "2. BILLING OVERVIEW (total spend AUD, seat costs, Claude Code separate; what each number means)",
  "3. AI ADOPTION (org-wide adoption %, entity breakdown, what the fluency score is and how it is calculated)",
  "4. MODEL GOVERNANCE (Opus vs Sonnet vs Haiku usage; why model choice matters for cost; flags; recommendations)",
  "5. SUPER USERS — INTERNAL AI TRAINERS (who they are, fluency scores, what they are doing well, what to improve, scoring breakdown)",
  "6. TEAM DEVELOPMENT OPPORTUNITIES (users below T2 fluency; specific, actionable coaching suggestions)",
  "7. CROSS-TEAM LEARNING (what topics each leader is working on; why this matters for knowledge sharing)",
  "8. INITIATIVES PROGRESS (status of each tracked initiative against its target metric)",
  "9. RECOMMENDED FOCUS — NEXT PERIOD (3 specific, prioritised actions with owner and success metric)",
  "",
  "For Section 5 (Super Users), explain the fluency scoring formula used:",
  "  Multi-signal: Spend 25% + Conversations 40% + Projects 20% + Config 15% (scale 0–100).",
  "  Spend-only: Token volume 50% + Surface diversity 30% + Recency 20%.",
  "State which formula was used and why. For each Super User, give a 2–3 sentence narrative on",
  "what the score reflects — what drives it up and what is holding it below 100.",
  "",
  "For Section 7 (Cross-Team Learning), explain what each category means in plain English",
  "(e.g. 'drafting & comms' means using Claude to write emails, memos, and letters).",
  "Note who is leading each category and what the org can learn from them.",
  "",
  "IMPORTANT: Base all numbers strictly on the JSON data provided. Do not fabricate figures.",
].join("\n");
```

### 4g — Fix duplicate content in Section 9 of generated reports

The current template `generate()` function sometimes repeats the "Recommended Focus" block.

In `generate()`, find where `RECOMMENDED FOCUS — NEXT PERIOD` is built and ensure it appears
exactly once. Typically the fix is removing a duplicated `lines.push(...)` call or a
copy-paste that outputs the block twice.

Search for all occurrences of the string `"RECOMMENDED FOCUS"` in `generate()` and keep only one.

### 4h — Improve the template `generate()` function (fallback)

Even though the template is no longer the primary path, update it to:
- Remove emojis (search/replace literal emoji characters in the template strings)
- Add plain-English explanations of the fluency formula inline (one sentence after the score)
- Add a "What this means:" line after each metric block

Example pattern (replace emoji-heavy lines like):
```js
lines.push(`• ${u.name}: ${u.fluencyTier === 1 ? "🌟" : ""} Score ${fmtDec(u.fluencyScore,0)}/100`);
```
With:
```js
lines.push(`• ${u.name}: Score ${fmtDec(u.fluencyScore,0)}/100${u.isSuperUser ? " (Super User)" : ""}`);
```

---

## Acceptance criteria

- [ ] No API key input field visible in Module 8
- [ ] Single "Generate Report" button calls Claude API directly using the hardcoded key
- [ ] Loading state shows "Generating report…" spinner/text
- [ ] Generated report textarea is editable; cursor can be placed and text modified
- [ ] "You can edit this report before downloading." hint appears below the textarea
- [ ] Report contains no emojis (neither in template nor AI-generated output, given system prompt)
- [ ] Section 5 of the report includes a fluency formula explanation per super user
- [ ] Section 7 includes plain-English descriptions of each category
- [ ] "Recommended Focus" section appears exactly once
- [ ] Download .doc, Print/PDF, Download .txt buttons still work on the edited content

---

## Files changed
- `index.html` — ANTHROPIC_REPORT_MODEL, ANTHROPIC_REPORT_API_KEY, REPORT_CLAUDE_SYSTEM,
  Module8 component (~1394–1475), generate() template function
- `src/dashboard.jsx` — sync same sections

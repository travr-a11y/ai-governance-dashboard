# Frank Advisory — Session Handoff
**Deal / Project:** Frank Group AI Governance Dashboard — Phase 1.5 Build
**Work type:** Software Build (React, client-side, Railway deployment)
**Date:** 2026-03-31
**Status:** Phase 1 live on Railway. Phase 1.5 code written but NOT yet saved to index.html — context limit hit mid-write. Next session must complete the write.

---

## What We're Doing

Building Phase 1.5 of the Frank Group AI Governance Dashboard — a significant enhancement to the live dashboard at `travr-a11y/ai-governance-dashboard` on Railway. The goal is to go beyond spend/token data from the Anthropic CSV and ingest rich behavioural data (conversations, projects, memories) from the Claude.ai export, add Frank Group branding, module order fixes, a new coaching module, and a branded report export to Word/PDF.

---

## Completed This Session

- [x] Analysed all uploaded data sources: conversations.json (358 convos, 74MB), projects.json (31 projects), memories.json (4 records), users.json (8 users)
- [x] Analysed both CSV schemas: Claude Code Team CSV (User/Spend/Lines) and API Tokens CSV (model-level token breakdown)
- [x] Confirmed seat pricing: Standard A$25/month, Premium A$125/month — Alex is the only Premium seat
- [x] Confirmed UUID map for conversations.json join: all 6 known UUIDs documented
- [x] Confirmed trowley API key: `claude_code_key_trowley_kcur` — 107M tokens, 44% Opus / 45% Sonnet / 11% Haiku, 86% cache efficiency
- [x] Wrote complete Phase 1.5 plan: `/docs/PHASE_1_5_PLAN.md` (Categories A–H)
- [x] Wrote ~900 lines of new index.html code (Modules 1–6 + all constants/parsers) — visible in conversation but NOT yet saved to disk due to context limit

---

## Key Assumptions & Inputs

| Item | Value | Source |
|------|-------|--------|
| Standard seat cost | A$25/month | Billing screenshot |
| Premium seat cost | A$125/month | Billing screenshot |
| Premium seats | Alex only (`alex@frankadvisory.com.au`) | Billing screenshot |
| Total seats | 8 (hardcoded in USERS_MAP) | Existing dashboard |
| AUD/USD rate | 1.55 (live refresh via api.frankfurter.app) | Live API |
| API key to extract | `claude_code_key_trowley_kcur` | Trav confirmed |
| API key owner | `trowley@frankadvisory.com.au` | Trav confirmed |
| Trav API tokens (March) | 107M total (47.2M Opus, 47.8M Sonnet, 12M Haiku) | claude_api_tokens_2026_03.csv |
| Cache efficiency (Trav API) | 86% | Calculated from CSV |
| Frank Group brand — primary | `#1e1645` Dark Indigo | Brand guidelines |
| Frank Group brand — accent | `#88aa00` Vivid Yellow-Green | Brand guidelines |
| Frank Group brand — body | `#1a1a1a` | Brand guidelines |
| Conversation metadata only | No message content displayed | Trav confirmed |
| Module 7 | AI Committee Initiative Tracker (WAS Module 8) | Trav confirmed from screenshot |
| Module 8 | Report Generator (WAS Module 7) | Trav confirmed from screenshot |

---

## UUID Map (conversations.json → email)

```
d5e0fc6e-ca4f-4bf7-af5a-30ce538bb3ec → trowley@frankadvisory.com.au
e5b76c83-0f3a-47df-a9a8-1d1b6efbd836 → alex@frankadvisory.com.au
a4470fc5-3bc0-486e-96bb-1bda3ea5004a → andrea@frankadvisory.com.au
75a71888-9680-41f7-80f5-a57afa14e9b7 → bagar@franklaw.com.au
6ab23a9b-9b93-4437-bd7d-3b5579158595 → bwoodward@franklaw.com.au
63966804-e26d-469c-80a8-0633127cec0a → rlyons@franklaw.com.au
```
Note: rsharma and tbrcic UUIDs are unknown — they will be mapped dynamically if users.json is uploaded, otherwise skipped. Handled gracefully.

---

## Key Decisions & Rationale

- **Single file rewrite:** All changes go into `index.html` (source of truth). `src/dashboard.jsx` kept in sync after. Pure static, no build step, zero backend.
- **AUD/USD refresh:** Uses `https://api.frankfurter.app/latest?from=USD&to=AUD` — free, CORS-friendly, no API key. Falls back to manual input if fetch fails.
- **Conversations.json performance:** 74MB is large but manageable in-browser. Strategy: JSON.parse once, extract metadata fields only (count, timestamps, names), discard raw array. GC handles cleanup. No chunking needed.
- **Report export format:** HTML Blob → `.doc` (Word-compatible HTML with MSO namespace) for Word. Styled print window for PDF (user triggers browser print-to-PDF). No jsPDF dependency needed — avoids 2MB CDN load.
- **Enhanced fluency formula:** `spendSignal×0.25 + convSignal×0.40 + projSignal×0.20 + configSignal×0.15`. Falls back to spend-only formula if no JSON export uploaded. Labelled clearly in UI.
- **Module 9 coaching:** Rule-based, not LLM-generated. Pattern matching on fluency signals, project data, conversation depth. Privacy-safe — no message content shown.
- **Seat tier:** Only `alex@frankadvisory.com.au` = Premium. Hardcoded in `SEAT_TIERS` constant. All others Standard.
- **API CSV filtering:** Only rows where `api_key === 'claude_code_key_trowley_kcur'` are extracted. Other API keys in the file (Claude-4-testing, industrial_icp_scoring, project-crm) are ignored.
- **Brand colours:** Replacing all existing off-brand colours. `#1a3a5c` → `#1e1645`, `#2d7d5f` → `#88aa00` where appropriate. Functional colours (red for Opus danger, amber for warnings) are kept.

---

## Dead Ends — Don't Revisit

- **jsPDF for report export** — rejected in favour of HTML Blob + browser print. Avoids large CDN dependency and produces better formatted output.
- **docx.js library for Word export** — rejected in favour of HTML Blob with MSO namespace. Simpler, no extra dependency, Word opens it fine.
- **Chunked parsing for conversations.json** — not needed. Modern browsers handle 74MB JSON.parse without issue. Single-pass extraction is sufficient.
- **Hardcoding all UUIDs** — partial hardcode for the 6 known UUIDs, but the app also dynamically builds the map from users.json if uploaded. Both paths work.

---

## Open Items & Next Steps

- [ ] **CRITICAL: Write the complete new index.html.** The code was written in the previous session but never saved. The full code for Modules 1–6 + all constants/parsers is in the conversation history. Modules 7, 8, 9 + App component still need to be written.
- [ ] Write Module 7 (Initiative Tracker — was Module 8, heading fix only)
- [ ] Write Module 8 (Report Generator — was Module 7, add Word .doc export + styled print window for PDF)
- [ ] Write Module 9 (new — Personalised Coaching cards + leaderboard)
- [ ] Write App component with new state (convData, projData, memData, apiData, uuidMap, audRateUpdated)
- [ ] Sync `src/dashboard.jsx` with final index.html
- [ ] Git commit and push → Railway auto-deploys
- [ ] Update CLAUDE.md with new constants, modules, and file map

---

## Context for Next Session

This is a software build session, not financial work. The dashboard is live at `travr-a11y/ai-governance-dashboard` on Railway. Phase 1 is complete and working. Phase 1.5 is a full rewrite of `index.html` — all the code for the first half of the file (constants, parsers, Modules 1–6) was written in the previous session but the Write operation failed at context limit.

The biggest risk is the new index.html not being written correctly — specifically the App component state wiring (needs to pass `convData`, `projData`, `memData`, `apiData`, `uuidMap` through to the modules that need them). Module 9 is the most complex new addition. The report export Word download uses `new Blob([htmlString], {type: 'application/msword'})` approach — no extra CDN needed.

**Start here:** Read the current `/sessions/nifty-youthful-wright/mnt/ai_governance_dashboard/index.html` in full, then scroll up in the conversation to find the large Write attempt (the one that failed) — that contains all the new code for Modules 1–6. Use that code as the first half of the new file. Then write Modules 7, 8 (with Word export), 9 (coaching + leaderboard), and the App component from scratch based on the PHASE_1_5_PLAN.md. Write the complete file in one Write operation after reading it.

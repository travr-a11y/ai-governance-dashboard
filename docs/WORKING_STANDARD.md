# Working Standard — Claude Code Collaboration

This document defines the standard working model for all Claude Code projects.
Add it to every new project's `docs/` folder and reference it in `CLAUDE.md`.

---

## The Model: Orchestrator + Executor

Every significant coding task runs through two roles:

| Role | Who | Responsibility |
|------|-----|----------------|
| **Architect / Orchestrator** | This Claude Code conversation | Research, audit, plan, write execution briefs, review output, commit |
| **Execution Agent** | Separate Claude Code agent (fresh context) | Implement code from the brief, nothing else |
| **Operator** | Travis | Approve briefs, paste to execution agent, report back, approve commits |

**Why this works:**
- Execution agents have clean context — no drift, no misremembered decisions
- Plans become auditable documents in the repo (`docs/`)
- Parallel work: one agent executes while we plan the next task
- Every change has a verified brief before it's coded
- Review happens before commit, not after

---

## Workflow — step by step

```
1. Travis describes a goal or problem
       ↓
2. Architect explores the codebase (Explore agents as needed)
       ↓
3. Architect writes an execution brief → docs/[TASK]_PLAN.md
       ↓
4. Travis reviews the brief (approves or adjusts)
       ↓
5. Travis pastes the brief to a separate execution agent
       ↓
6. Execution agent implements, commits, and summarises
       ↓
7. Architect reviews the summary + diffs
       ↓
8. If clean → push to main. If gaps → write a fix brief (back to step 3)
       ↓
9. Move to next task (often running in parallel from step 5)
```

---

## Execution Brief Format

Every brief lives at `docs/[TASK-NAME]_PLAN.md` and follows this structure:

```
# [Task Name] — Execution Brief

## Purpose
  Self-contained. Repo URL, Supabase ref, live URL.

## What this achieves
  Numbered outcomes.

## Current state
  What already exists. What NOT to redo.

## Changes required
  Numbered sections. Exact strings. Exact code. Zero ambiguity.

## Files to modify
  Table: file | changes

## Verification
  Numbered observable tests.

## Commit message
  Exact copy-paste.

## Notes for execution agent
  Gotchas. What not to touch. Known edge cases.
```

Use the `/execution-brief` skill to auto-format any plan into this structure.

---

## Execution Agent Prompt Template

Always use this format when handing off to an execution agent:

```
Read `docs/AGENT_HANDOFF.md`, `CLAUDE.md`, and `docs/[TASK-NAME]_PLAN.md`.
Implement the plan top to bottom.
[Any specific constraints — e.g. "do not deploy", "sync dashboard.jsx after index.html"]
Commit with the message in the plan file.
```

---

## Task sizing — when to write a brief vs execute directly

| Task type | Action |
|-----------|--------|
| Single file, < 20 lines changed | Execute directly in this conversation |
| Multi-file, well-understood change | Execute directly if low risk |
| Any change touching > 3 files | Write brief → execution agent |
| Any database migration | Write brief → execution agent (+ review SQL before applying) |
| Any deploy action | Confirm with Travis first |
| Any destructive operation | Always confirm, never assume |

---

## Parallel work protocol

While an execution agent is running:
- Continue planning the **next** task in this conversation
- Do not wait idly
- When Travis reports back with the agent's summary, switch to review mode

Typical session flow:
```
[Task A brief] → Agent A starts
[Task B planning] → while A runs
[Agent A reports back] → review A → write fix brief if needed
[Task B brief] → Agent B starts
...
```

---

## Document hygiene

After every significant change, update in this order:
1. `docs/AGENT_HANDOFF.md` — current state for next session
2. `CLAUDE.md` — if architecture or constants changed
3. Memory files — if working style or project context changed
4. Commit the brief doc alongside the code changes

---

## Setting up a new project

1. Copy this file to `docs/WORKING_STANDARD.md`
2. Add to `CLAUDE.md`: reference this doc and the working style
3. Create `docs/AGENT_HANDOFF.md` with current project state
4. Confirm `/execution-brief` skill is installed globally
5. First task: use `/dashboard-scaffold` or equivalent to bootstrap the stack

---

*This standard was established during The Frank Group AI Governance Dashboard build (April 2026)
and is designed to be project-agnostic.*

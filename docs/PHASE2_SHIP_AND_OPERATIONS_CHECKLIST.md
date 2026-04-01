# Phase 2 — Ship and operations checklist

**Audience:** Operator (Travis) and anyone deploying or auditing the Frank Group AI Governance Dashboard with Supabase persistence.

**Related:** [`SUPABASE_PERSISTENCE_PLAN.md`](SUPABASE_PERSISTENCE_PLAN.md) (implementation handoff), [`supabase-phase2.sql`](supabase-phase2.sql) (schema + RLS), [`DEPLOYMENT.md`](DEPLOYMENT.md) (Git + Railway).

**Supabase project ref:** `pwuapjdfrdbgcekrwlpr` — Dashboard → Project Settings → API for URL and anon key.

---

## 1. Pre-ship (Supabase)

- [ ] **Schema:** `periods`, `period_users`, `uploads` exist; RLS enabled; policies for `authenticated` match [`supabase-phase2.sql`](supabase-phase2.sql) (or equivalent migration `add_uploads_table_and_storage_bucket`).
- [ ] **Storage:** Private bucket `uploads`; object policies allow authenticated insert/select/delete/update for `bucket_id = 'uploads'`.
- [ ] **Auth:** Magic Link (or chosen provider) enabled; **document** intended allowlist (Frank domains). Client-side `isAllowedDashboardEmail` is UX only — enforce domains via Supabase Auth hooks / provider settings when ready ([`CLAUDE.md`](../CLAUDE.md) “Auth hardening”).
- [ ] **Quotas:** Confirm Storage file size limit suits largest exports (default 50 MiB in SQL comments; adjust in Dashboard if needed).

---

## 2. Pre-ship (app + repo)

- [ ] **`index.html` / `src/dashboard.jsx`:** Ingest persistence, auto-load after sign-in, Module 1 upload history — behaviour matches persistence plan (spot-check in staging).
- [ ] **Local smoke test:** `dashboard-config.json` from [`dashboard-config.example.json`](../dashboard-config.example.json); sign in; upload CSV; confirm row in `uploads` + object in Storage; reload and confirm auto-restore.
- [ ] **Never commit:** Real service role keys, user passwords, or private API keys. Anon key is client-exposed by design; still keep repo policy aligned with Frank IT (gitignored local `dashboard-config.json` is the default).

---

## 3. Production (Railway)

- [ ] **Variables:** In Railway → service → **Variables**, set:
  - `SUPABASE_URL` — `https://pwuapjdfrdbgcekrwlpr.supabase.co` (or current project URL)
  - `SUPABASE_ANON_KEY` — anon public key from Supabase API settings
  - *(Optional)* `OPENROUTER_API_KEY` — for Module 8 “Generate with Gemini” pre-loaded from config (see [`DEPLOYMENT.md`](DEPLOYMENT.md) env table).
  On deploy, `npm start` runs a short **prestart** step that writes `dashboard-config.json` from non-empty variables (see [`DEPLOYMENT.md`](DEPLOYMENT.md) Phase 2 section). No need to commit that file.
- [ ] **Verify:** After deploy, open the public URL, sign in, confirm periods/uploads load and a test ingest persists.
- [ ] **Rollback:** Redeploy previous Railway deployment if persistence regressions appear; data remains in Supabase.

---

## 4. Ongoing operations

- [ ] **Operator access:** Supabase Dashboard (SQL, Storage, Auth logs) + Railway (deployments, env vars).
- [ ] **Incidents:** RLS misconfiguration usually shows as empty tables or 401-style client errors in the browser network tab; Storage policy gaps show on upload/delete in Module 1 history.
- [ ] **Backups / DR:** Follow Supabase project backup settings (Dashboard); document RPO/RTO with Frank IT if required.
- [ ] **Planned follow-ups** (from product roadmap): historical trend charts beyond saved periods; Anthropic auto-fetch; M365 report email; auth hardening at provider.

---

## 5. Quick verification matrix

| Check | Expected |
|--------|----------|
| No env vars, no local config | Dashboard runs; no Supabase client; no cloud UI |
| Valid URL + anon in env or config | Client initializes; Magic Link works for allowed emails |
| After sign-in | Periods list loads; upload history can load |
| Successful ingest (signed in) | New `uploads` row + Storage object |
| Delete from Module 1 history | Row + object removed (policies permitting) |

---

## Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-01 | Initial checklist; Railway prestart `dashboard-config` generation documented in `DEPLOYMENT.md`. |

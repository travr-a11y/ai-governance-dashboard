# Deployment Guide — Frank Group AI Governance Dashboard

**GitHub:** `https://github.com/travr-a11y/ai-governance-dashboard`
**Platform:** Railway (static file serving via `npm start` → `prestart` optional config write → `npx serve`)
**Deploy trigger:** `git push origin main` → Railway auto-redeploys

---

## 1. Local development

No install. No build. Open `index.html` directly in a browser, or:

```bash
npx serve .
# Visit http://localhost:3000
```

---

## 2. GitHub — version control

```bash
# Check what's changed
git status
git diff

# Stage specific files (never stage .env or node_modules)
git add index.html src/dashboard.jsx    # add other files as needed

# Commit
git commit -m "feat/fix/chore: description"

# Push — triggers Railway auto-deploy
git push origin main
```

**If remote is missing:**
```bash
git remote add origin https://github.com/travr-a11y/ai-governance-dashboard.git
```

---

## 3. .gitignore — what's protected

| Pattern | Why |
|---------|-----|
| `.DS_Store` | macOS metadata |
| `.env` / `.env.local` | Secrets (none in Phase 1, but ready for Phase 2) |
| `node_modules/` | Never commit |
| `.railway/` | Railway CLI local state |
| `dashboard-config.json` | Runtime Supabase config (written on Railway by `prestart`; never commit) |

**Verify nothing sensitive is staged:**
```bash
git status
# If something wrong is staged:
git reset HEAD <file>
```

---

## 4. Railway — production deployment

### One-time setup (already done)

1. Go to [railway.app/new](https://railway.app/new)
2. Choose **"Deploy from GitHub repo"**
3. Select `travr-a11y/ai-governance-dashboard`
4. Railway detects `package.json` and runs the `start` script automatically
5. **Settings → Domains → Generate Domain** for your public URL

### Railway config files (already committed)

**`package.json`:**
```json
{
  "name": "ai-governance-dashboard",
  "version": "1.0.0",
  "scripts": {
    "prestart": "node scripts/write-dashboard-config-from-env.js",
    "start": "npx serve . --listen $PORT --no-clipboard"
  }
}
```

**`railway.toml`:**
```toml
[deploy]
startCommand = "npm start"
healthcheckPath = "/"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Environment variables

**Phase 1: None required.** The dashboard is fully client-side.

**Phase 2 — Supabase (current):** For persistence on the deployed static site, set these in Railway → **Variables**:

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | Project URL, e.g. `https://pwuapjdfrdbgcekrwlpr.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase **anon** public key (Dashboard → Project Settings → API) |

On `npm start`, **`prestart`** runs [`scripts/write-dashboard-config-from-env.js`](../scripts/write-dashboard-config-from-env.js) and, when both variables are non-empty, writes `dashboard-config.json` at the repo root before `npx serve`. That file is gitignored locally but present at runtime on Railway so the browser can `fetch("/dashboard-config.json")` as in `index.html`. Without these variables, the app still serves; Supabase features stay off until config exists.

**Phase 2 (later):** Anthropic auto-fetch, SMTP, etc. may add `ANTHROPIC_API_KEY`, `SMTP_*` — document when implemented.

> Railway automatically injects `PORT` — do NOT set it manually.

---

## 5. Standard deploy workflow

```
[Edit index.html locally]
        ↓
[Test: open index.html in browser OR npx serve .]
        ↓
git add <files>
git commit -m "feat/fix: description"
git push origin main
        ↓
[Railway auto-deploys — watch logs in Railway dashboard]
        ↓
[Verify: visit public URL, upload sample CSV, confirm dashboard loads]
```

---

## 6. Monitoring

- **Railway dashboard** → select service → **Deployments** tab → click deployment for live logs
- **Health check:** `GET /` returns 200 when healthy
- **Public URL:** check Railway → Settings → Domains

---

## 7. Custom domain (optional)

1. Railway dashboard → service → **Settings → Domains**
2. Click **"Generate Domain"** for a free `*.up.railway.app` URL
3. Or **"Custom Domain"** → add CNAME record at your DNS provider

---

## Quick reference

| What | Detail |
|------|--------|
| GitHub repo | `travr-a11y/ai-governance-dashboard` |
| Branch | `main` |
| Start command | `npm start` (runs `prestart` then `npx serve …`) |
| Health check | `GET /` |
| Env vars needed | None for core dashboard; `SUPABASE_URL` + `SUPABASE_ANON_KEY` for Phase 2 on Railway |
| Deploy trigger | `git push origin main` |

# Deployment Guide — Frank Group AI Governance Dashboard

**GitHub:** `https://github.com/travr-a11y/ai-governance-dashboard`
**Platform:** Railway (static file serving via `npx serve`)
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
git add index.html dashboard.jsx    # add other files as needed

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
    "start": "npx serve . --listen $PORT --no-clipboard"
  }
}
```

**`railway.toml`:**
```toml
[deploy]
startCommand = "npx serve . --listen $PORT --no-clipboard"
healthcheckPath = "/"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Environment variables

**Phase 1: None required.** The dashboard is fully client-side.

**Phase 2 (future):** Will need `ANTHROPIC_API_KEY`, `DATABASE_URL`, `SMTP_*` vars — set in Railway dashboard → Variables tab.

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
| Start command | `npx serve . --listen $PORT --no-clipboard` |
| Health check | `GET /` |
| Env vars needed | None (Phase 1) |
| Deploy trigger | `git push origin main` |

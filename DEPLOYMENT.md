# Deployment Guide — Idustrial ICP

This repository contains **two independent Python/FastAPI services**, each with its own git history, GitHub remote, and Railway deployment. This guide covers version control setup and production deployment for both.

---

## Repository Structure

```
Idustrial ICP/                          ← Root git repo (no remote — local workspace only)
├── G@W_260128/                         ← Service 1: ICP Scoring Engine
│   └── .git/ → github.com/travr-a11y/industrial_ICP_G-W
├── Research + Enrichments/             ← Service 2: Research & Enrichment Agent
│   └── .git/ → github.com/travr-a11y/industrial_ICP_G-W_Copy-Variables
└── Frank-Group-AI-Context/             ← Knowledge base (docs only, not deployed)
```

> Each service folder is its **own independent git repository**. They share no git history with the root workspace folder. Commits, pushes, and Railway deployments are done **per service**.

---

## 1. GitHub — Version Control Setup

### Service 1: ICP Scoring Engine (`G@W_260128`)

**Remote:** `https://github.com/travr-a11y/industrial_ICP_G-W`

```bash
# Navigate into the service
cd "G@W_260128"

# Verify remote is set correctly
git remote -v
# Expected output:
# origin  https://github.com/travr-a11y/industrial_ICP_G-W.git (fetch)
# origin  https://github.com/travr-a11y/industrial_ICP_G-W.git (push)

# Check what is staged / untracked
git status

# Stage all changes (never stage .env or venv/)
git add .

# Commit
git commit -m "your message here"

# Push to main branch
git push origin main
```

> **If the remote is missing**, add it with:
> ```bash
> git remote add origin https://github.com/travr-a11y/industrial_ICP_G-W.git
> ```

---

### Service 2: Research & Enrichment Agent (`Research + Enrichments`)

**Remote:** `https://github.com/travr-a11y/industrial_ICP_G-W_Copy-Variables`

```bash
# Navigate into the service (note the space — use quotes)
cd "Research + Enrichments"

# Verify remote
git remote -v
# Expected output:
# origin  https://github.com/travr-a11y/industrial_ICP_G-W_Copy-Variables.git (fetch)
# origin  https://github.com/travr-a11y/industrial_ICP_G-W_Copy-Variables.git (push)

# Stage all changes
git add .

# Commit
git commit -m "your message here"

# Push to main branch
git push origin main
```

> **If the remote is missing**, add it with:
> ```bash
> git remote add origin https://github.com/travr-a11y/industrial_ICP_G-W_Copy-Variables.git
> ```

---

## 2. .gitignore — What's Protected

Both service repos have a `.gitignore` that excludes the following. **Never force-add these:**

| Pattern | Why |
|---------|-----|
| `.env` / `.env.local` | API keys and secrets |
| `venv/` / `.venv/` | Virtual environment (never commit) |
| `gen-lang-client-*.json` | Google Cloud service account credentials |
| `*.credentials.json` | Any credentials file |
| `*service-account*.json` | GCP service accounts |
| `logs/` / `*.log` | Runtime log output |
| `__pycache__/` / `*.pyc` | Python bytecode |
| `.railway/` | Railway CLI local state |
| `data/runs.jsonl` | Local run logs (ICP engine) |
| `.DS_Store` | macOS metadata |

### Verify nothing sensitive is being tracked

```bash
# Run this from inside each service folder before pushing
git status

# If a secret was accidentally staged, unstage it:
git reset HEAD <file>

# If a secret was already committed, remove it from tracking:
git rm --cached <file>
git commit -m "remove tracked secret"
```

---

## 3. Railway — Production Deployment

Railway connects directly to each GitHub repo. A `git push` to `main` triggers an automatic redeploy.

### Prerequisites

- [Railway account](https://railway.app) linked to your GitHub (`travr-a11y`)
- Railway CLI installed (optional, for manual deploys):
  ```bash
  npm install -g @railway/cli
  railway login
  ```

---

### Service 1: ICP Scoring Engine → Railway

**GitHub repo:** `travr-a11y/industrial_ICP_G-W`

#### One-time Railway project setup

1. Go to [railway.app/new](https://railway.app/new)
2. Choose **"Deploy from GitHub repo"**
3. Select `travr-a11y/industrial_ICP_G-W`
4. Railway will auto-detect Python and use **`Procfile`** + **`railway.toml`**

**`Procfile`** (already committed):
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**`railway.toml`** (already committed):
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

#### Environment variables to set in Railway dashboard

Navigate to your Railway project → **Variables** tab and add:

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAY_API_KEY` | Yes | Clay API key |
| `CLAY_WEBHOOK_URL` | Yes | Clay webhook URL for push-back |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `SERPER_API_KEY` | Yes | Serper.dev Google search API key |
| `PROSPEO_API_KEY` | Yes | Prospeo email lookup API key |
| `APP_ENV` | Yes | Set to `production` |
| `LOG_LEVEL` | Yes | `INFO` or `WARNING` for prod |
| `MAX_COST_PER_RECORD_AUD` | Yes | e.g. `0.30` |
| `FX_RATE_USD_TO_AUD` | Yes | e.g. `1.55` |
| `ABN_LOOKUP_GUID` | Optional | ABN web services GUID |
| `LOG_SHEET_ID` | Optional | Google Sheets ID for run logging |
| `GOOGLE_SHEETS_CREDENTIALS_JSON` | Optional | Entire service account JSON as a single-line string |

> Railway automatically injects `PORT` — do **not** set it manually.

#### Deploy

```bash
cd "G@W_260128"
git add .
git commit -m "deploy: <describe change>"
git push origin main
# Railway auto-deploys on push to main
```

To manually trigger a redeploy from the CLI:
```bash
cd "G@W_260128"
railway up
```

Health check endpoint: `GET /health`

---

### Service 2: Research & Enrichment Agent → Railway

**GitHub repo:** `travr-a11y/industrial_ICP_G-W_Copy-Variables`

#### One-time Railway project setup

1. Go to [railway.app/new](https://railway.app/new)
2. Choose **"Deploy from GitHub repo"**
3. Select `travr-a11y/industrial_ICP_G-W_Copy-Variables`
4. Railway will auto-detect Python and use **`Procfile`** + **`railway.toml`**

**`railway.toml`** (already committed):
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

#### Environment variables to set in Railway dashboard

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_API_KEY` | Yes | Bearer token for authenticating inbound requests |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `ANTHROPIC_MODEL` | Yes | e.g. `claude-sonnet-4-6` |
| `SERPER_API_KEY` | Yes | Serper.dev API key |
| `PROSPEO_API_KEY` | Yes | Prospeo API key |
| `ENVIRONMENT` | Yes | Set to `production` |
| `LOG_LEVEL` | Yes | `INFO` or `WARNING` for prod |

> Railway automatically injects `PORT` — do **not** set it manually.

#### Deploy

```bash
cd "Research + Enrichments"
git add .
git commit -m "deploy: <describe change>"
git push origin main
# Railway auto-deploys on push to main
```

Health check endpoint: `GET /api/health`

---

## 4. Local Development

### ICP Scoring Engine

```bash
cd "G@W_260128"

# Create and activate virtual environment (first time only)
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and fill in your keys
cp .env.example .env
# Edit .env with your actual API keys

# Start server with hot reload
bash start_server.sh
# OR: uvicorn app.main:app --reload --port 8000
```

### Research & Enrichment Agent

```bash
cd "Research + Enrichments"

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and fill in your keys
cp .env.example .env
# Edit .env with your actual keys

# Start server
uvicorn app.main:app --reload --port 8001
```

---

## 5. Deploying Changes — Standard Workflow

```
[Edit code locally]
        ↓
[Test locally]
        ↓
cd into service folder (G@W_260128 OR "Research + Enrichments")
        ↓
git add .
git commit -m "feat/fix/chore: description"
git push origin main
        ↓
[Railway auto-deploys — watch logs in Railway dashboard]
        ↓
[Verify health endpoint returns 200]
```

---

## 6. Monitoring & Logs

- **Railway dashboard** → select your service → **Deployments** tab → click a deployment to stream live logs
- **Health endpoints:**
  - ICP Scoring Engine: `GET https://<your-railway-domain>/health`
  - Research Agent: `GET https://<your-railway-domain>/api/health`
- Both return `{"status": "ok"}` when healthy

---

## 7. Connecting a Custom Domain (Optional)

In the Railway dashboard:
1. Select your service → **Settings** → **Domains**
2. Click **"Generate Domain"** for a free `*.up.railway.app` URL
3. Or click **"Custom Domain"** and add your DNS CNAME record

---

## Quick Reference

| What | Service 1 (ICP Scoring) | Service 2 (Research Agent) |
|------|------------------------|---------------------------|
| Folder | `G@W_260128/` | `Research + Enrichments/` |
| GitHub | `industrial_ICP_G-W` | `industrial_ICP_G-W_Copy-Variables` |
| Health check | `/health` | `/api/health` |
| Key env var | `CLAY_API_KEY` | `AGENT_API_KEY` |
| Python version | 3.12.5 (`runtime.txt`) | 3.x (latest Railway default) |

# Railway Deployment Guide

This guide covers deploying Command Gateway on Railway (recommended for production scalability).

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repo with the codebase
3. Telegram bot token and chat ID (see README.md)
4. SendGrid API key

## Architecture on Railway

- **Database**: PostgreSQL (auto-provisioned via Railway plugin)
- **Backend**: Railway Service (connects to Postgres)
- **Worker**: Railway Service (API mode, calls backend endpoints)
- **Frontend**: Vercel (separate from Railway)

**Why API-mode worker on Railway?** Railway doesn't provide persistent shared disks like Render, so the worker can't read the same SQLite file as the backend. Instead, it calls HTTP endpoints.

## Step-by-Step Deployment

### 1. Create Backend Service

```
1. Log into Railway dashboard
2. Click "Create New Project"
3. Select "Deploy from GitHub"
4. Connect your GitHub account and select the repo
5. Select "Deploy from GitHub" and choose the main branch
6. Set the "Root Directory" to `backend/`
7. Click "Deploy"
```

### 2. Add PostgreSQL Database

```
1. In the new project, click "+ Add"
2. Search for "PostgreSQL"
3. Click "Add PostgreSQL"
4. Wait for the database to provision
   - Railway auto-creates `DATABASE_URL` env var
5. Copy the `DATABASE_URL` and add it to backend service variables
```

### 3. Configure Backend Environment Variables

In the backend service settings, add:

```
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

The `DATABASE_URL` will be auto-populated from the Postgres plugin.

### 4. Get Admin API Key

```
1. Go to the backend service "Logs" tab
2. Look for line: "Created default admin. API key: <KEY>"
3. Copy the full key (looks like: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6")
```

### 5. Create Worker Service

```
1. Click "+ Add" in the project
2. Click "GitHub" and select the same repo
3. Set "Root Directory" to `worker/`
4. Click "Deploy"
```

### 6. Configure Worker Environment Variables

In the worker service settings, add:

```
WORKER_MODE=api
BACKEND_URL=https://<your-backend-service-name>.railway.app
WORKER_API_KEY=<paste-the-admin-key-from-step-4>
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

To find the backend URL:
```
1. Click the backend service
2. In "Settings", look for the public domain
3. It should be: https://<generated-name>.railway.app
```

### 7. Deploy Frontend on Vercel

```
1. Push your code to GitHub if not already done
2. Go to Vercel (https://vercel.com)
3. Click "Add New..." → "Project"
4. Select your GitHub repo
5. Set "Root Directory" to `frontend/`
6. Add Environment Variable:
   VITE_API_URL=https://<your-backend-service-name>.railway.app
7. Click "Deploy"
```

### 8. Test the System

1. Open `https://<your-frontend>.vercel.app` in browser
2. Paste the admin API key from step 4
3. Try submitting a command:
   - Should either auto-accept, auto-reject (if rule exists), or create approval
4. Test approval workflow:
   - Create an approver user via API: `POST /users` with admin key
   - Submit a command that requires approval
   - Vote from the approver account via `POST /approvals/{id}/vote`

## Database Migrations (Future)

If you need to modify the schema:

1. Update `backend/models.py`
2. In local dev, the ORM auto-creates tables on startup
3. For production (Postgres), consider adding Alembic migrations for safety

## Monitoring & Logs

- **Backend logs**: Railway dashboard → Backend service → Logs tab
- **Worker logs**: Railway dashboard → Worker service → Logs tab
- **Database**: Railway dashboard → Postgres service → Data tab

## Redeploying

```
1. Make code changes and push to GitHub
2. Railway auto-detects and redeploys
3. Or manually: Railway dashboard → service → Deployments → "Redeploy"
```

## Scaling

Since the worker is API-based, you can run multiple worker instances without conflicts:

```
1. In Worker service, increase the number of replicas
2. All will call the same backend API
3. Each worker is stateless (no shared DB)
```

## Troubleshooting

### Backend can't connect to Postgres
- Check that `DATABASE_URL` is set (should auto-populate from Postgres plugin)
- Verify Postgres service is running in the project

### Worker can't reach backend
- Check `BACKEND_URL` is correct (format: `https://xxxx.railway.app`)
- Verify backend service is running
- Check `WORKER_API_KEY` is valid (should be the admin key)

### Worker gets 403 errors
- `WORKER_API_KEY` might be expired or wrong
- Verify it's the admin API key (starts with 32 hex chars)
- Backend's `startup` event creates a new admin key; check logs

### Commands not executing
- Check user has credits > 0
- Verify rules are set (if no rules, defaults to REQUIRE_APPROVAL)
- Check EventLog for errors

## Costs

Railway has a free tier but can incur charges:
- **Postgres**: $5/month for small database
- **Backend service**: ~$7/month for 1GB RAM (continuous)
- **Worker service**: ~$7/month for small service (continuous)
- **Vercel**: Free tier for frontend

## Optional: Setup CD/CI

For automatic deployments on every push, Railway can auto-deploy or you can add GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

(Requires Railway API token in GitHub Secrets)

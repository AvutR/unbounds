# Render Deployment Guide

This guide covers deploying Command Gateway on Render (recommended for simplicity with SQLite).

## Prerequisites

1. Render account (https://render.com)
2. GitHub repo with the codebase
3. Telegram bot token and chat ID
4. SendGrid API key

## Architecture on Render

- **Database**: SQLite on persistent disk (mounted at `/data`)
- **Backend**: Web Service (connects to SQLite)
- **Worker**: Background Service or another Web Service (same disk access)
- **Frontend**: Vercel (separate from Render)

**Why SQLite on Render?** Render provides persistent disk that both backend and worker can access, so shared DB mode works perfectly.

## Step-by-Step Deployment

### 1. Create Backend Service

```
1. Log into Render dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub account and select the repo
4. Fill in:
   - Name: command-gateway-backend
   - Runtime: Python 3
   - Build Command: pip install -r requirements.txt
   - Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   - Root Directory: backend/
5. Click "Create Web Service"
```

### 2. Add Persistent Disk

```
1. In the backend service, go to "Disks" tab
2. Click "Add Disk"
3. Set:
   - Name: data
   - Mount Path: /data
   - Size: 1 GB (or more)
4. Click "Add"
```

### 3. Configure Backend Environment Variables

In the backend service, go to "Environment" and add:

```
DATABASE_URL=/data/db.sqlite
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

The backend will auto-create the SQLite database on the persistent disk at startup.

### 4. Get Admin API Key

```
1. Go to the backend service "Logs" tab
2. Look for line: "Created default admin. API key: <KEY>"
3. Copy the full key (looks like: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6")
```

### 5. Create Worker Service (Option A: Background Job)

```
1. Click "New +" → "Background Job"
2. Connect GitHub and select the repo
3. Fill in:
   - Name: command-gateway-worker
   - Runtime: Python 3
   - Build Command: pip install -r requirements.txt
   - Start Command: python worker.py
   - Root Directory: worker/
4. Click "Create Background Job"
```

**OR Option B: Second Web Service (Simpler)**

```
1. Click "New +" → "Web Service"
2. Same setup as Option A but select "Web Service"
3. Set same environment variables (see step 6)
```

### 6. Configure Worker Environment Variables

In the worker service, go to "Environment" and add:

```
DATABASE_URL=/data/db.sqlite
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

Note: No `WORKER_MODE` needed; it defaults to `db` mode when `DATABASE_URL` is a local SQLite path.

### 7. Deploy Frontend on Vercel

```
1. Go to Vercel (https://vercel.com)
2. Click "Add New..." → "Project"
3. Select your GitHub repo
4. Set "Root Directory" to `frontend/`
5. Add Environment Variable:
   VITE_API_URL=https://<your-backend>.onrender.com
6. Click "Deploy"
```

To find the backend URL:
```
1. Click the backend service in Render
2. Look for "URL" at the top of the page
3. It should be: https://command-gateway-backend-xxxx.onrender.com
```

### 8. Test the System

1. Open `https://<your-frontend>.vercel.app` in browser
2. Paste the admin API key from step 4
3. Try submitting a command
4. Test approval workflow

## Monitoring & Logs

- **Backend logs**: Render dashboard → Backend service → Logs
- **Worker logs**: Render dashboard → Worker service → Logs
- **Disk usage**: Render dashboard → Backend service → Disks

## Redeploying

```
1. Make code changes and push to GitHub
2. Render auto-detects and redeploys
3. Or manually: Render dashboard → service → Manual Deploy
```

## Scaling

With shared SQLite:
- **Single backend** handles all traffic
- **Single worker** updates the same DB
- If you need multiple backend instances, consider migrating to Postgres (see below)

## Migrating to PostgreSQL (Advanced)

If you outgrow SQLite:

```
1. Create a PostgreSQL database via Render's "Databases" tab
2. Copy the auto-generated DATABASE_URL
3. Update backend and worker environment to use that URL
4. On next deploy, ORM will auto-create tables in Postgres
5. (Optional) Switch worker to API mode for multi-instance setup
```

## Costs

Render's free tier works for small projects:
- **Web Service (backend)**: Free tier or $7/month
- **Background Job (worker)**: Free tier or $5/month
- **Persistent Disk**: ~$0.25/GB/month
- **Vercel (frontend)**: Free tier

## Troubleshooting

### Backend can't find database
- Verify `DATABASE_URL=/data/db.sqlite` is set
- Check that the disk is attached (Disks tab)
- Check disk has free space

### Worker not updating approvals
- Check worker service is running (Logs tab)
- Verify `DATABASE_URL` points to same disk
- Check Render logs for errors

### Commands not executing
- Check user has credits > 0
- Verify rules are set
- Check EventLog in database

## Disk Maintenance

SQLite databases can grow over time:

```sql
-- To cleanup EventLog (keep recent 10000 entries):
DELETE FROM eventlog 
WHERE id NOT IN (SELECT id FROM eventlog ORDER BY created_at DESC LIMIT 10000);

VACUUM;  -- Defragment the database
```

## Limitations of SQLite

- Not ideal for 1000+ concurrent users
- No automatic backups (attach a backup service)
- Single-writer at a time (fine for this use case)

For production, consider PostgreSQL via Render's database service.

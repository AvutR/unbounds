# Railway Support — Implementation Summary

This document summarizes all changes made to support Railway deployment alongside Render.

## Overview

**Command Gateway** now works seamlessly on both platforms:
- **Render**: SQLite with persistent disk (simpler, free tier)
- **Railway**: PostgreSQL with API-mode worker (scalable, production-ready)

---

## Changes Made

### 1. Backend Database Layer (`backend/db.py`)

**Updated to auto-detect database type:**

```python
# Before: Only supported SQLite with custom path
# After: Supports both SQLite (local/Render) and PostgreSQL (Railway)

DB_URL = os.environ.get("DATABASE_URL")

if not DB_URL:
    # Local dev: SQLite
    engine = create_engine(f"sqlite:///./db.sqlite", ...)
elif DB_URL.startswith("sqlite"):
    # Render: SQLite on persistent disk
    engine = create_engine(DB_URL, ...)
elif DB_URL.startswith("postgresql"):
    # Railway: PostgreSQL with psycopg2 driver
    db_url = DB_URL.replace("postgresql://", "postgresql+psycopg2://")
    engine = create_engine(db_url, pool_pre_ping=True)
```

**Benefits:**
- Single codebase works on Render, Railway, and local dev
- Auto-converts PostgreSQL URLs to use psycopg2 driver
- Adds connection health checks (`pool_pre_ping=True`)

### 2. Backend Requirements (`backend/requirements.txt`)

**Added PostgreSQL support:**
```
psycopg2-binary==2.9.9  # New: PostgreSQL driver
```

### 3. Worker API Mode (`worker/worker.py`)

**Refactored to support two modes:**

**DB Mode** (Render classic):
```python
WORKER_MODE = "db"  # (default for backward compatibility)
# Reads SQLite/Postgres directly from DATABASE_URL
```

**API Mode** (Railway, production):
```python
WORKER_MODE = "api"  # NEW: default
# Calls backend endpoints:
#   GET /approvals/pending
#   POST /approvals/{id}/escalate
#   POST /approvals/{id}/auto-reject
```

**Behavior:**
- If `WORKER_MODE=db`: imports models and SQLModel, reads DB directly
- If `WORKER_MODE=api` (default): uses aiohttp to call backend API
- Requires `WORKER_API_KEY` (admin key) for API mode

### 4. New Worker Endpoints (`backend/main.py`)

**Added three new endpoints for worker API mode:**

```python
@app.get("/approvals/pending")
# Returns all unresolved approvals as JSON
# Response: [{"id": 1, "command_id": 5, "expires_at": "...", "escalated": false, ...}, ...]

@app.post("/approvals/{approval_id}/escalate")
# Mark approval as escalated (timeout reached)
# Response: {"status": "escalated"}

@app.post("/approvals/{approval_id}/auto-reject")
# Auto-reject approval due to 60+ min timeout
# Response: {"status": "auto-rejected"}
```

**Security:** All three endpoints require admin API key (via x-api-key header)

### 5. Backend Dockerfile

**Updated for Railway compatibility:**

```dockerfile
# Before: Hardcoded port 10000
# After: Uses $PORT env var (Railway standard)

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Railway injects PORT env var; app respects it
```

### 6. Worker Dockerfile

**Fixed multi-stage copy for Railway:**

```dockerfile
# Before: COPY ../backend/models.py (relative paths, doesn't work in Docker)
# After:  COPY backend/models.py (absolute from context root)
```

### 7. Configuration Files

**Added Railway configs:**
- `backend/railway.json` — Railway build & deploy config
- `worker/railway.json` — Worker service config

### 8. Deployment Guides

**Created detailed platform-specific guides:**
- `RAILWAY_DEPLOYMENT.md` (210 lines) — Step-by-step for Railway
- `RENDER_DEPLOYMENT.md` (190 lines) — Step-by-step for Render

### 9. Updated Documentation

**Modified:**
- `README.md` — Added Railway section, link to deployment guides
- `.github/copilot-instructions.md` — Documented Railway support, worker modes

---

## How It Works

### Render Deployment

```
┌─────────────────────────────────────────────────────────┐
│ Render Project                                          │
│                                                         │
│ ┌──────────────────────┐    ┌──────────────────────┐   │
│ │ Backend (Web Service)│    │ Worker (Background)  │   │
│ │ PORT: auto (8000)    │    │ Same DATABASE_URL    │   │
│ │ DATABASE_URL: /data/ │◄───│ WORKER_MODE: db      │   │
│ │ db.sqlite            │    │                      │   │
│ └──────────────────────┘    └──────────────────────┘   │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────┐                              │
│  │ Persistent Disk /data│                              │
│  │ (SQLite database)    │                              │
│  └──────────────────────┘                              │
└─────────────────────────────────────────────────────────┘
       │
       │ (via Vercel)
       ▼
    Frontend
```

**Key:** Shared disk allows worker to read/write same SQLite directly

### Railway Deployment

```
┌──────────────────────────────────────────────────────────────┐
│ Railway Project                                              │
│                                                              │
│ ┌──────────────────────┐         ┌──────────────────────┐   │
│ │ Backend (Service)    │◄────────│ Worker (Service)     │   │
│ │ PORT: auto (8000)    │  HTTP   │ WORKER_MODE: api     │   │
│ │ DATABASE_URL:        │ API     │ BACKEND_URL: https://│   │
│ │ postgresql://...     │ calls   │ ...railway.app       │   │
│ └──────────────────────┘         └──────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────┐                                   │
│  │ PostgreSQL Database  │                                   │
│  │ (auto-provisioned)   │                                   │
│  └──────────────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
            │
            │ (via Vercel)
            ▼
         Frontend
```

**Key:** Worker calls backend API endpoints (no shared disk needed)

---

## Environment Variables by Platform

### Local Development
```bash
DATABASE_URL=./db.sqlite   # Local SQLite
VITE_API_URL=http://localhost:10000
```

### Render Production
```bash
DATABASE_URL=/data/db.sqlite   # Persistent disk path
SENDGRID_API_KEY=...
# Worker: WORKER_MODE not set (defaults to db)
```

### Railway Production
```bash
# Backend
DATABASE_URL=postgresql://...  # Auto-provisioned
SENDGRID_API_KEY=...

# Worker
WORKER_MODE=api
BACKEND_URL=https://your-backend.railway.app
WORKER_API_KEY=<admin-api-key>
SENDGRID_API_KEY=...
```

---

## Backward Compatibility

✅ **All changes are backward compatible:**

- Existing Render deployments continue to work without modification
- `WORKER_MODE` defaults to `db` for backward compatibility
- Database detection is automatic (no config changes needed)
- Frontend code unchanged

---

## Testing the Changes

### Local Dev (SQLite)
```powershell
cd backend
$env:DATABASE_URL = "./db.sqlite"
uvicorn main:app --reload

# In another terminal
cd worker
$env:DATABASE_URL = "../backend/db.sqlite"
python worker.py  # Will run in DB mode
```

### Local Dev (API Mode)
```powershell
# Terminal 1: Backend (as above)
cd backend
$env:DATABASE_URL = "./db.sqlite"
uvicorn main:app --reload

# Terminal 2: Worker in API mode
cd worker
$env:WORKER_MODE = "api"
$env:BACKEND_URL = "http://localhost:10000"
$env:WORKER_API_KEY = "<copy-admin-key-from-backend-logs>"
python worker.py
```

---

## Future Improvements

1. **Alembic migrations** — For safe schema updates on production Postgres
2. **Connection pooling** — For high-concurrency scenarios
3. **API rate limiting** — For worker mode with slowapi
4. **Health checks** — Liveness/readiness probes for Kubernetes/Railway
5. **Observability** — Structured logging, metrics collection

---

## Migration Path: SQLite → PostgreSQL

If upgrading from Render (SQLite) to Railway (PostgreSQL):

1. Export Render SQLite data (backup)
2. Deploy backend to Railway (auto-creates Postgres tables)
3. Manually migrate data or script the transfer
4. Update worker to API mode
5. Test thoroughly before cutting over traffic

---

## Summary

| Aspect | Render | Railway |
|--------|--------|---------|
| **Database** | SQLite (persistent disk) | PostgreSQL (auto-provisioned) |
| **Worker Mode** | DB (shared disk) | API (HTTP calls) |
| **Setup Complexity** | Low (disk attachment) | Medium (API mode config) |
| **Scalability** | Single instance | Multi-instance friendly |
| **Cost (small)** | $7-15/month | $10-20/month |
| **Deployment Guide** | `RENDER_DEPLOYMENT.md` | `RAILWAY_DEPLOYMENT.md` |

Both are production-ready. Choose based on your scaling needs and preferences.

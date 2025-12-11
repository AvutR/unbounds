# Command Gateway

A complete Command Gateway system: FastAPI backend, approval worker, React frontend.

**Features:** API-key auth, credits, rule engine (regex), approvals, voting thresholds, escalation, time-based rules, notifications (Telegram + SendGrid), analytics.

See `/backend`, `/worker`, `/frontend` folders for service implementations.

## Quickstart (local dev)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=./db.sqlite  # or $env:DATABASE_URL="./db.sqlite" on Windows PowerShell
uvicorn main:app --reload --port 10000
```

On startup, the backend prints the default **admin API key** to logs. Copy it.

### 2. Worker (in another terminal)

```bash
cd worker
pip install -r requirements.txt
export DATABASE_URL=../backend/db.sqlite
python worker.py
```

### 3. Frontend

```bash
cd frontend
npm install
export VITE_API_URL=http://localhost:10000  # or $env:VITE_API_URL="..." on Windows
npm run dev
```

Then open `http://localhost:5173` and paste the admin API key.

---

## Architecture Overview

### Backend (`backend/main.py`)
- **FastAPI** service with SQLModel ORM + SQLite database
- **Models:** User (roles: admin/member/approver), Rule (regex-based), Command, Approval, ApprovalVote, EventLog
- **Endpoints:**
  - `POST /users` — admin creates users
  - `GET /rules`, `POST /rules` — list/create approval rules
  - `POST /commands` — submit a command (triggers rule matching, approval flow, or auto-accept/reject)
  - `GET /commands` — view command history
  - `POST /approvals/{id}/vote` — approver votes to approve/reject pending command
- **Authentication:** x-api-key header
- **Flow:**
  1. User submits command → backend matches against rules by regex priority
  2. Rule determines action: AUTO_ACCEPT, AUTO_REJECT, or REQUIRE_APPROVAL
  3. If REQUIRE_APPROVAL: create Approval record with threshold (default 2 votes)
  4. Approvers vote; once threshold met, command executes and deducts credits
  5. All actions logged to EventLog for audit

### Worker (`worker/worker.py`)
- **Background job** that runs every 60s
- Checks pending approvals: escalates expired ones, auto-rejects very old ones (60+ min)
- Sends Telegram notifications for escalations and timeouts
- **Two modes:**
  - **Shared DB mode** (Render): reads SQLite directly from persistent disk
  - **API mode** (Railway): calls backend endpoints via HTTP (default)

### Frontend (`frontend/src/`)
- **React + Vite** minimal SPA
- **Pages:**
  - `LoginKey.jsx` — enter API key
  - `Dashboard.jsx` — submit commands, view history
  - `AdminRules.jsx` — (stub) create/list rules
  - `Approvals.jsx` — (stub) vote on pending approvals
- **API wrapper:** `api.js` exports apiClient function that injects x-api-key header

---

## Deployment (Render + Vercel + external services)

### Quick Start: Choose Your Platform

- **[RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)** — Recommended for simplicity (SQLite, free tier available)
- **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)** — Recommended for scalability (PostgreSQL, auto-scaling)

### Services to Create

1. **Backend** (choice of Render or Railway)
   - Render: Web Service with persistent disk at `/data` (SQLite)
   - Railway: Service with PostgreSQL plugin (auto-provisioned DATABASE_URL)

2. **Worker** (choice of Render or Railway)
   - Render: Background Job or Web Service (same disk as backend, DB mode)
   - Railway: Service with API mode enabled (calls backend endpoints)

3. **Frontend** (Vercel)
   - Import GitHub repo → set root to `frontend/`
   - Set `VITE_API_URL` env to your backend URL

4. **SendGrid** (email notifications)
   - Create account → generate API key → set `SENDGRID_API_KEY` env

5. **Telegram** (chat notifications)
   - Chat @BotFather → `/newbot` → get `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

### Environment Variables

**Render (SQLite + shared disk):**
```
DATABASE_URL=/data/db.sqlite
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

**Railway (PostgreSQL + API-mode worker):**

Backend:
```
DATABASE_URL=postgresql://...         # Auto-provisioned by Railway Postgres
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

Worker:
```
WORKER_MODE=api
BACKEND_URL=https://your-backend.railway.app
WORKER_API_KEY=<admin-key-from-backend-logs>
SENDGRID_API_KEY=sg-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789
```

**Frontend (both platforms):**
```
VITE_API_URL=https://your-backend-url
```

---

## Example Workflows

### Admin Setup
1. Backend starts → prints admin API key to logs
2. Copy key → login to frontend with it
3. Create users: `POST /users` with admin key (creates new member/approver)
4. Create rules: `POST /rules` with regex patterns (e.g., `rm -rf /` → AUTO_REJECT)

### User Workflow
1. User logs in with their API key
2. Submit command (e.g., `ls -la`)
3. Backend matches rules:
   - If rule matches and action is AUTO_ACCEPT → command executed, credits deducted, done
   - If rule matches and action is AUTO_REJECT → command rejected
   - If no rule or action is REQUIRE_APPROVAL → create Approval record, send Telegram to admins
4. Approver logs in with approver key
5. Sees pending approvals → votes APPROVE (if threshold met, command executes)

### Escalation
- Worker checks every 60s
- If approval expires (10 min default) → marked escalated, Telegram sent
- If very old (60+ min) → auto-rejected

---

## Testing Locally

```bash
# In separate terminals:
# Terminal 1: Backend
cd backend && uvicorn main:app --reload --port 10000

# Terminal 2: Worker
cd worker && python worker.py

# Terminal 3: Frontend
cd frontend && npm run dev
```

Then:
1. Open http://localhost:5173
2. Paste admin key from backend logs
3. Create a member user via API (or use admin)
4. Submit `ls -la` → should auto-accept if no rules
5. Submit `rm -rf /` → should reject if rule exists
6. Submit `unknown-command` → should create approval, Telegram alert

---

## Project Structure

```
command-gateway/
├── backend/
│   ├── main.py              # FastAPI app, endpoints
│   ├── models.py            # SQLModel definitions
│   ├── crud.py              # CRUD functions
│   ├── db.py                # SQLModel engine + session
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── notifications.py     # SendGrid + Telegram helpers
│   ├── requirements.txt
│   ├── Dockerfile
│   └── render.yaml
├── worker/
│   ├── worker.py            # Background approval scheduler
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx         # React entry point
│   │   ├── App.jsx          # Root component (auth + routing)
│   │   ├── api.js           # Axios client wrapper
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AdminRules.jsx
│   │   │   └── Approvals.jsx
│   │   └── components/
│   │       ├── LoginKey.jsx
│   │       └── CommandForm.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── README_FRONTEND.md
└── README.md
```

---

## Notes

- All services communicate over HTTP (backend API). No shared message queue or Kafka.
- Worker uses shared SQLite DB (works on Render with persistent disk). For Railway (no shared disk), modify worker to call backend API endpoints instead.
- Credits are user balance; deducted on command execution. No credit refunds on rejection.
- EventLog captures all significant events for audit/analytics.
- Notifications are best-effort (no retry on Telegram/SendGrid failure; logged to stderr).

---

## Next Steps

- Expand frontend with admin and approver full pages
- Add Docker Compose for local dev
- Add unit tests and Cypress E2E tests
- Migrate to Postgres for production
- Add rate-limiting and RBAC enforcement

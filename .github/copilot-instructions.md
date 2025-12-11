# Command Gateway — AI Agent Instructions

## Quick Context

**Command Gateway** is a three-service FastAPI + React system for controlled command execution with approval workflows. A single monorepo with three deployable services: `backend/` (FastAPI API), `worker/` (approval scheduler), `frontend/` (React SPA).

**Core idea:** Users submit commands → rules evaluate them (regex-based) → either auto-accept, auto-reject, or require multi-approver voting → execute and deduct credits.

---

## Architecture Overview (The "Why")

### Three-Service Design
- **Backend** (`backend/main.py`): REST API, all business logic, supports SQLite (Render) or PostgreSQL (Railway)
- **Worker** (`worker/worker.py`): Async background job that checks expiring approvals every 60s, escalates/rejects them
  - **Shared DB mode**: reads SQLite directly from Render's persistent disk
  - **API mode**: calls backend HTTP endpoints (Railway, no shared disk)
- **Frontend** (`frontend/src/`): React SPA, minimal login + command submission + history view

**Key design choice:** Backend auto-detects database URL (SQLite vs PostgreSQL). Worker defaults to API mode but can use shared DB mode on Render.

### Command Execution Flow
1. User submits command via `POST /commands` with API key
2. Backend matches command text against **Rule** patterns (regex, ordered by priority)
3. Rule's action determines outcome:
   - **AUTO_ACCEPT** → immediately execute, deduct credits, log event, send email notification
   - **AUTO_REJECT** → mark rejected, log event
   - **REQUIRE_APPROVAL** → create Approval record with threshold (default 2), send email notification
4. If pending approval: approvers vote via `POST /approvals/{id}/vote`
   - Once threshold votes reached → execute command, mark approval resolved
   - If threshold rejections reached → mark rejected
5. All actions logged to **EventLog** table (audit trail)

### Data Model (SQLModel)
- **User**: api_key, role (admin/member/approver), seniority (junior/mid/senior/lead), credits (balance)
- **Rule**: pattern (regex), action, priority, threshold (votes needed), time-based activation (active_hours_start/end)
- **Command**: user_id, command_text, status (SUBMITTED/EXECUTED/REJECTED), result, rule_triggered
- **Approval**: command_id, requested_by, threshold_required, expires_at (10 min default), escalated, resolved
- **ApprovalVote**: approval_id, approver_id, vote (APPROVE/REJECT)
- **EventLog**: event_type (string), user_id, details — for audit/analytics

---

## Critical Developer Workflows

### Local Development (Quickstart)
```powershell
# Terminal 1: Backend (Windows PowerShell)
cd backend
pip install -r requirements.txt
$env:DATABASE_URL = "./db.sqlite"
uvicorn main:app --reload --port 10000
# Prints admin API key to console on startup — copy it

# Terminal 2: Worker
cd worker
pip install -r requirements.txt
$env:DATABASE_URL = "../backend/db.sqlite"
python worker.py

# Terminal 3: Frontend
cd frontend
npm install
$env:VITE_API_URL = "http://localhost:10000"
npm run dev
# Open http://localhost:5173, paste admin key
```

### Deployment (Render + Vercel)
1. **Backend**: Render Web Service, set root to `backend/`, attach 1GB persistent disk at `/data`, mount `DATABASE_URL=/data/db.sqlite`
2. **Worker**: Render background job or service, same disk, same env
3. **Frontend**: Vercel, root `frontend/`, set `VITE_API_URL` env to backend URL
4. **External services**: Create SendGrid account (email), set env vars

### Deployment (Railway + Vercel) — Alternative
Railway does NOT provide persistent disk sharing, so use API-mode worker instead:
1. **Backend**: Railway Service, set root to `backend/`, attach PostgreSQL plugin (auto-provisions `DATABASE_URL`)
2. **Worker**: Railway Service, set root to `worker/`, set `WORKER_MODE=api`, `BACKEND_URL=<backend-url>`, `WORKER_API_KEY=<admin-key>`
3. **Frontend**: Vercel, root `frontend/`, set `VITE_API_URL=https://your-backend.railway.app`
4. **External services**: SendGrid (email notifications)

**Env vars to configure:**

**Render (SQLite):**
```
DATABASE_URL=/data/db.sqlite
SENDGRID_API_KEY=...
```

**Railway (PostgreSQL + API-mode worker):**

Backend:
```
DATABASE_URL=postgresql://user:pass@host:port/db  # Auto-provisioned by Railway's Postgres plugin
SENDGRID_API_KEY=...
```

Worker:
```
WORKER_MODE=api
BACKEND_URL=https://your-backend.railway.app
WORKER_API_KEY=<copy-admin-key-from-backend-startup>
SENDGRID_API_KEY=...
```

### Testing Workflows
- **Submit safe command** (e.g., `ls -la`): expect auto-accept if no rules, or approval request if REQUIRE_APPROVAL rule
- **Submit dangerous command** (e.g., `rm -rf /`): expect auto-reject if AUTO_REJECT rule exists
- **Voting**: approver votes APPROVE → command executes if threshold met
- **Escalation**: approval not resolved in 10 min → worker marks escalated, email alert; after 60 min → auto-rejected

---

## Project-Specific Conventions & Patterns

### Authentication & Authorization
- **x-api-key header** required on all endpoints (except GET /docs for Swagger)
- API key injected via FastAPI dependency `get_current_user` — extracts from header, validates in User table
- **Role-based:** admin (create users/rules), approver (vote), member (submit commands)
- **Seniority:** junior/mid/senior/lead — used for potential time-based or approval escalation (not fully implemented in voting yet, but stored in model)

### Rule Matching Logic (`crud.py::match_rule`)
- Rules ordered by **priority** (lower number = higher priority)
- Regex patterns compiled and tested against command text
- **Time-based override:** if rule has `active_hours_start` and `active_hours_end`, action becomes REQUIRE_APPROVAL outside those hours
- Returns first matching rule; if no match, default to REQUIRE_APPROVAL (conservative)

### Credit System
- Users start with 100 credits
- Each **executed** command deducts 1 credit (AUTO_ACCEPT or approved REQUIRE_APPROVAL)
- Rejection (AUTO_REJECT or approval threshold reached for rejection) does NOT deduct credits
- Commands fail if user has ≤ 0 credits (returns 402 Payment Required)

### Notification Strategy
- **SendGrid**: email notifications via aiohttp, fire-and-forget pattern (no retry logic)
- Notifications are **non-blocking** — failures logged to stderr, don't block API response

### Database & Sessions
- SQLModel + SQLite; each API endpoint opens its own `Session` scope (via generator in `db.py::get_session`)
- **No connection pooling configured** (fine for SQLite; if migrating to Postgres, add pool settings)
- Transactions handled implicitly by session scope (commit at end of block)

### Event Logging Pattern
- Every significant action creates an **EventLog** entry: COMMAND_SUBMITTED, COMMAND_EXECUTED, COMMAND_REJECTED, APPROVAL_REQUEST_CREATED, APPROVAL_GRANTED, APPROVAL_REJECTED, APPROVAL_ESCALATED, etc.
- Used for audit trail and future analytics; query example: `session.exec(select(EventLog).order_by(EventLog.created_at.desc()))`

### Frontend SPA Pattern
- **Single apiClient instance** per page (via `apiClient(apiKey)` function in `api.js`)
- All API calls routed through axios with x-api-key header pre-configured
- **State management:** React hooks (useState/useEffect) in each page; no Redux/Zustand
- **Local storage:** API key persisted in localStorage (lost on browser clear)

---

## Integration Points & Dependencies

### Backend → External APIs
- **SendGrid API** (`notifications.py::send_email`): POST to `https://api.sendgrid.com/v3/mail/send` with Bearer token
- Async via aiohttp, fire-and-forget pattern (no retry logic)

### Frontend → Backend API
- Base URL: `import.meta.env.VITE_API_URL` (env var) or default `http://localhost:10000`
- All endpoints require `x-api-key` header (injected by axios client)
- Endpoints:
  - `POST /users` (admin) → create user, return api_key
  - `GET /rules`, `POST /rules` (admin) → list/create approval rules
  - `POST /commands` → submit command (triggers rule matching)
  - `GET /commands` → list user's commands (or all if admin)
  - `POST /approvals/{id}/vote` (approver/admin) → vote on pending approval

### Worker → Database
- Same SQLite file as backend (shared disk on Render)
- Reads Approval table every 60s, updates escalated/resolved flags
- Could be refactored to call backend API instead (POST /approvals/{id}/escalate, etc.) for multi-instance deployments

---

## Key Files to Understand

| File | Purpose | Key Functions/Classes |
|------|---------|----------------------|
| `backend/main.py` | FastAPI app, all endpoints | `api_submit_command()` (rule matching → action), `api_vote()` (approval voting), `get_current_user()` (auth) |
| `backend/crud.py` | Business logic | `match_rule()` (regex priority matching), `add_rule()` (conflict detection), `create_command()` (event logging) |
| `backend/models.py` | Data schema | User, Rule, Command, Approval, ApprovalVote, EventLog |
| `backend/notifications.py` | Email notifications | `send_email()` (async) |
| `worker/worker.py` | Approval scheduler | `check_approvals()` (escalation/timeout logic) |
| `frontend/src/api.js` | API client | `apiClient(apiKey)` — axios instance with x-api-key header |
| `frontend/src/App.jsx` | Auth routing | login → dashboard swap |
| `frontend/src/pages/Dashboard.jsx` | Main UI | command submission + history |

---

## Common Patterns When Making Changes

### Adding a New Endpoint
1. Define **Pydantic schema** in `schemas.py` (request/response)
2. Add **CRUD function** in `crud.py` if needed
3. Add **route** in `main.py` with `@app.post("/path")` or similar
4. Use `get_current_user` dependency for auth
5. **Test locally**: hit endpoint via curl or frontend form

### Modifying Rule Matching
- Edit `crud.py::match_rule()` function
- Remember: rules ordered by priority, first match wins
- Time-based override happens inside this function (check active_hours)
- To add new rule properties: update Rule model in `models.py`, add fields to CreateRule schema

### Adding Notifications
- Use async functions in `notifications.py::send_email()`
- Call via `asyncio.create_task()` in `main.py` endpoints (non-blocking)
- Fire-and-forget pattern (no await, no retry logic)

### Extending Worker Logic
- Edit `worker/worker.py::check_approvals()` async function
- Runs every 60s (configurable in `main_loop()`)
- Create new EventLog entries for significant state changes
- Consider: if no shared DB, refactor to call backend API instead

---

## Gotchas & Production Considerations

1. **SQLite in production:** Fine for small deployments on Render (with persistent disk); for Railway or heavy load, migrate to Postgres (auto-provided by Railway)
2. **Worker deployment:**
   - **Render**: Use shared DB mode (`WORKER_MODE=db` or omitted) with persistent disk
   - **Railway**: Use API mode (`WORKER_MODE=api`) since no shared disk; requires `BACKEND_URL` and `WORKER_API_KEY` env vars
3. **Database URL format:**
   - Render SQLite: `DATABASE_URL=/data/db.sqlite` (local path)
   - Railway Postgres: `DATABASE_URL=postgresql://...` (auto-provisioned, backend auto-converts to psycopg2 driver)
4. **No rate limiting:** Add `slowapi` or similar if expecting abuse
5. **API key rotation:** No built-in rotation; admins must manually update User.api_key in DB
6. **Time-based rules:** Logic is simple string comparison ("09:00" ≤ HH:MM ≤ "18:00"); no timezone support
7. **Conflict detection:** Currently checks if two rules both match "rm -rf /" test string; not exhaustive
8. **Email notifications best-effort:** Failed SendGrid calls don't block API or retry; check logs for failures
9. **EventLog unbounded:** No pruning; table grows with every action (consider periodic cleanup for long-running instances)

---

## When Stuck

- **Backend errors?** Check `backend/main.py` for try/except blocks; most errors return HTTPException with detail
- **Worker not running?** Ensure `DATABASE_URL` points to same DB as backend; check `worker.py` imports (models, notifications in same dir or symlinked)
- **Frontend can't reach backend?** Verify `VITE_API_URL` env var is set correctly; check browser console for CORS issues
- **Rules not matching?** Test regex pattern in Python: `import re; re.search(pattern, command_text)`
- **Approval not executing?** Check ApprovalVote count; ensure threshold is met; verify user has credits

---

## Example Task: Add a Seniority Override to Rules

1. **Model change** (`models.py`): already exists as `seniority_overrides` (JSON string)
2. **Parsing** (`crud.py::add_rule`): parse JSON, validate seniority levels
3. **Matching logic** (`crud.py::match_rule`): if rule has seniority override, check current user's seniority and modify action/threshold
4. **Frontend** (`AdminRules.jsx`): add form field for seniority overrides
5. **Schema** (`schemas.py`): add optional `seniority_overrides` dict to CreateRule
6. **Test**: create rule with override, submit command as user with different seniority, verify action changes

---

## Quick Reference: Local Dev Commands

```powershell
# Windows PowerShell
cd backend; $env:DATABASE_URL="./db.sqlite"; uvicorn main:app --reload
cd worker; $env:DATABASE_URL="../backend/db.sqlite"; python worker.py
cd frontend; $env:VITE_API_URL="http://localhost:10000"; npm run dev
```

**Deployment:**
- Render: push to GitHub → Render auto-detects `backend/Dockerfile` (or `render.yaml`), builds & deploys
- Vercel: push → detect `frontend/package.json`, build & deploy
- Worker: Render background job or second service with same disk

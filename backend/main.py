# main.py
import uvicorn, os, secrets, json
from fastapi import FastAPI, Depends, HTTPException, Header
from db import init_db, get_session
from sqlmodel import Session
from crud import get_user_by_api_key, create_user, add_rule, match_rule, create_command
from schemas import CreateUser, CreateRule, SubmitCommand
from models import User, Rule, Command, Approval, ApprovalVote, EventLog
from datetime import datetime, timedelta
from notifications import send_telegram, send_email
from typing import Optional
from sqlmodel import select

app = FastAPI(title="Command Gateway API")

@app.on_event("startup")
def on_startup():
    init_db()
    # create default admin if none exist
    with next(get_session()) as session:
        if not session.exec(select(User).where(User.role=="admin")).first():
            key = secrets.token_hex(16)
            u = create_user(session, name="admin", api_key=key, role="admin", seniority="lead")
            print("Created default admin. API key:", u.api_key)

# dependency to get user from API key
def get_current_user(x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing x-api-key")
    with next(get_session()) as session:
        user = get_user_by_api_key(session, x_api_key)
        if not user:
            raise HTTPException(status_code=403, detail="Invalid API key")
        return user

@app.post("/users")
def api_create_user(payload: CreateUser, admin: User = Depends(get_current_user)):
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create users")
    api_key = secrets.token_hex(16)
    with next(get_session()) as session:
        u = create_user(session, payload.name, api_key, role=payload.role, seniority=payload.seniority)
        return {"api_key": u.api_key, "user_id": u.id}

@app.get("/rules")
def api_list_rules(user: User = Depends(get_current_user)):
    with next(get_session()) as session:
        rules = session.exec(select(Rule).order_by(Rule.priority)).all()
        return rules

@app.post("/rules")
def api_create_rule(payload: CreateRule, admin: User = Depends(get_current_user)):
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create rules")
    with next(get_session()) as session:
        try:
            rule, conflicts = add_rule(session, payload.pattern, payload.action,
                                       priority=payload.priority, threshold=payload.threshold,
                                       active_hours_start=payload.active_hours_start,
                                       active_hours_end=payload.active_hours_end,
                                       created_by=admin.id)
            res = {"rule": rule}
            if conflicts:
                res["conflicts"] = [{"id": c.id, "pattern": c.pattern, "action": c.action} for c in conflicts]
            return res
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

@app.post("/commands")
def api_submit_command(cmd: SubmitCommand, user: User = Depends(get_current_user)):
    with next(get_session()) as session:
        # ensure credits
        if user.credits <= 0:
            raise HTTPException(status_code=402, detail="No credits")
        # create record
        command = create_command(session, user, cmd.command_text)
        # match rule
        r, action = match_rule(session, cmd.command_text, datetime.utcnow())
        if not r:
            # default to require approval for unknown
            action = "REQUIRE_APPROVAL"
        # handle actions
        if action == "AUTO_REJECT":
            command.status = "REJECTED"
            session.add(command)
            session.commit()
            session.add(EventLog(event_type="COMMAND_REJECTED", user_id=user.id, details=cmd.command_text))
            session.commit()
            return {"status": "rejected", "reason": "dangerous command"}
        elif action == "AUTO_ACCEPT":
            # deduct credits and mock execute - all inside transaction
            try:
                user.credits -= 1
                command.status = "EXECUTED"
                command.result = f"[MOCK EXECUTION] Would run: {cmd.command_text}"
                command.executed_at = datetime.utcnow()
                command.rule_triggered = r.id if r else None
                session.add(user); session.add(command)
                session.add(EventLog(event_type="COMMAND_EXECUTED", user_id=user.id, details=cmd.command_text))
                session.commit()
                # notify via telegram
                try:
                    import asyncio
                    asyncio.create_task(send_telegram(f"Command executed by {user.name}: {cmd.command_text}"))
                except:
                    pass
                return {"status": "executed", "new_balance": user.credits, "result": command.result}
            except Exception as e:
                session.rollback()
                raise HTTPException(status_code=500, detail=str(e))
        else:
            # REQUIRE_APPROVAL -> create approval record
            threshold = r.threshold if r and r.threshold else 2
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            approval = Approval(command_id=command.id, requested_by=user.id,
                                threshold_required=threshold, expires_at=expires_at)
            session.add(approval)
            session.add(EventLog(event_type="APPROVAL_REQUEST_CREATED", user_id=user.id, details=str(command.id)))
            session.commit()
            # notify (worker will handle notifications too)
            try:
                import asyncio
                asyncio.create_task(send_telegram(f"Approval required for command {command.id}: {cmd.command_text}"))
            except:
                pass
            return {"status": "pending_approval", "approval_id": approval.id}

@app.get("/commands")
def api_list_commands(user: User = Depends(get_current_user)):
    with next(get_session()) as session:
        if user.role == "admin":
            results = session.exec(select(Command).order_by(Command.created_at.desc())).all()
        else:
            results = session.exec(select(Command).where(Command.user_id==user.id).order_by(Command.created_at.desc())).all()
        return results

@app.post("/approvals/{approval_id}/vote")
def api_vote(approval_id: int, vote: str, user: User = Depends(get_current_user)):
    if user.role not in ("admin", "approver"):
        raise HTTPException(status_code=403, detail="Not an approver")
    with next(get_session()) as session:
        appr = session.get(Approval, approval_id)
        if not appr or appr.resolved:
            raise HTTPException(status_code=404, detail="Approval not found or resolved")
        av = ApprovalVote(approval_id=approval_id, approver_id=user.id, vote=vote)
        session.add(av); session.commit()
        # count votes
        votes = session.exec(select(ApprovalVote).where(ApprovalVote.approval_id==approval_id)).all()
        approves = len([v for v in votes if v.vote=="APPROVE"])
        rejects = len([v for v in votes if v.vote=="REJECT"])
        if approves >= appr.threshold_required:
            # finalize: execute command
            cmd = session.get(Command, appr.command_id)
            u = session.get(User, cmd.user_id)
            if u.credits <= 0:
                appr.resolved = True
                session.add(appr); session.add(EventLog(event_type="COMMAND_REJECTED", user_id=u.id, details="No credits"))
                session.commit()
                return {"status":"failed","reason":"no credits"}
            u.credits -= 1
            cmd.status = "EXECUTED"
            cmd.result = f"[MOCK EXECUTION - APPROVED] by {user.name}"
            cmd.executed_at = datetime.utcnow()
            appr.resolved = True
            session.add(u); session.add(cmd); session.add(appr)
            session.add(EventLog(event_type="APPROVAL_GRANTED", user_id=user.id, details=str(cmd.id)))
            session.commit()
            try:
                import asyncio
                asyncio.create_task(send_telegram(f"Approval granted for command {cmd.id}"))
            except:
                pass
            return {"status":"executed", "new_balance": u.credits}
        elif rejects >= appr.threshold_required:
            appr.resolved = True
            session.add(appr); session.add(EventLog(event_type="APPROVAL_REJECTED", user_id=user.id, details=str(appr.command_id)))
            session.commit()
            return {"status":"rejected"}
        else:
            return {"status":"pending", "approves": approves, "rejects": rejects}

@app.get("/approvals/pending")
def api_get_pending_approvals(worker: User = Depends(get_current_user)):
    """Worker endpoint: fetch all pending approvals for escalation/timeout handling."""
    if worker.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin/worker can access this")
    with next(get_session()) as session:
        approvals = session.exec(select(Approval).where(Approval.resolved == False)).all()
        return [
            {
                "id": a.id,
                "command_id": a.command_id,
                "expires_at": a.expires_at.isoformat(),
                "escalated": a.escalated,
                "resolved": a.resolved,
                "threshold_required": a.threshold_required
            }
            for a in approvals
        ]

@app.post("/approvals/{approval_id}/escalate")
def api_escalate_approval(approval_id: int, worker: User = Depends(get_current_user)):
    """Worker endpoint: mark approval as escalated."""
    if worker.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin/worker can access this")
    with next(get_session()) as session:
        appr = session.get(Approval, approval_id)
        if not appr:
            raise HTTPException(status_code=404, detail="Approval not found")
        appr.escalated = True
        session.add(appr)
        session.add(EventLog(event_type="APPROVAL_ESCALATED", user_id=appr.requested_by, details=str(appr.command_id)))
        session.commit()
        return {"status": "escalated"}

@app.post("/approvals/{approval_id}/auto-reject")
def api_auto_reject_approval(approval_id: int, worker: User = Depends(get_current_user)):
    """Worker endpoint: auto-reject approval due to timeout."""
    if worker.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin/worker can access this")
    with next(get_session()) as session:
        appr = session.get(Approval, approval_id)
        if not appr:
            raise HTTPException(status_code=404, detail="Approval not found")
        appr.resolved = True
        session.add(appr)
        session.add(EventLog(event_type="APPROVAL_AUTO_REJECTED", user_id=appr.requested_by, details=str(appr.command_id)))
        session.commit()
        return {"status": "auto-rejected"}


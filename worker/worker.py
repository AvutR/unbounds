# worker.py
# Worker scheduler for approval escalation and timeout handling.
# Supports two modes:
# 1. DB mode (Render with persistent disk): reads SQLite/Postgres directly
# 2. API mode (Railway, multi-instance): calls backend endpoints (DEFAULT)
#
# Set WORKER_MODE=db to use shared DB mode
# Set WORKER_MODE=api (or omit) to use API mode (Railway compatible)

import os
import asyncio
from datetime import datetime, timedelta

WORKER_MODE = os.environ.get("WORKER_MODE", "api").lower()

if WORKER_MODE == "db":
    # Shared DB mode (Render with persistent disk)
    from sqlmodel import Session, select
    from sqlmodel import SQLModel, create_engine
    from models import Approval, ApprovalVote, Command, User, EventLog
    
    DB = os.environ.get("DATABASE_URL", "/data/db.sqlite")
    if DB.startswith("sqlite"):
        engine = create_engine(DB, connect_args={"check_same_thread": False})
    elif DB.startswith("postgresql"):
        db_url = DB.replace("postgresql://", "postgresql+psycopg2://") if "psycopg2" not in DB else DB
        engine = create_engine(db_url, echo=False, pool_pre_ping=True)
    else:
        engine = create_engine(DB, echo=False, pool_pre_ping=True)
    
    async def check_approvals():
        with Session(engine) as session:
            now = datetime.utcnow()
            pending = session.exec(select(Approval).where(Approval.resolved == False)).all()
            for p in pending:
                if p.expires_at <= now and not p.escalated:
                    p.escalated = True
                    session.add(p)
                    session.add(EventLog(event_type="APPROVAL_ESCALATED", user_id=p.requested_by, details=str(p.command_id)))
                    session.commit()
            # Auto-reject very old approvals (60+ min)
            long_pending = session.exec(select(Approval).where(Approval.resolved==False).where(Approval.expires_at <= now - timedelta(minutes=60))).all()
            for lp in long_pending:
                lp.resolved = True
                session.add(lp)
                session.add(EventLog(event_type="APPROVAL_AUTO_REJECTED", user_id=lp.requested_by, details=str(lp.command_id)))
                session.commit()

else:
    # API mode (Railway, multi-instance) - default
    import aiohttp
    
    BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:10000")
    WORKER_API_KEY = os.environ.get("WORKER_API_KEY", "")
    
    if not WORKER_API_KEY:
        raise ValueError("WORKER_API_KEY env var required for API mode. Set it to an admin API key.")
    
    async def check_approvals():
        """Query backend API for pending approvals and handle escalation/timeout."""
        async with aiohttp.ClientSession() as session:
            headers = {"x-api-key": WORKER_API_KEY}
            try:
                # Get pending approvals from backend
                async with session.get(f"{BACKEND_URL}/approvals/pending", headers=headers) as resp:
                    if resp.status != 200:
                        print(f"Failed to fetch pending approvals: {resp.status}")
                        return
                    approvals = await resp.json()
                
                now = datetime.utcnow()
                
                for appr in approvals:
                    expires_at = datetime.fromisoformat(appr["expires_at"])
                    
                    # Escalate if expired and not already escalated
                    if expires_at <= now and not appr.get("escalated"):
                        async with session.post(
                            f"{BACKEND_URL}/approvals/{appr['id']}/escalate",
                            headers=headers
                        ) as resp:
                            if resp.status == 200:
                                pass
                    
                    # Auto-reject if very old (60+ min past expiry)
                    if expires_at <= now - timedelta(minutes=60) and not appr.get("resolved"):
                        async with session.post(
                            f"{BACKEND_URL}/approvals/{appr['id']}/auto-reject",
                            headers=headers
                        ) as resp:
                            if resp.status == 200:
                                pass
            
            except Exception as e:
                print(f"Worker API error: {e}")

async def main_loop():
    while True:
        try:
            await check_approvals()
        except Exception as e:
            print("Worker error:", e)
        await asyncio.sleep(60)

if __name__ == "__main__":
    asyncio.run(main_loop())

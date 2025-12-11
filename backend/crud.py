# crud.py
from sqlmodel import select
from models import User, Rule, Command, Approval, ApprovalVote, EventLog
from db import get_session
from sqlmodel import Session
from datetime import datetime, timedelta
import re, json

def get_user_by_api_key(session: Session, api_key: str):
    return session.exec(select(User).where(User.api_key == api_key)).first()

def create_user(session: Session, name: str, api_key: str, role="member", seniority="mid"):
    user = User(name=name, api_key=api_key, role=role, seniority=seniority)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def list_rules(session: Session):
    return session.exec(select(Rule).order_by(Rule.priority)).all()

def add_rule(session: Session, pattern: str, action: str, priority: int = 100, **kwargs):
    # validate regex
    try:
        re.compile(pattern)
    except re.error as e:
        raise ValueError(f"Invalid regex: {e}")
    rule = Rule(pattern=pattern, action=action, priority=priority,
                threshold=kwargs.get("threshold"),
                seniority_overrides=json.dumps(kwargs.get("seniority_overrides") or {}),
                active_hours_start=kwargs.get("active_hours_start"),
                active_hours_end=kwargs.get("active_hours_end"),
                created_by=kwargs.get("created_by"))
    session.add(rule)
    session.commit()
    session.refresh(rule)
    # do conflict detection (simple)
    conflicts = []
    for r in session.exec(select(Rule).where(Rule.id != rule.id)).all():
        # quick heuristic: test if patterns match same examples (not exhaustive)
        try:
            if re.search(r.pattern, "rm -rf /") and re.search(rule.pattern, "rm -rf /"):
                conflicts.append(r)
        except:
            pass
    return rule, conflicts

def match_rule(session: Session, command_text: str, nowtime, user = None):
    """Match command against rules in priority order.
    
    Args:
        session: DB session
        command_text: Command to match
        nowtime: Current datetime for time-based rules
        user: Current user (optional, for seniority overrides)
    
    Returns:
        (rule, action) tuple where action may be overridden by seniority or time
    """
    rules = list_rules(session)
    for r in rules:
        try:
            if re.search(r.pattern, command_text):
                action = r.action
                
                # Time-based override: outside active hours -> REQUIRE_APPROVAL
                if r.active_hours_start and r.active_hours_end:
                    start = r.active_hours_start
                    end = r.active_hours_end
                    hhmm = nowtime.strftime("%H:%M")
                    if not (start <= hhmm <= end):
                        action = "REQUIRE_APPROVAL"
                
                # Seniority-based override: adjust threshold or action
                if user and r.seniority_overrides:
                    try:
                        overrides = json.loads(r.seniority_overrides)
                        if user.seniority in overrides:
                            override = overrides[user.seniority]
                            # Override can specify: action, threshold, or both
                            if "action" in override:
                                action = override["action"]
                            # Store adjusted threshold on rule object (temp)
                            if "threshold" in override:
                                r.threshold = override["threshold"]
                    except json.JSONDecodeError:
                        pass
                
                return r, action
        except Exception:
            continue
    return None, None

def create_command(session: Session, user: User, command_text: str):
    cmd = Command(user_id=user.id, command_text=command_text)
    session.add(cmd)
    session.commit()
    session.refresh(cmd)
    session.add(EventLog(event_type="COMMAND_SUBMITTED", user_id=user.id, details=command_text))
    session.commit()
    return cmd

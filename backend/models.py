# models.py
from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, List
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    api_key: str
    role: str = "member"   # admin, member, approver
    seniority: str = "mid" # junior, mid, senior, lead
    credits: int = 100
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Rule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pattern: str
    action: str  # AUTO_ACCEPT | AUTO_REJECT | REQUIRE_APPROVAL
    priority: int = 100
    threshold: Optional[int] = None
    seniority_overrides: Optional[str] = None  # JSON string storing mapping
    active_hours_start: Optional[str] = None  # "09:00"
    active_hours_end: Optional[str] = None    # "18:00"
    created_by: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Command(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    command_text: str
    status: str = "SUBMITTED"
    result: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    executed_at: Optional[datetime] = None
    rule_triggered: Optional[int] = None
    replayable: bool = True

class Approval(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    command_id: int
    requested_by: int
    threshold_required: int
    expires_at: datetime
    escalated: bool = False
    resolved: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ApprovalVote(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    approval_id: int
    approver_id: int
    vote: str  # APPROVE or REJECT
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EventLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str
    user_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

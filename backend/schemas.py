# schemas.py
from pydantic import BaseModel
from typing import Optional, Dict, Any

class CreateUser(BaseModel):
    name: str
    role: Optional[str] = "member"
    seniority: Optional[str] = "mid"

class CreateRule(BaseModel):
    pattern: str
    action: str
    priority: Optional[int] = 100
    threshold: Optional[int] = None
    active_hours_start: Optional[str] = None
    active_hours_end: Optional[str] = None
    seniority_overrides: Optional[Dict[str, Any]] = None

class SubmitCommand(BaseModel):
    command_text: str

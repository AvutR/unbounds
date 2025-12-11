#!/usr/bin/env python3
"""
Seed initial rules into the database.
Run this after the backend starts: python seed_rules.py
"""

import os
import sys
from sqlmodel import Session, select, create_engine
from models import Rule, User
from db import get_engine

# Rules to seed
RULES = [
    {
        "name": "Block fork bomb",
        "pattern": r":\(\)\{\ :\|:\&\ \}\;:",
        "action": "AUTO_REJECT",
        "priority": 1,
        "threshold": 2,
    },
    {
        "name": "Block rm -rf /",
        "pattern": r"rm\s+-rf\s+/",
        "action": "AUTO_REJECT",
        "priority": 2,
        "threshold": 2,
    },
    {
        "name": "Block mkfs commands",
        "pattern": r"mkfs\.",
        "action": "AUTO_REJECT",
        "priority": 3,
        "threshold": 2,
    },
    {
        "name": "Auto-accept git operations",
        "pattern": r"git\s+(status|log|diff)",
        "action": "AUTO_ACCEPT",
        "priority": 10,
        "threshold": 1,
    },
    {
        "name": "Auto-accept safe read commands",
        "pattern": r"^(ls|cat|pwd|echo)",
        "action": "AUTO_ACCEPT",
        "priority": 11,
        "threshold": 1,
    },
]


def seed_rules():
    """Insert seed rules into the database."""
    engine = get_engine()
    
    with Session(engine) as session:
        # Check if rules already exist
        existing_rules = session.exec(select(Rule)).all()
        if existing_rules:
            print(f"⚠️  {len(existing_rules)} rules already exist. Skipping seeding.")
            return
        
        # Insert rules
        for rule_data in RULES:
            rule = Rule(**rule_data)
            session.add(rule)
            print(f"✅ Added rule: {rule.name}")
        
        session.commit()
        print(f"\n🎉 Successfully seeded {len(RULES)} rules!")


if __name__ == "__main__":
    try:
        seed_rules()
    except Exception as e:
        print(f"❌ Error seeding rules: {e}")
        sys.exit(1)

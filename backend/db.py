# db.py
from sqlmodel import SQLModel, create_engine, Session
import os

# Support both SQLite (local dev, Render) and PostgreSQL (Railway)
DB_URL = os.environ.get("DATABASE_URL")

if not DB_URL:
    # Default to local SQLite for development
    DB_PATH = "./db.sqlite"
    engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
elif DB_URL.startswith("sqlite"):
    # Render with persistent disk
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
elif DB_URL.startswith("postgresql"):
    # Railway: convert postgresql:// to postgresql+psycopg2:// if needed
    db_url = DB_URL.replace("postgresql://", "postgresql+psycopg2://") if "psycopg2" not in DB_URL else DB_URL
    engine = create_engine(db_url, echo=False, pool_pre_ping=True)
else:
    # Fallback to URL as-is
    engine = create_engine(DB_URL, echo=False, pool_pre_ping=True)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

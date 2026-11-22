import os
from datetime import datetime
from pathlib import Path
from sqlalchemy import Boolean, Column, DateTime, Integer, String, create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

# Database configuration.
# The database is used exclusively for user authentication (accounts & sign-in).
# Books, generated audiobooks, covers, and cleaned text are stored locally on the user's device.
_DEFAULT_SQLITE = f"sqlite:///{Path(__file__).resolve().parent.parent / 'storage' / 'bookshelf.db'}"
DATABASE_URL = os.getenv("DATABASE_URL") or _DEFAULT_SQLITE
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

if DATABASE_URL.startswith("sqlite"):
    Path(DATABASE_URL.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=300)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# ==================== DATABASE MODELS ====================

class User(Base):
    """Model for storing user accounts and authentication."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    profile_image = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


# ==================== DATABASE INITIALIZATION ====================

def _ensure_columns():
    """Add columns introduced after the tables were first created (tiny migration)."""
    insp = inspect(engine)
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            col_type = col.type.compile(dialect=engine.dialect)
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}"))
            print(f"  + added column {table.name}.{col.name}")


def init_db():
    """Create auth tables in the database."""
    print(f"Initializing auth database tables ({engine.url.get_backend_name()})...")
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    print("✅ Auth database tables ready!")


def get_db():
    """Dependency for FastAPI to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()

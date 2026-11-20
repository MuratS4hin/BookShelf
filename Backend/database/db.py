import os
from pathlib import Path
from sqlalchemy import create_engine, inspect, text, Column, Integer, String, Text, DateTime, Float, LargeBinary, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

# Database configuration.
# Put DATABASE_URL in Backend/.env (see .env.example) to use PostgreSQL / Neon.
# Without it a local SQLite file is used so the app works out of the box.
_DEFAULT_SQLITE = f"sqlite:///{Path(__file__).resolve().parent.parent / 'storage' / 'bookshelf.db'}"
DATABASE_URL = os.getenv("DATABASE_URL") or _DEFAULT_SQLITE

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

class Book(Base):
    """Model for storing book metadata and information."""
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    author = Column(String(255), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(10), nullable=False)  # pdf, epub
    file_path = Column(String(500), nullable=True)  # Local path or S3 URL
    file_size = Column(Integer, nullable=True)  # Size in bytes
    cover_image = Column(String(500), nullable=True)  # Path to cover image
    description = Column(Text, nullable=True)
    genre = Column(String(100), nullable=True)
    publication_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Book(id={self.id}, title='{self.title}', author='{self.author}')>"


class AudioBook(Base):
    """Model for storing generated audiobook data."""
    __tablename__ = "audiobooks"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Local path or S3 URL
    file_size = Column(Integer, nullable=True)  # Size in bytes
    duration = Column(Float, nullable=True)  # Duration in seconds
    format = Column(String(10), default="mp3", nullable=False)  # mp3, wav, etc.
    speaker_speed = Column(Float, default=0.8, nullable=False)
    generation_status = Column(String(50), default="pending", nullable=False)  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    progress = Column(Float, default=0.0, nullable=True)  # 0..100 while generating
    stage = Column(String(50), nullable=True)  # extracting, cleaning, narrating, encoding
    text_path = Column(String(500), nullable=True)  # cleaned text that was read aloud
    voice = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<AudioBook(id={self.id}, book_id={self.book_id}, status='{self.generation_status}')>"


class Voice(Base):
    """Model for storing voice preferences and settings."""
    __tablename__ = "voices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    language = Column(String(10), nullable=False)  # en_US, etc.
    gender = Column(String(20), nullable=True)  # male, female, neutral
    model_file = Column(String(255), nullable=False)  # Model file name (e.g., en_US-lessac-medium.onnx)
    model_path = Column(String(500), nullable=True)  # Path to model file
    is_default = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Voice(id={self.id}, name='{self.name}', language='{self.language}')>"


class Library(Base):
    """Model for storing user library/reading progress."""
    __tablename__ = "libraries"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String(100), nullable=True)  # For future user management
    current_chapter = Column(Integer, default=0)
    reading_progress = Column(Float, default=0.0)  # Percentage (0-100)
    is_favorite = Column(Boolean, default=False)
    last_read_at = Column(DateTime, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Library(id={self.id}, book_id={self.book_id}, progress={self.reading_progress}%)>"


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
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}'))
            print(f"  + added column {table.name}.{col.name}")


def init_db():
    """Create all tables in the database."""
    print(f"Initializing database tables ({engine.url.get_backend_name()})...")
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    print("✅ Database tables created successfully!")


def get_db():
    """Dependency for FastAPI to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()

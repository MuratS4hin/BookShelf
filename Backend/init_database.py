#!/usr/bin/env python
"""
Database initialization and seeding script for BookShelf application.
"""

import os
from pathlib import Path
from sqlalchemy.orm import Session
from database import SessionLocal, init_db, Voice
from database.services import VoiceService

def init_database():
    """Initialize all database tables."""
    print("=" * 50)
    print("Initializing BookShelf Database")
    print("=" * 50)
    
    try:
        init_db()
        print("✅ Database tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False
    
    return True

def seed_default_voices(db: Session):
    """Seed default voice entries."""
    print("\n" + "=" * 50)
    print("Seeding Default Voices")
    print("=" * 50)
    
    default_voices = [
        {
            "name": "Lessac (English US)",
            "language": "en_US",
            "model_file": "en_US-lessac-medium.onnx",
            "gender": "female",
            "is_default": True,
            "description": "Default English (US) voice using Lessac model"
        },
    ]
    
    try:
        for voice_data in default_voices:
            # Check if voice already exists
            existing = VoiceService.get_voice_by_name(db, voice_data["name"])
            if existing:
                print(f"⏭️  Voice '{voice_data['name']}' already exists. Skipping...")
                continue
            
            voice = VoiceService.create_voice(db=db, **voice_data)
            print(f"✅ Created voice: {voice.name}")
        
        print("✅ Voices seeded successfully!")
    except Exception as e:
        print(f"❌ Error seeding voices: {e}")
        return False
    
    return True

def verify_database():
    """Verify database connectivity and tables."""
    print("\n" + "=" * 50)
    print("Verifying Database")
    print("=" * 50)
    
    try:
        db = SessionLocal()
        
        # Test connection
        db.execute("SELECT 1")
        print("✅ Database connection successful!")
        
        # Count records in each table
        from database import Book, AudioBook, Library
        
        books_count = db.query(Book).count()
        audiobooks_count = db.query(AudioBook).count()
        voices_count = db.query(Voice).count()
        library_count = db.query(Library).count()
        
        print(f"📚 Books: {books_count}")
        print(f"🎵 AudioBooks: {audiobooks_count}")
        print(f"🗣️  Voices: {voices_count}")
        print(f"📖 Library Entries: {library_count}")
        
        db.close()
        return True
    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        return False

def main():
    """Main initialization workflow."""
    print("\n" + "=" * 50)
    print("BookShelf Database Setup")
    print("=" * 50)
    print(f"Database URL: {os.getenv('DATABASE_URL', 'postgresql://localhost/bookshelf_db')}")
    
    # Initialize database tables
    if not init_database():
        print("\n❌ Database initialization failed!")
        return False
    
    # Seed default voices
    db = SessionLocal()
    if not seed_default_voices(db):
        print("\n⚠️  Warning: Voice seeding failed, but database is operational")
    db.close()
    
    # Verify setup
    if not verify_database():
        print("\n❌ Database verification failed!")
        return False
    
    print("\n" + "=" * 50)
    print("✅ Database setup completed successfully!")
    print("=" * 50)
    print("\nYou can now start the application with:")
    print("  python app.py")
    print("\nOr with uvicorn:")
    print("  uvicorn app:app --reload --host 0.0.0.0 --port 8000")
    
    return True

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)

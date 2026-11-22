#!/usr/bin/env python
"""
Database initialization and verification script for BookShelf authentication.
"""

import os
import sys
from sqlalchemy import text
from database import SessionLocal, User, init_db


def init_database():
    """Initialize auth database tables."""
    print("=" * 50)
    print("Initializing BookShelf Auth Database")
    print("=" * 50)

    try:
        init_db()
        print("✅ Auth database tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

    return True


def verify_database():
    """Verify database connectivity and users table."""
    print("\n" + "=" * 50)
    print("Verifying Database")
    print("=" * 50)

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        print("✅ Database connection successful!")

        users_count = db.query(User).count()
        print(f"👤 Users: {users_count}")

        db.close()
        return True
    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        return False


def main():
    """Main initialization workflow."""
    print("\n" + "=" * 50)
    print("BookShelf Auth Database Setup")
    print("=" * 50)
    print(f"Database URL: {os.getenv('DATABASE_URL', 'sqlite:///storage/bookshelf.db')}")

    if not init_database():
        print("\n❌ Database initialization failed!")
        return False

    if not verify_database():
        print("\n❌ Database verification failed!")
        return False

    print("\n" + "=" * 50)
    print("✅ Auth database setup completed successfully!")
    print("=" * 50)
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

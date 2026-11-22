"""
Utility functions for auth database operations.
"""

from sqlalchemy.orm import Session

from .db import User


class DatabaseUtils:
    """Utility functions for auth database operations."""

    @staticmethod
    def get_user_count(db: Session) -> int:
        """Return total number of registered users."""
        return db.query(User).count()

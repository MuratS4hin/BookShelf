import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .db import User

PBKDF2_ITERATIONS = 120_000
DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 3600


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _signing_key() -> bytes:
    secret = os.getenv("AUTH_SECRET")
    if secret:
        return hashlib.sha256(secret.encode("utf-8")).digest()
    fallback = os.getenv("DATABASE_URL") or "bookshelf-dev-secret"
    return hashlib.sha256(fallback.encode("utf-8")).digest()


# ==================== USER SERVICES ====================

class UserService:
    """Service class for User authentication and account operations."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using PBKDF2-HMAC-SHA256 with a random 16-byte salt."""
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            PBKDF2_ITERATIONS,
        ).hex()
        return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password against PBKDF2 or legacy SHA-256 hashes."""
        if not password_hash:
            return False
        if password_hash.startswith("pbkdf2_sha256$"):
            try:
                _, iter_str, salt, expected = password_hash.split("$", 3)
                digest = hashlib.pbkdf2_hmac(
                    "sha256",
                    password.encode("utf-8"),
                    bytes.fromhex(salt),
                    int(iter_str),
                ).hex()
                return hmac.compare_digest(digest, expected)
            except (ValueError, TypeError):
                return False

        # Legacy SHA-256 compatibility for pre-existing Neon accounts.
        legacy_digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy_digest, password_hash)

    @staticmethod
    def create_access_token(user: User, ttl_seconds: int = DEFAULT_TOKEN_TTL_SECONDS) -> str:
        """Mint an HMAC-SHA256 signed bearer token for the authenticated user."""
        now = int(time.time())
        payload = {
            "sub": user.id,
            "email": user.email,
            "iat": now,
            "exp": now + ttl_seconds,
        }
        payload_b64 = _b64url_encode(
            json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        sig = hmac.new(_signing_key(), payload_b64.encode("ascii"), hashlib.sha256).digest()
        return f"{payload_b64}.{_b64url_encode(sig)}"

    @staticmethod
    def verify_access_token(token: str) -> Optional[dict]:
        """Validate token signature and expiration; return decoded payload or None."""
        if not token or "." not in token:
            return None
        try:
            payload_b64, sig_b64 = token.split(".", 1)
            expected_sig = hmac.new(
                _signing_key(), payload_b64.encode("ascii"), hashlib.sha256
            ).digest()
            actual_sig = _b64url_decode(sig_b64)
            if not hmac.compare_digest(expected_sig, actual_sig):
                return None
            payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
            if not isinstance(payload, dict):
                return None
            if float(payload.get("exp", 0)) <= time.time():
                return None
            return payload
        except (ValueError, TypeError, json.JSONDecodeError):
            return None

    @staticmethod
    def create_user(
        db: Session,
        email: str,
        username: str,
        password: str,
        full_name: Optional[str] = None,
        profile_image: Optional[str] = None,
    ) -> User:
        """Create a new user."""
        normalized_email = email.strip().lower()
        normalized_username = username.strip()

        existing_email = (
            db.query(User).filter(func.lower(User.email) == normalized_email).first()
        )
        if existing_email:
            raise ValueError("Email already registered")

        existing_username = (
            db.query(User).filter(User.username == normalized_username).first()
        )
        if existing_username:
            raise ValueError("Username already taken")

        try:
            user = User(
                email=normalized_email,
                username=normalized_username,
                password_hash=UserService.hash_password(password),
                full_name=full_name.strip() if isinstance(full_name, str) and full_name.strip() else None,
                profile_image=profile_image,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error creating user: {str(e)}")

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password."""
        normalized_email = email.strip().lower()
        try:
            user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
            if not user:
                return None

            if not UserService.verify_password(password, user.password_hash):
                return None

            # Upgrade legacy SHA-256 password hashes seamlessly on login.
            if not user.password_hash.startswith("pbkdf2_sha256$"):
                user.password_hash = UserService.hash_password(password)

            user.last_login = datetime.utcnow()
            db.commit()
            db.refresh(user)
            return user
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error authenticating user: {str(e)}")

    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        try:
            return db.query(User).filter(User.id == user_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching user: {str(e)}")

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get a user by email."""
        normalized_email = email.strip().lower()
        try:
            return db.query(User).filter(func.lower(User.email) == normalized_email).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching user by email: {str(e)}")

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get a user by username."""
        normalized_username = username.strip()
        try:
            return db.query(User).filter(User.username == normalized_username).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching user by username: {str(e)}")

    @staticmethod
    def get_all_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users with pagination."""
        try:
            return db.query(User).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching all users: {str(e)}")

    @staticmethod
    def update_user(db: Session, user_id: int, **kwargs) -> Optional[User]:
        """Update user information."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        if "username" in kwargs and kwargs["username"] is not None:
            new_username = kwargs["username"].strip()
            conflict = (
                db.query(User)
                .filter(User.username == new_username, User.id != user_id)
                .first()
            )
            if conflict:
                raise ValueError("Username already taken")
            kwargs["username"] = new_username

        if "password" in kwargs:
            pwd = kwargs.pop("password")
            if pwd is not None:
                kwargs["password_hash"] = UserService.hash_password(pwd)

        try:
            for key, value in kwargs.items():
                if hasattr(user, key) and value is not None:
                    setattr(user, key, value)

            db.commit()
            db.refresh(user)
            return user
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating user: {str(e)}")

    @staticmethod
    def delete_user(db: Session, user_id: int) -> bool:
        """Delete a user from the database."""
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False

            db.delete(user)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error deleting user: {str(e)}")

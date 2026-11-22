from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from .db import User, get_db
from .services import UserService


# ==================== AUTH PYDANTIC MODELS ====================

class UserSignup(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: Optional[str] = None
    profile_image: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    profile_image: Optional[str]
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    user: UserResponse
    token: str
    message: str


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=100)
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


# ==================== AUTH DEPENDENCY ====================

def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve and validate the Bearer token into an active User."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )
    payload = UserService.verify_access_token(parts[1].strip())
    if not payload or payload.get("sub") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    user = UserService.get_user(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


# ==================== AUTH ENDPOINTS ====================

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    """Sign up a new user account and issue a bearer token."""
    try:
        user = UserService.create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            full_name=user_data.full_name,
            profile_image=user_data.profile_image,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    token = UserService.create_access_token(user)
    return {
        "user": user,
        "token": token,
        "message": "Account created successfully",
    }


@router.post("/auth/login", response_model=AuthResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Log in a user account and issue a bearer token."""
    user = UserService.authenticate_user(
        db=db, email=credentials.email, password=credentials.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = UserService.create_access_token(user)
    return {"user": user, "token": token, "message": "Login successful"}


@router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.put("/auth/me", response_model=UserResponse)
def update_me(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the currently authenticated user's profile."""
    try:
        updated = UserService.update_user(
            db=db,
            user_id=current_user.id,
            **user_data.model_dump(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.delete("/auth/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the currently authenticated user's account."""
    success = UserService.delete_user(db=db, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return None

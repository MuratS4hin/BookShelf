from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

from .db import get_db, Book, AudioBook, Voice, Library, User
from .services import BookService, AudioBookService, VoiceService, LibraryService, UserService

# ==================== PYDANTIC MODELS ====================

class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    file_name: str
    file_type: str
    file_path: str
    file_size: Optional[int] = None
    cover_image: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    publication_date: Optional[str] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    cover_image: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    publication_date: Optional[str] = None


class BookResponse(BaseModel):
    id: int
    title: str
    author: Optional[str]
    file_name: str
    file_type: str
    file_path: str
    file_size: Optional[int]
    cover_image: Optional[str]
    description: Optional[str]
    genre: Optional[str]
    publication_date: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AudioBookCreate(BaseModel):
    book_id: int
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    duration: Optional[float] = None
    speaker_speed: Optional[float] = 0.8


class AudioBookUpdate(BaseModel):
    file_size: Optional[int] = None
    duration: Optional[float] = None
    speaker_speed: Optional[float] = None


class AudioBookStatusUpdate(BaseModel):
    status: str
    error_message: Optional[str] = None


class AudioBookResponse(BaseModel):
    id: int
    book_id: int
    file_name: str
    file_path: str
    file_size: Optional[int]
    duration: Optional[float]
    format: str
    speaker_speed: float
    generation_status: str
    error_message: Optional[str]
    progress: Optional[float] = None
    stage: Optional[str] = None
    voice: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VoiceCreate(BaseModel):
    name: str
    language: str
    model_file: str
    gender: Optional[str] = None
    model_path: Optional[str] = None
    is_default: Optional[bool] = False
    description: Optional[str] = None


class VoiceUpdate(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None
    gender: Optional[str] = None
    is_default: Optional[bool] = None
    is_available: Optional[bool] = None
    description: Optional[str] = None


class VoiceResponse(BaseModel):
    id: int
    name: str
    language: str
    gender: Optional[str]
    model_file: str
    model_path: Optional[str]
    is_default: bool
    is_available: bool
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LibraryCreate(BaseModel):
    book_id: int
    user_id: Optional[str] = None


class LibraryUpdate(BaseModel):
    current_chapter: Optional[int] = None
    reading_progress: Optional[float] = None
    is_favorite: Optional[bool] = None


class LibraryResponse(BaseModel):
    id: int
    book_id: int
    user_id: Optional[str]
    current_chapter: int
    reading_progress: float
    is_favorite: bool
    last_read_at: Optional[datetime]
    added_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== API ROUTES ====================

router = APIRouter(prefix="/api", tags=["database"])


# ==================== BOOK ENDPOINTS ====================

@router.post("/books", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(book: BookCreate, db: Session = Depends(get_db)):
    """Create a new book."""
    try:
        db_book = BookService.create_book(
            db=db,
            title=book.title,
            author=book.author,
            file_name=book.file_name,
            file_type=book.file_type,
            file_path=book.file_path,
            file_size=book.file_size,
            cover_image=book.cover_image,
            description=book.description,
            genre=book.genre,
            publication_date=book.publication_date
        )
        return db_book
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/books/{book_id}", response_model=BookResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    """Get a book by ID."""
    db_book = BookService.get_book(db=db, book_id=book_id)
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    return db_book


@router.get("/books", response_model=List[BookResponse])
def get_all_books(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all books."""
    books = BookService.get_all_books(db=db, skip=skip, limit=limit)
    return books


@router.get("/books/search/title", response_model=List[BookResponse])
def search_books_by_title(title: str, db: Session = Depends(get_db)):
    """Search books by title."""
    books = BookService.get_books_by_title(db=db, title=title)
    return books


@router.get("/books/search/author", response_model=List[BookResponse])
def search_books_by_author(author: str, db: Session = Depends(get_db)):
    """Search books by author."""
    books = BookService.get_books_by_author(db=db, author=author)
    return books


@router.put("/books/{book_id}", response_model=BookResponse)
def update_book(book_id: int, book: BookUpdate, db: Session = Depends(get_db)):
    """Update a book."""
    db_book = BookService.update_book(db=db, book_id=book_id, **book.dict(exclude_unset=True))
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    return db_book


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, db: Session = Depends(get_db)):
    """Delete a book."""
    success = BookService.delete_book(db=db, book_id=book_id)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found")
    return None


# ==================== AUDIOBOOK ENDPOINTS ====================

@router.post("/audiobooks", response_model=AudioBookResponse, status_code=status.HTTP_201_CREATED)
def create_audiobook(audiobook: AudioBookCreate, db: Session = Depends(get_db)):
    """Create a new audiobook."""
    try:
        db_audiobook = AudioBookService.create_audiobook(
            db=db,
            book_id=audiobook.book_id,
            file_name=audiobook.file_name,
            file_path=audiobook.file_path,
            file_size=audiobook.file_size,
            duration=audiobook.duration,
            speaker_speed=audiobook.speaker_speed
        )
        return db_audiobook
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audiobooks/{audiobook_id}", response_model=AudioBookResponse)
def get_audiobook(audiobook_id: int, db: Session = Depends(get_db)):
    """Get an audiobook by ID."""
    db_audiobook = AudioBookService.get_audiobook(db=db, audiobook_id=audiobook_id)
    if not db_audiobook:
        raise HTTPException(status_code=404, detail="AudioBook not found")
    return db_audiobook


@router.get("/audiobooks/book/{book_id}", response_model=AudioBookResponse)
def get_audiobook_by_book(book_id: int, db: Session = Depends(get_db)):
    """Get audiobook for a specific book."""
    db_audiobook = AudioBookService.get_audiobook_by_book_id(db=db, book_id=book_id)
    if not db_audiobook:
        raise HTTPException(status_code=404, detail="AudioBook not found")
    return db_audiobook


@router.get("/audiobooks", response_model=List[AudioBookResponse])
def get_all_audiobooks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all audiobooks."""
    audiobooks = AudioBookService.get_all_audiobooks(db=db, skip=skip, limit=limit)
    return audiobooks


@router.put("/audiobooks/{audiobook_id}", response_model=AudioBookResponse)
def update_audiobook(audiobook_id: int, audiobook: AudioBookUpdate, db: Session = Depends(get_db)):
    """Update an audiobook."""
    db_audiobook = AudioBookService.update_audiobook(db=db, audiobook_id=audiobook_id, **audiobook.dict(exclude_unset=True))
    if not db_audiobook:
        raise HTTPException(status_code=404, detail="AudioBook not found")
    return db_audiobook


@router.patch("/audiobooks/{audiobook_id}/status", response_model=AudioBookResponse)
def update_audiobook_status(audiobook_id: int, status_update: AudioBookStatusUpdate, db: Session = Depends(get_db)):
    """Update audiobook generation status."""
    db_audiobook = AudioBookService.update_audiobook_status(
        db=db,
        audiobook_id=audiobook_id,
        status=status_update.status,
        error_message=status_update.error_message
    )
    if not db_audiobook:
        raise HTTPException(status_code=404, detail="AudioBook not found")
    return db_audiobook


@router.delete("/audiobooks/{audiobook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audiobook(audiobook_id: int, db: Session = Depends(get_db)):
    """Delete an audiobook."""
    success = AudioBookService.delete_audiobook(db=db, audiobook_id=audiobook_id)
    if not success:
        raise HTTPException(status_code=404, detail="AudioBook not found")
    return None


# ==================== VOICE ENDPOINTS ====================

@router.post("/voices", response_model=VoiceResponse, status_code=status.HTTP_201_CREATED)
def create_voice(voice: VoiceCreate, db: Session = Depends(get_db)):
    """Create a new voice."""
    try:
        db_voice = VoiceService.create_voice(
            db=db,
            name=voice.name,
            language=voice.language,
            model_file=voice.model_file,
            gender=voice.gender,
            model_path=voice.model_path,
            is_default=voice.is_default,
            description=voice.description
        )
        return db_voice
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/voices/{voice_id}", response_model=VoiceResponse)
def get_voice(voice_id: int, db: Session = Depends(get_db)):
    """Get a voice by ID."""
    db_voice = VoiceService.get_voice(db=db, voice_id=voice_id)
    if not db_voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    return db_voice


@router.get("/voices/name/{name}", response_model=VoiceResponse)
def get_voice_by_name(name: str, db: Session = Depends(get_db)):
    """Get a voice by name."""
    db_voice = VoiceService.get_voice_by_name(db=db, name=name)
    if not db_voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    return db_voice


@router.get("/voices", response_model=List[VoiceResponse])
def get_all_voices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all available voices."""
    voices = VoiceService.get_all_voices(db=db, skip=skip, limit=limit)
    return voices


@router.get("/voices/language/{language}", response_model=List[VoiceResponse])
def get_voices_by_language(language: str, db: Session = Depends(get_db)):
    """Get voices for a specific language."""
    voices = VoiceService.get_voices_by_language(db=db, language=language)
    return voices


@router.get("/voices/default", response_model=VoiceResponse)
def get_default_voice(db: Session = Depends(get_db)):
    """Get the default voice."""
    db_voice = VoiceService.get_default_voice(db=db)
    if not db_voice:
        raise HTTPException(status_code=404, detail="Default voice not found")
    return db_voice


@router.put("/voices/{voice_id}", response_model=VoiceResponse)
def update_voice(voice_id: int, voice: VoiceUpdate, db: Session = Depends(get_db)):
    """Update a voice."""
    db_voice = VoiceService.update_voice(db=db, voice_id=voice_id, **voice.dict(exclude_unset=True))
    if not db_voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    return db_voice


@router.delete("/voices/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    """Delete a voice."""
    success = VoiceService.delete_voice(db=db, voice_id=voice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Voice not found")
    return None


# ==================== LIBRARY ENDPOINTS ====================

@router.post("/library", response_model=LibraryResponse, status_code=status.HTTP_201_CREATED)
def add_to_library(library: LibraryCreate, db: Session = Depends(get_db)):
    """Add a book to library."""
    try:
        db_library = LibraryService.add_to_library(
            db=db,
            book_id=library.book_id,
            user_id=library.user_id
        )
        return db_library
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/library/{library_id}", response_model=LibraryResponse)
def get_library_entry(library_id: int, db: Session = Depends(get_db)):
    """Get a library entry by ID."""
    db_library = LibraryService.get_library_entry(db=db, library_id=library_id)
    if not db_library:
        raise HTTPException(status_code=404, detail="Library entry not found")
    return db_library


@router.get("/library/book/{book_id}", response_model=LibraryResponse)
def get_library_by_book(book_id: int, db: Session = Depends(get_db)):
    """Get library entry for a specific book."""
    db_library = LibraryService.get_library_by_book(db=db, book_id=book_id)
    if not db_library:
        raise HTTPException(status_code=404, detail="Library entry not found")
    return db_library


@router.get("/library", response_model=List[LibraryResponse])
def get_all_library(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all library entries."""
    library = LibraryService.get_all_library(db=db, skip=skip, limit=limit)
    return library


@router.put("/library/{library_id}", response_model=LibraryResponse)
def update_library(library_id: int, library: LibraryUpdate, db: Session = Depends(get_db)):
    """Update library entry."""
    db_library = LibraryService.update_library(db=db, library_id=library_id, **library.dict(exclude_unset=True))
    if not db_library:
        raise HTTPException(status_code=404, detail="Library entry not found")
    return db_library


@router.patch("/library/{library_id}/progress", response_model=LibraryResponse)
def update_reading_progress(library_id: int, progress: float, current_chapter: Optional[int] = None, db: Session = Depends(get_db)):
    """Update reading progress."""
    db_library = LibraryService.update_reading_progress(
        db=db,
        library_id=library_id,
        progress=progress,
        current_chapter=current_chapter
    )
    if not db_library:
        raise HTTPException(status_code=404, detail="Library entry not found")
    return db_library


@router.patch("/library/{library_id}/favorite", response_model=LibraryResponse)
def toggle_favorite(library_id: int, db: Session = Depends(get_db)):
    """Toggle favorite status."""
    db_library = LibraryService.toggle_favorite(db=db, library_id=library_id)
    if not db_library:
        raise HTTPException(status_code=404, detail="Library entry not found")
    return db_library


@router.delete("/library/{library_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_library(library_id: int, db: Session = Depends(get_db)):
    """Remove a book from library."""
    success = LibraryService.remove_from_library(db=db, library_id=library_id)
    if not success:
        raise HTTPException(status_code=404, detail="Library entry not found")
    return None


# ==================== USER/AUTH PYDANTIC MODELS ====================

class UserSignup(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    password: Optional[str] = None


class LoginResponse(BaseModel):
    user: UserResponse
    message: str


# ==================== AUTH ENDPOINTS ====================

@router.post("/auth/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    """Sign up a new user."""
    try:
        user = UserService.create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            full_name=user_data.full_name,
            profile_image=user_data.profile_image
        )
        return user
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/login", response_model=LoginResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Log in a user."""
    user = UserService.authenticate_user(db=db, email=credentials.email, password=credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    return {"user": user, "message": "Login successful"}


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a user by ID."""
    user = UserService.get_user(db=db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users", response_model=List[UserResponse])
def get_all_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all users."""
    users = UserService.get_all_users(db=db, skip=skip, limit=limit)
    return users


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_data: UserUpdate, db: Session = Depends(get_db)):
    """Update user information."""
    user = UserService.update_user(db=db, user_id=user_id, **user_data.dict(exclude_unset=True))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user."""
    success = UserService.delete_user(db=db, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return None

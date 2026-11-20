from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime
import hashlib
import secrets
from .db import Book, AudioBook, Voice, Library, User


# ==================== BOOK SERVICES ====================

class BookService:
    """Service class for Book database operations."""

    @staticmethod
    def create_book(db: Session, title: str, author: str, file_name: str, 
                   file_type: str, file_path: str, file_size: int = None,
                   cover_image: str = None, description: str = None,
                   genre: str = None, publication_date: str = None) -> Book:
        """Create a new book in the database."""
        try:
            book = Book(
                title=title,
                author=author,
                file_name=file_name,
                file_type=file_type,
                file_path=file_path,
                file_size=file_size,
                cover_image=cover_image,
                description=description,
                genre=genre,
                publication_date=publication_date
            )
            db.add(book)
            db.commit()
            db.refresh(book)
            return book
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error creating book: {str(e)}")

    @staticmethod
    def get_book(db: Session, book_id: int) -> Optional[Book]:
        """Get a book by ID."""
        try:
            return db.query(Book).filter(Book.id == book_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching book: {str(e)}")

    @staticmethod
    def get_books_by_title(db: Session, title: str) -> List[Book]:
        """Get books by title (partial match)."""
        try:
            return db.query(Book).filter(Book.title.ilike(f"%{title}%")).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching books by title: {str(e)}")

    @staticmethod
    def get_books_by_author(db: Session, author: str) -> List[Book]:
        """Get books by author."""
        try:
            return db.query(Book).filter(Book.author.ilike(f"%{author}%")).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching books by author: {str(e)}")

    @staticmethod
    def get_all_books(db: Session, skip: int = 0, limit: int = 100) -> List[Book]:
        """Get all books with pagination."""
        try:
            return db.query(Book).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching all books: {str(e)}")

    @staticmethod
    def update_book(db: Session, book_id: int, **kwargs) -> Optional[Book]:
        """Update a book's information."""
        try:
            book = db.query(Book).filter(Book.id == book_id).first()
            if not book:
                return None
            
            for key, value in kwargs.items():
                if hasattr(book, key) and value is not None:
                    setattr(book, key, value)
            
            db.commit()
            db.refresh(book)
            return book
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating book: {str(e)}")

    @staticmethod
    def delete_book(db: Session, book_id: int) -> bool:
        """Delete a book from the database."""
        try:
            book = db.query(Book).filter(Book.id == book_id).first()
            if not book:
                return False
            
            db.delete(book)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error deleting book: {str(e)}")


# ==================== AUDIOBOOK SERVICES ====================

class AudioBookService:
    """Service class for AudioBook database operations."""

    @staticmethod
    def create_audiobook(db: Session, book_id: int, file_name: str, file_path: str,
                        file_size: int = None, duration: float = None,
                        speaker_speed: float = 0.8) -> AudioBook:
        """Create a new audiobook entry."""
        try:
            audiobook = AudioBook(
                book_id=book_id,
                file_name=file_name,
                file_path=file_path,
                file_size=file_size,
                duration=duration,
                speaker_speed=speaker_speed,
                generation_status="pending"
            )
            db.add(audiobook)
            db.commit()
            db.refresh(audiobook)
            return audiobook
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error creating audiobook: {str(e)}")

    @staticmethod
    def get_audiobook(db: Session, audiobook_id: int) -> Optional[AudioBook]:
        """Get an audiobook by ID."""
        try:
            return db.query(AudioBook).filter(AudioBook.id == audiobook_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching audiobook: {str(e)}")

    @staticmethod
    def get_audiobook_by_book_id(db: Session, book_id: int) -> Optional[AudioBook]:
        """Get audiobook for a specific book."""
        try:
            return db.query(AudioBook).filter(AudioBook.book_id == book_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching audiobook by book_id: {str(e)}")

    @staticmethod
    def get_all_audiobooks(db: Session, skip: int = 0, limit: int = 100) -> List[AudioBook]:
        """Get all audiobooks with pagination."""
        try:
            return db.query(AudioBook).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching all audiobooks: {str(e)}")

    @staticmethod
    def update_audiobook_status(db: Session, audiobook_id: int, status: str,
                               error_message: str = None) -> Optional[AudioBook]:
        """Update audiobook generation status."""
        try:
            audiobook = db.query(AudioBook).filter(AudioBook.id == audiobook_id).first()
            if not audiobook:
                return None
            
            audiobook.generation_status = status
            if error_message:
                audiobook.error_message = error_message
            
            db.commit()
            db.refresh(audiobook)
            return audiobook
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating audiobook status: {str(e)}")

    @staticmethod
    def update_status(db: Session, audiobook_id: int, status: str, error_message: str = None) -> Optional[AudioBook]:
        """Shortcut method to update audiobook status."""
        return AudioBookService.update_audiobook_status(db, audiobook_id, status, error_message)

    @staticmethod
    def update_audiobook(db: Session, audiobook_id: int, **kwargs) -> Optional[AudioBook]:
        """Update audiobook information."""
        try:
            audiobook = db.query(AudioBook).filter(AudioBook.id == audiobook_id).first()
            if not audiobook:
                return None
            
            for key, value in kwargs.items():
                if hasattr(audiobook, key) and value is not None:
                    setattr(audiobook, key, value)
            
            db.commit()
            db.refresh(audiobook)
            return audiobook
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating audiobook: {str(e)}")

    @staticmethod
    def delete_audiobook(db: Session, audiobook_id: int) -> bool:
        """Delete an audiobook from the database."""
        try:
            audiobook = db.query(AudioBook).filter(AudioBook.id == audiobook_id).first()
            if not audiobook:
                return False
            
            db.delete(audiobook)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error deleting audiobook: {str(e)}")


# ==================== VOICE SERVICES ====================

class VoiceService:
    """Service class for Voice database operations."""

    @staticmethod
    def create_voice(db: Session, name: str, language: str, model_file: str,
                    gender: str = None, model_path: str = None,
                    is_default: bool = False, description: str = None) -> Voice:
        """Create a new voice in the database."""
        try:
            voice = Voice(
                name=name,
                language=language,
                model_file=model_file,
                gender=gender,
                model_path=model_path,
                is_default=is_default,
                description=description
            )
            db.add(voice)
            db.commit()
            db.refresh(voice)
            return voice
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error creating voice: {str(e)}")

    @staticmethod
    def get_voice(db: Session, voice_id: int) -> Optional[Voice]:
        """Get a voice by ID."""
        try:
            return db.query(Voice).filter(Voice.id == voice_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching voice: {str(e)}")

    @staticmethod
    def get_voice_by_name(db: Session, name: str) -> Optional[Voice]:
        """Get a voice by name."""
        try:
            return db.query(Voice).filter(Voice.name == name).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching voice by name: {str(e)}")

    @staticmethod
    def get_voices_by_language(db: Session, language: str) -> List[Voice]:
        """Get all voices for a specific language."""
        try:
            return db.query(Voice).filter(Voice.language == language, Voice.is_available == True).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching voices by language: {str(e)}")

    @staticmethod
    def get_default_voice(db: Session) -> Optional[Voice]:
        """Get the default voice."""
        try:
            return db.query(Voice).filter(Voice.is_default == True, Voice.is_available == True).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching default voice: {str(e)}")

    @staticmethod
    def get_all_voices(db: Session, skip: int = 0, limit: int = 100) -> List[Voice]:
        """Get all available voices with pagination."""
        try:
            return db.query(Voice).filter(Voice.is_available == True).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching all voices: {str(e)}")

    @staticmethod
    def update_voice(db: Session, voice_id: int, **kwargs) -> Optional[Voice]:
        """Update voice information."""
        try:
            voice = db.query(Voice).filter(Voice.id == voice_id).first()
            if not voice:
                return None
            
            for key, value in kwargs.items():
                if hasattr(voice, key) and value is not None:
                    setattr(voice, key, value)
            
            db.commit()
            db.refresh(voice)
            return voice
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating voice: {str(e)}")

    @staticmethod
    def delete_voice(db: Session, voice_id: int) -> bool:
        """Delete a voice from the database."""
        try:
            voice = db.query(Voice).filter(Voice.id == voice_id).first()
            if not voice:
                return False
            
            db.delete(voice)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error deleting voice: {str(e)}")


# ==================== LIBRARY SERVICES ====================

class LibraryService:
    """Service class for Library database operations."""

    @staticmethod
    def add_to_library(db: Session, book_id: int, user_id: str = None) -> Library:
        """Add a book to library."""
        try:
            library = Library(
                book_id=book_id,
                user_id=user_id
            )
            db.add(library)
            db.commit()
            db.refresh(library)
            return library
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error adding book to library: {str(e)}")

    @staticmethod
    def get_library_entry(db: Session, library_id: int) -> Optional[Library]:
        """Get a library entry by ID."""
        try:
            return db.query(Library).filter(Library.id == library_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching library entry: {str(e)}")

    @staticmethod
    def get_library_by_book(db: Session, book_id: int) -> Optional[Library]:
        """Get library entry for a specific book."""
        try:
            return db.query(Library).filter(Library.book_id == book_id).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching library entry by book_id: {str(e)}")

    @staticmethod
    def get_all_library(db: Session, skip: int = 0, limit: int = 100) -> List[Library]:
        """Get all library entries with pagination."""
        try:
            return db.query(Library).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching all library entries: {str(e)}")

    @staticmethod
    def update_reading_progress(db: Session, library_id: int, progress: float,
                               current_chapter: int = None) -> Optional[Library]:
        """Update reading progress."""
        try:
            library = db.query(Library).filter(Library.id == library_id).first()
            if not library:
                return None
            
            library.reading_progress = progress
            if current_chapter is not None:
                library.current_chapter = current_chapter
            
            db.commit()
            db.refresh(library)
            return library
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating reading progress: {str(e)}")

    @staticmethod
    def update_library(db: Session, library_id: int, **kwargs) -> Optional[Library]:
        """Update library entry information."""
        try:
            library = db.query(Library).filter(Library.id == library_id).first()
            if not library:
                return None
            
            for key, value in kwargs.items():
                if hasattr(library, key) and value is not None:
                    setattr(library, key, value)
            
            db.commit()
            db.refresh(library)
            return library
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error updating library entry: {str(e)}")

    @staticmethod
    def remove_from_library(db: Session, library_id: int) -> bool:
        """Remove a book from library."""
        try:
            library = db.query(Library).filter(Library.id == library_id).first()
            if not library:
                return False
            
            db.delete(library)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error removing from library: {str(e)}")

    @staticmethod
    def toggle_favorite(db: Session, library_id: int) -> Optional[Library]:
        """Toggle favorite status of a book."""
        try:
            library = db.query(Library).filter(Library.id == library_id).first()
            if not library:
                return None
            
            library.is_favorite = not library.is_favorite
            db.commit()
            db.refresh(library)
            return library
        except SQLAlchemyError as e:
            db.rollback()
            raise Exception(f"Error toggling favorite: {str(e)}")


# ==================== USER SERVICES ====================

class UserService:
    """Service class for User database operations."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using SHA-256."""
        return hashlib.sha256(password.encode()).hexdigest()

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password against its hash."""
        return hashlib.sha256(password.encode()).hexdigest() == password_hash

    @staticmethod
    def create_user(db: Session, email: str, username: str, password: str,
                   full_name: str = None, profile_image: str = None) -> User:
        """Create a new user."""
        try:
            # Check if email already exists
            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email:
                raise Exception("Email already registered")
            
            # Check if username already exists
            existing_username = db.query(User).filter(User.username == username).first()
            if existing_username:
                raise Exception("Username already taken")
            
            user = User(
                email=email,
                username=username,
                password_hash=UserService.hash_password(password),
                full_name=full_name,
                profile_image=profile_image
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
        try:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                return None
            
            if not UserService.verify_password(password, user.password_hash):
                return None
            
            # Update last login
            user.last_login = datetime.utcnow()
            db.commit()
            db.refresh(user)
            return user
        except SQLAlchemyError as e:
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
        try:
            return db.query(User).filter(User.email == email).first()
        except SQLAlchemyError as e:
            raise Exception(f"Error fetching user by email: {str(e)}")

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get a user by username."""
        try:
            return db.query(User).filter(User.username == username).first()
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
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return None
            
            # Handle password update separately
            if 'password' in kwargs:
                kwargs['password_hash'] = UserService.hash_password(kwargs.pop('password'))
            
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

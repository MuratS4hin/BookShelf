"""
Utility functions for common database operations.
"""

from sqlalchemy.orm import Session
from typing import List, Tuple
from datetime import datetime, timedelta
from .db import Book, AudioBook, Voice, Library
from .services import BookService, AudioBookService, LibraryService


class DatabaseUtils:
    """Utility functions for database operations."""

    @staticmethod
    def get_recently_added_books(db: Session, days: int = 7, limit: int = 10) -> List[Book]:
        """Get books added in the last N days."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return db.query(Book).filter(Book.created_at >= cutoff_date).order_by(
            Book.created_at.desc()
        ).limit(limit).all()

    @staticmethod
    def get_failed_audiobooks(db: Session) -> List[AudioBook]:
        """Get all failed audiobook generations."""
        return db.query(AudioBook).filter(
            AudioBook.generation_status == "failed"
        ).all()

    @staticmethod
    def get_pending_audiobooks(db: Session) -> List[AudioBook]:
        """Get all pending audiobook generations."""
        return db.query(AudioBook).filter(
            AudioBook.generation_status == "pending"
        ).all()

    @staticmethod
    def get_processing_audiobooks(db: Session) -> List[AudioBook]:
        """Get all audiobooks currently being processed."""
        return db.query(AudioBook).filter(
            AudioBook.generation_status == "processing"
        ).all()

    @staticmethod
    def get_favorite_books(db: Session, user_id: str = None, limit: int = 100) -> List[Tuple[Book, Library]]:
        """Get user's favorite books."""
        query = db.query(Book, Library).join(
            Library, Book.id == Library.book_id
        ).filter(Library.is_favorite == True)
        
        if user_id:
            query = query.filter(Library.user_id == user_id)
        
        return query.order_by(Library.updated_at.desc()).limit(limit).all()

    @staticmethod
    def get_reading_progress(db: Session, book_id: int) -> float:
        """Get reading progress for a book."""
        library = db.query(Library).filter(Library.book_id == book_id).first()
        return library.reading_progress if library else 0.0

    @staticmethod
    def get_most_read_books(db: Session, limit: int = 10) -> List[Tuple[Book, Library]]:
        """Get most frequently read books."""
        return db.query(Book, Library).join(
            Library, Book.id == Library.book_id
        ).order_by(Library.last_read_at.desc()).limit(limit).all()

    @staticmethod
    def get_unread_books(db: Session, user_id: str = None, limit: int = 100) -> List[Book]:
        """Get books that haven't been started (0% progress)."""
        query = db.query(Book).outerjoin(
            Library, Book.id == Library.book_id
        ).filter(
            (Library.reading_progress == 0) | (Library.reading_progress.is_(None))
        )
        
        if user_id:
            query = query.filter(Library.user_id == user_id)
        
        return query.limit(limit).all()

    @staticmethod
    def get_book_with_audiobook(db: Session, book_id: int) -> Tuple[Book, AudioBook]:
        """Get book with its audiobook."""
        book = BookService.get_book(db, book_id)
        if book:
            audiobook = AudioBookService.get_audiobook_by_book_id(db, book_id)
            return book, audiobook
        return None, None

    @staticmethod
    def get_total_audiobook_size(db: Session, user_id: str = None) -> int:
        """Get total size of all audiobooks in library (in bytes)."""
        query = db.query(AudioBook).join(
            Library, AudioBook.book_id == Library.book_id
        )
        
        if user_id:
            query = query.filter(Library.user_id == user_id)
        
        total = 0
        for audiobook in query.all():
            if audiobook.file_size:
                total += audiobook.file_size
        
        return total

    @staticmethod
    def get_library_statistics(db: Session, user_id: str = None) -> dict:
        """Get library statistics."""
        query = db.query(Library)
        if user_id:
            query = query.filter(Library.user_id == user_id)
        
        library_entries = query.all()
        
        if not library_entries:
            return {
                "total_books": 0,
                "books_read": 0,
                "books_reading": 0,
                "books_unread": 0,
                "favorite_books": 0,
                "average_progress": 0.0
            }
        
        books_read = len([e for e in library_entries if e.reading_progress >= 100])
        books_reading = len([e for e in library_entries if 0 < e.reading_progress < 100])
        books_unread = len([e for e in library_entries if e.reading_progress == 0])
        favorite_books = len([e for e in library_entries if e.is_favorite])
        
        total_progress = sum(e.reading_progress for e in library_entries)
        average_progress = total_progress / len(library_entries) if library_entries else 0
        
        return {
            "total_books": len(library_entries),
            "books_read": books_read,
            "books_reading": books_reading,
            "books_unread": books_unread,
            "favorite_books": favorite_books,
            "average_progress": round(average_progress, 2)
        }

    @staticmethod
    def get_audiobook_generation_stats(db: Session) -> dict:
        """Get audiobook generation statistics."""
        audiobooks = db.query(AudioBook).all()
        
        if not audiobooks:
            return {
                "total": 0,
                "completed": 0,
                "processing": 0,
                "pending": 0,
                "failed": 0,
                "success_rate": 0.0
            }
        
        completed = len([a for a in audiobooks if a.generation_status == "completed"])
        processing = len([a for a in audiobooks if a.generation_status == "processing"])
        pending = len([a for a in audiobooks if a.generation_status == "pending"])
        failed = len([a for a in audiobooks if a.generation_status == "failed"])
        
        success_rate = (completed / len(audiobooks) * 100) if audiobooks else 0
        
        return {
            "total": len(audiobooks),
            "completed": completed,
            "processing": processing,
            "pending": pending,
            "failed": failed,
            "success_rate": round(success_rate, 2)
        }

    @staticmethod
    def cleanup_old_failed_audiobooks(db: Session, days: int = 30) -> int:
        """Remove failed audiobook entries older than N days."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        old_failed = db.query(AudioBook).filter(
            (AudioBook.generation_status == "failed") &
            (AudioBook.updated_at < cutoff_date)
        ).all()
        
        count = 0
        for audiobook in old_failed:
            try:
                AudioBookService.delete_audiobook(db, audiobook.id)
                count += 1
            except Exception:
                continue
        
        return count

    @staticmethod
    def get_language_statistics(db: Session) -> dict:
        """Get statistics about available voices by language."""
        voices = db.query(Voice).filter(Voice.is_available == True).all()
        
        languages = {}
        for voice in voices:
            if voice.language not in languages:
                languages[voice.language] = 0
            languages[voice.language] += 1
        
        return languages

    @staticmethod
    def search_all(db: Session, query_text: str, limit: int = 20) -> dict:
        """Search across books and authors."""
        books_by_title = BookService.get_books_by_title(db, query_text)[:limit]
        books_by_author = BookService.get_books_by_author(db, query_text)[:limit]
        
        # Remove duplicates
        all_book_ids = set()
        unique_books = []
        
        for book in books_by_title + books_by_author:
            if book.id not in all_book_ids:
                all_book_ids.add(book.id)
                unique_books.append(book)
        
        return {
            "total_results": len(unique_books),
            "books": unique_books[:limit]
        }

    @staticmethod
    def export_library_as_json(db: Session, user_id: str = None) -> dict:
        """Export user library as JSON."""
        query = db.query(Library)
        if user_id:
            query = query.filter(Library.user_id == user_id)
        
        library_entries = query.all()
        
        books_data = []
        for entry in library_entries:
            book = BookService.get_book(db, entry.book_id)
            audiobook = AudioBookService.get_audiobook_by_book_id(db, entry.book_id)
            
            if book:
                books_data.append({
                    "book": {
                        "id": book.id,
                        "title": book.title,
                        "author": book.author,
                        "description": book.description,
                        "genre": book.genre
                    },
                    "library": {
                        "reading_progress": entry.reading_progress,
                        "current_chapter": entry.current_chapter,
                        "is_favorite": entry.is_favorite,
                        "last_read": entry.last_read_at.isoformat() if entry.last_read_at else None
                    },
                    "audiobook": {
                        "id": audiobook.id,
                        "status": audiobook.generation_status,
                        "duration": audiobook.duration
                    } if audiobook else None
                })
        
        return {
            "exported_at": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "total_books": len(books_data),
            "books": books_data
        }

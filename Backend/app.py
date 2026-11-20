"""Bookshelf API: import PDF/EPUB -> neural text cleaning -> neural TTS audiobook.

Pipeline (runs in a background worker thread for every uploaded book):

  1. extract   : text + layout (position, font size, ...) from PDF / EPUB
  2. clean     : a deep neural network (ai/model.py) labels every line as body,
                 heading, page number, header/footer, footnote or noise; only
                 body + headings are kept and re-assembled into paragraphs
  3. narrate   : Piper neural TTS reads the cleaned text
  4. encode    : FFmpeg compresses the result to MP3

Run (from the Backend folder):
    venv/bin/uvicorn app:app --host 0.0.0.0 --port 5002
"""
import logging
import os
import shutil
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse

from database import init_db
from database.db import AudioBook, Book, SessionLocal
from database.routes import router as database_router
from database.services import AudioBookService, BookService

from ai.cleaner import get_cleaner
from ai.extraction import ExtractionError, extract_cover, extract_document
from ai.tts import DEFAULT_VOICE, TTS_BACKEND, Narrator, TTSError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("bookshelf")

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", BASE_DIR / "storage"))
UPLOAD_DIR = STORAGE_DIR / "uploads"
AUDIO_DIR = STORAGE_DIR / "audio"
TEXT_DIR = STORAGE_DIR / "text"
COVER_DIR = STORAGE_DIR / "covers"
TMP_DIR = STORAGE_DIR / "tmp"
for _d in (UPLOAD_DIR, AUDIO_DIR, TEXT_DIR, COVER_DIR, TMP_DIR):
    _d.mkdir(parents=True, exist_ok=True)

DEFAULT_SPEED = 1.0  # 1.0 = natural speed, 1.25 = 25% faster, 0.8 = slower
ALLOWED_TYPES = {".pdf", ".epub"}
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "200"))

# One worker = books are narrated one after another (TTS is CPU heavy).
executor = ThreadPoolExecutor(max_workers=int(os.getenv("TTS_WORKERS", "1")), thread_name_prefix="narrator")


# ----------------------------------------------------------------------
# Pipeline
# ----------------------------------------------------------------------

def run_pipeline(source_path: Path, mp3_path: Path, text_path: Path, speed: float, voice: str,
                 on_progress=None, on_stage=None, on_metadata=None) -> float:
    """Extract -> clean (DNN) -> narrate (TTS) -> MP3. Returns duration in seconds."""
    stage = on_stage or (lambda s, p: None)

    stage("extracting", 1.0)
    doc = extract_document(str(source_path))
    if on_metadata:
        on_metadata(doc.title, doc.author)

    stage("cleaning", 3.0)
    result = get_cleaner().clean(doc)
    log.info("Cleaner (%s) label counts: %s", "DNN" if result.used_model else "heuristic", result.label_counts)
    if not result.paragraphs:
        raise ExtractionError("No readable body text was found after cleaning.")
    with open(text_path, "w", encoding="utf-8") as f:
        for p in result.paragraphs:
            f.write(("## " + p.text if p.kind == "heading" else p.text) + "\n\n")

    stage("narrating", 5.0)
    narrator = Narrator(voice=voice, speed=speed)
    duration = narrator.narrate(
        result.paragraphs, mp3_path,
        progress=lambda frac: on_progress and on_progress(5.0 + frac * 93.0),
    )
    stage("encoding", 99.0)
    return duration


def process_audiobook_job(book_id: int, audiobook_id: int, source_path: str, speed: float, voice: str):
    """Background job (runs in the worker thread)."""
    db = SessionLocal()
    last = {"p": -1.0}

    def update(**kw):
        try:
            AudioBookService.update_audiobook(db, audiobook_id, **kw)
        except Exception as exc:  # never let a DB hiccup kill the job
            log.warning("progress update failed: %s", exc)
            db.rollback()

    def on_progress(p):
        if p - last["p"] >= 1.0:
            last["p"] = p
            update(progress=round(p, 1))

    def on_stage(stage, p):
        update(stage=stage, progress=p, generation_status="processing")

    def on_metadata(title, author):
        book = BookService.get_book(db, book_id)
        if not book:
            return
        changes = {}
        if title and len(title) > 2 and book.title == Path(book.file_name).stem:
            changes["title"] = title[:250]
        if author and (not book.author or book.author == "Unknown"):
            changes["author"] = author[:250]
        if changes:
            BookService.update_book(db, book_id, **changes)

    mp3_path = AUDIO_DIR / f"book_{book_id}_{audiobook_id}.mp3"
    text_path = TEXT_DIR / f"book_{book_id}.txt"
    t0 = time.time()
    try:
        log.info("Starting audiobook job book_id=%s audiobook_id=%s", book_id, audiobook_id)
        duration = run_pipeline(Path(source_path), mp3_path, text_path, speed, voice,
                                on_progress=on_progress, on_stage=on_stage, on_metadata=on_metadata)
        update(file_path=str(mp3_path), file_name=mp3_path.name, file_size=mp3_path.stat().st_size,
               duration=duration, generation_status="completed", progress=100.0, stage="done",
               text_path=str(text_path))
        log.info("✅ Audiobook ready for book_id=%s (%.0fs audio, took %.0fs)", book_id, duration, time.time() - t0)
    except (ExtractionError, TTSError) as exc:
        log.error("Audiobook job failed for book_id=%s: %s", book_id, exc)
        update(generation_status="failed", error_message=str(exc), stage="failed")
    except Exception as exc:
        log.exception("Unexpected error in audiobook job for book_id=%s", book_id)
        update(generation_status="failed", error_message=f"Internal error: {exc}", stage="failed")
    finally:
        db.close()


# ----------------------------------------------------------------------
# App
# ----------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Jobs that were running when the server stopped will never finish.
    db = SessionLocal()
    try:
        for ab in db.query(AudioBook).filter(AudioBook.generation_status.in_(["pending", "processing"])).all():
            ab.generation_status = "failed"
            ab.error_message = "Server restarted during generation. Use /books/{id}/regenerate."
        db.commit()
    finally:
        db.close()
    get_cleaner()  # load the DNN once at start-up
    yield
    executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="Bookshelf Audiobook Generator",
              description="PDF/EPUB -> DNN text cleaning -> Piper neural TTS -> MP3",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(database_router)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def _save_upload(file: UploadFile) -> Path:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Please upload a PDF or EPUB file.")
    dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    size = 0
    with open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_MB * 1024 * 1024:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File is larger than {MAX_UPLOAD_MB} MB.")
            out.write(chunk)
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "Uploaded file is empty.")
    return dest


def _audiobook_json(ab: Optional[AudioBook]):
    if ab is None:
        return None
    return {
        "id": ab.id, "book_id": ab.book_id, "status": ab.generation_status,
        "progress": ab.progress or 0.0, "stage": ab.stage, "error": ab.error_message,
        "duration": ab.duration, "file_size": ab.file_size, "speaker_speed": ab.speaker_speed,
        "voice": ab.voice,
        "stream_url": f"/stream-audiobook/book/{ab.book_id}" if ab.generation_status == "completed" else None,
        "created_at": ab.created_at.isoformat() if ab.created_at else None,
    }


def _book_json(book: Book):
    return {
        "id": book.id, "title": book.title, "author": book.author, "file_name": book.file_name,
        "file_type": book.file_type, "file_size": book.file_size, "cover_image": book.cover_image,
        "created_at": book.created_at.isoformat() if book.created_at else None,
    }


def _start_job(db: Session, book: Book, speed: float, voice: str) -> AudioBook:
    audiobook = AudioBookService.get_audiobook_by_book_id(db, book.id)
    if audiobook is None:
        audiobook = AudioBookService.create_audiobook(db=db, book_id=book.id, file_name="", file_path="",
                                                      speaker_speed=speed, file_size=0)
    AudioBookService.update_audiobook(db, audiobook.id, generation_status="pending", progress=0.0,
                                      stage="queued", speaker_speed=speed, voice=voice, error_message="")
    executor.submit(process_audiobook_job, book.id, audiobook.id, book.file_path, speed, voice)
    db.refresh(audiobook)
    return audiobook


@app.post("/upload-book/")
async def upload_book(
    file: UploadFile = File(...),
    speed: float = Form(DEFAULT_SPEED),
    voice: str = Form(DEFAULT_VOICE),
    user_id: int = Form(1),
    db: Session = Depends(get_db),
):
    """Upload a PDF/EPUB. Returns immediately; poll /audiobook-status/book/{id} for progress."""
    path = await _save_upload(file)
    try:
        book = BookService.create_book(
            db=db, title=Path(file.filename).stem, author="Unknown", file_name=file.filename,
            file_type=path.suffix.lstrip("."), file_path=str(path), file_size=path.stat().st_size,
        )
        cover_path = COVER_DIR / f"book_{book.id}.png"
        has_cover = await run_in_threadpool(extract_cover, str(path), str(cover_path))
        cover = f"/books/{book.id}/cover" if has_cover else f"https://picsum.photos/seed/{book.id}/300/400"
        BookService.update_book(db, book.id, cover_image=cover)
        db.refresh(book)
        audiobook = _start_job(db, book, speed, voice)
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Upload failed")
        path.unlink(missing_ok=True)
        raise HTTPException(500, f"Internal Server Error: {exc}")

    return JSONResponse({
        "status": "success",
        "message": "Book uploaded; audiobook generation started",
        "book": _book_json(book),
        "audiobook": _audiobook_json(audiobook),
    })


@app.get("/audiobook-status/book/{book_id}")
def audiobook_status(book_id: int, db: Session = Depends(get_db)):
    book = BookService.get_book(db, book_id)
    if not book:
        raise HTTPException(404, "Book not found")
    return {"book": _book_json(book), "audiobook": _audiobook_json(AudioBookService.get_audiobook_by_book_id(db, book_id))}


@app.post("/books/{book_id}/regenerate")
def regenerate(book_id: int, speed: float = Form(DEFAULT_SPEED), voice: str = Form(DEFAULT_VOICE),
               db: Session = Depends(get_db)):
    """Re-run cleaning + narration (e.g. after re-training the cleaner or to change voice/speed)."""
    book = BookService.get_book(db, book_id)
    if not book or not book.file_path or not Path(book.file_path).is_file():
        raise HTTPException(404, "Book or its source file not found")
    ab = AudioBookService.get_audiobook_by_book_id(db, book_id)
    if ab and ab.generation_status in ("pending", "processing"):
        raise HTTPException(409, "Audiobook is already being generated")
    return {"audiobook": _audiobook_json(_start_job(db, book, speed, voice))}


@app.get("/stream-audiobook/book/{book_id}")
def stream_audiobook_by_book(book_id: int, db: Session = Depends(get_db)):
    """Streams the generated MP3 (supports HTTP Range requests for seeking)."""
    audiobook = AudioBookService.get_audiobook_by_book_id(db=db, book_id=book_id)
    if not audiobook:
        raise HTTPException(404, "Audiobook not found for this book")
    if audiobook.generation_status != "completed":
        raise HTTPException(409, f"Audiobook is {audiobook.generation_status}")
    audio_path = Path(audiobook.file_path or "")
    if not audio_path.is_file():
        raise HTTPException(404, "Audiobook file not found on server")
    return FileResponse(str(audio_path), media_type="audio/mpeg", filename=audio_path.name)


@app.get("/books/{book_id}/text", response_class=PlainTextResponse)
def cleaned_text(book_id: int, db: Session = Depends(get_db)):
    """The exact text that was read aloud (after the DNN removed page numbers, headers, ...)."""
    ab = AudioBookService.get_audiobook_by_book_id(db, book_id)
    path = Path(ab.text_path) if ab and ab.text_path else TEXT_DIR / f"book_{book_id}.txt"
    if not path.is_file():
        raise HTTPException(404, "Cleaned text not available yet")
    return PlainTextResponse(path.read_text(encoding="utf-8"))


@app.get("/books/{book_id}/cover")
def book_cover(book_id: int):
    path = COVER_DIR / f"book_{book_id}.png"
    if not path.is_file():
        raise HTTPException(404, "No cover")
    return FileResponse(str(path))


@app.delete("/books/{book_id}/full")
def delete_book_full(book_id: int, db: Session = Depends(get_db)):
    """Delete a book together with its audiobook, cleaned text, cover and source file."""
    book = BookService.get_book(db, book_id)
    if not book:
        raise HTTPException(404, "Book not found")
    ab = AudioBookService.get_audiobook_by_book_id(db, book_id)
    if ab and ab.generation_status in ("pending", "processing"):
        raise HTTPException(409, "Audiobook is still being generated")
    for p in [book.file_path, ab and ab.file_path, ab and ab.text_path, str(COVER_DIR / f"book_{book_id}.png")]:
        if p:
            Path(p).unlink(missing_ok=True)
    if ab:
        AudioBookService.delete_audiobook(db, ab.id)
    BookService.delete_book(db, book_id)
    return {"status": "deleted"}


@app.post("/preview-clean/")
async def preview_clean(file: UploadFile = File(...), max_chars: int = Form(6000)):
    """Debug endpoint: see what the DNN keeps / removes without generating audio."""
    path = await _save_upload(file)
    try:
        def work():
            doc = extract_document(str(path))
            return doc, get_cleaner().clean(doc)
        doc, result = await run_in_threadpool(work)
    except ExtractionError as exc:
        raise HTTPException(422, str(exc))
    finally:
        path.unlink(missing_ok=True)
    text = result.text
    return {
        "cleaner": "dnn" if result.used_model else "heuristic (model not trained)",
        "title": doc.title, "author": doc.author, "pages": len(doc.pages),
        "label_counts": result.label_counts,
        "removed_examples": result.removed_examples,
        "paragraphs": len(result.paragraphs),
        "characters": len(text),
        "text_preview": text[:max_chars],
    }


@app.post("/generate-audiobook/")
async def generate_audiobook(background_tasks: BackgroundTasks, file: UploadFile = File(...),
                             speed: float = Form(DEFAULT_SPEED), voice: str = Form(DEFAULT_VOICE)):
    """Synchronous variant: upload and wait for the MP3 (only practical for short documents)."""
    path = await _save_upload(file)
    job = uuid.uuid4().hex
    mp3 = TMP_DIR / f"{job}.mp3"
    txt = TMP_DIR / f"{job}.txt"
    try:
        await run_in_threadpool(run_pipeline, path, mp3, txt, speed, voice)
    except (ExtractionError, TTSError) as exc:
        raise HTTPException(422, str(exc))
    finally:
        path.unlink(missing_ok=True)
        txt.unlink(missing_ok=True)
    background_tasks.add_task(lambda: mp3.unlink(missing_ok=True))
    return FileResponse(str(mp3), media_type="audio/mpeg", filename=f"{Path(file.filename).stem}.mp3",
                        background=background_tasks)


@app.get("/health")
def health():
    cleaner = get_cleaner()
    return {
        "status": "ok",
        "cleaner": "dnn" if cleaner.available else "heuristic (run: python -m ai.train)",
        "tts_backend": TTS_BACKEND,
        "default_voice": DEFAULT_VOICE,
        "ffmpeg": shutil.which("ffmpeg") is not None,
    }


@app.get("/")
def read_root():
    return {"message": "Bookshelf Audiobook API. POST a PDF/EPUB to /upload-book/ then poll "
                       "/audiobook-status/book/{id}. Docs at /docs."}

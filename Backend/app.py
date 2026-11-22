"""Bookshelf API: user authentication (DB) + ephemeral PDF/EPUB -> neural TTS conversion.

Books, generated MP3 audio, covers, and cleaned text are stored locally on the
user's phone — never in the database. The server keeps ephemeral scratch files
only long enough for the client to download them, then deletes them.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
import logging
import os
from pathlib import Path
import shutil
import threading
import time
from typing import Dict, Optional
import uuid

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse

from ai.cleaner import get_cleaner
from ai.extraction import ExtractionError, extract_cover, extract_document
from ai.tts import DEFAULT_VOICE, TTS_BACKEND, Narrator, TTSError
from database import init_db
from database.routes import router as auth_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("bookshelf")

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
TMP_DIR = Path(os.getenv("TMP_DIR", Path(os.getenv("STORAGE_DIR", BASE_DIR / "storage")) / "tmp"))
TMP_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SPEED = 1.0  # 1.0 = natural speed, 1.25 = 25% faster, 0.8 = slower
ALLOWED_TYPES = {".pdf", ".epub"}
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "200"))
JOB_TTL_SECONDS = int(os.getenv("JOB_TTL_SECONDS", "3600"))

# One worker = books are narrated one after another (TTS is CPU heavy).
executor = ThreadPoolExecutor(
    max_workers=int(os.getenv("TTS_WORKERS", "1")),
    thread_name_prefix="narrator",
)


# ----------------------------------------------------------------------
# Ephemeral in-memory conversion job registry
# ----------------------------------------------------------------------

@dataclass
class ConversionJob:
    job_id: str
    file_name: str
    file_type: str
    title: str
    voice: str
    speed: float
    work_dir: Path
    mp3_path: Path
    text_path: Path
    cover_path: Path
    author: str = "Unknown"
    status: str = "pending"  # pending | processing | completed | failed
    stage: str = "queued"    # queued | extracting | cleaning | narrating | encoding | done | failed
    progress: float = 0.0
    duration: Optional[float] = None
    file_size: Optional[int] = None
    has_cover: bool = False
    has_text: bool = False
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "stage": self.stage,
            "progress": round(self.progress or 0.0, 1),
            "title": self.title,
            "author": self.author,
            "file_name": self.file_name,
            "file_type": self.file_type,
            "voice": self.voice,
            "speed": self.speed,
            "duration": self.duration,
            "file_size": self.file_size,
            "has_cover": self.has_cover,
            "has_text": self.has_text,
            "error": self.error,
        }


_jobs: Dict[str, ConversionJob] = {}
_jobs_lock = threading.Lock()


def _update_job(job_id: str, **changes) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        for key, value in changes.items():
            setattr(job, key, value)
        job.updated_at = time.time()


def _get_job(job_id: str) -> Optional[ConversionJob]:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return None
        # Return a shallow snapshot via dataclass copy of fields
        return ConversionJob(**asdict(job))


def _clear_dir_contents(directory: Path) -> None:
    if not directory.exists():
        return
    for entry in directory.iterdir():
        if entry.is_dir():
            shutil.rmtree(entry, ignore_errors=True)
        else:
            entry.unlink(missing_ok=True)


def _cleanup_expired_jobs() -> None:
    cutoff = time.time() - JOB_TTL_SECONDS
    expired_dirs = []
    with _jobs_lock:
        expired_ids = [
            jid
            for jid, j in _jobs.items()
            if j.status in ("completed", "failed") and j.updated_at < cutoff
        ]
        for jid in expired_ids:
            job = _jobs.pop(jid)
            expired_dirs.append(job.work_dir)
    for work_dir in expired_dirs:
        shutil.rmtree(work_dir, ignore_errors=True)


# ----------------------------------------------------------------------
# Pipeline
# ----------------------------------------------------------------------

def run_pipeline(
    source_path: Path,
    mp3_path: Path,
    text_path: Path,
    speed: float,
    voice: str,
    on_progress=None,
    on_stage=None,
    on_metadata=None,
    delete_source_after_extract: bool = False,
) -> float:
    """Extract -> clean (DNN) -> narrate (TTS) -> MP3. Returns duration in seconds."""
    stage = on_stage or (lambda s, p: None)

    stage("extracting", 1.0)
    try:
        doc = extract_document(str(source_path))
    finally:
        if delete_source_after_extract:
            source_path.unlink(missing_ok=True)

    if on_metadata:
        on_metadata(doc.title, doc.author)

    stage("cleaning", 3.0)
    result = get_cleaner().clean(doc)
    log.info(
        "Cleaner (%s) label counts: %s",
        "DNN" if result.used_model else "heuristic",
        result.label_counts,
    )
    if not result.paragraphs:
        raise ExtractionError("No readable body text was found after cleaning.")
    with open(text_path, "w", encoding="utf-8") as f:
        for p in result.paragraphs:
            f.write(("## " + p.text if p.kind == "heading" else p.text) + "\n\n")

    stage("narrating", 5.0)
    narrator = Narrator(voice=voice, speed=speed)
    duration = narrator.narrate(
        result.paragraphs,
        mp3_path,
        progress=lambda frac: on_progress and on_progress(5.0 + frac * 93.0),
    )
    stage("encoding", 99.0)
    return duration


def _process_conversion_job(job_id: str, source_path: Path) -> None:
    """Background worker that processes an ephemeral conversion job."""
    job = _get_job(job_id)
    if not job:
        source_path.unlink(missing_ok=True)
        return

    last = {"p": -1.0}

    def on_progress(p: float):
        if p - last["p"] >= 1.0:
            last["p"] = p
            _update_job(job_id, progress=round(p, 1))

    def on_stage(stage: str, p: float):
        _update_job(job_id, stage=stage, progress=p, status="processing")

    def on_metadata(title: Optional[str], author: Optional[str]):
        current = _get_job(job_id)
        if not current:
            return
        changes = {}
        if title and len(title.strip()) > 2 and current.title == Path(current.file_name).stem:
            changes["title"] = title.strip()[:250]
        if author and author.strip() and author.strip().lower() != "unknown" and (
            not current.author or current.author == "Unknown"
        ):
            changes["author"] = author.strip()[:250]
        if changes:
            _update_job(job_id, **changes)

    t0 = time.time()
    try:
        log.info("Starting ephemeral conversion job=%s", job_id)
        duration = run_pipeline(
            source_path=source_path,
            mp3_path=job.mp3_path,
            text_path=job.text_path,
            speed=job.speed,
            voice=job.voice,
            on_progress=on_progress,
            on_stage=on_stage,
            on_metadata=on_metadata,
            delete_source_after_extract=True,
        )
        file_size = job.mp3_path.stat().st_size if job.mp3_path.is_file() else 0
        has_text = job.text_path.is_file()
        _update_job(
            job_id,
            status="completed",
            stage="done",
            progress=100.0,
            duration=duration,
            file_size=file_size,
            has_text=has_text,
        )
        log.info("✅ Conversion job=%s ready (%.0fs audio, took %.0fs)", job_id, duration, time.time() - t0)
    except (ExtractionError, TTSError) as exc:
        log.error("Conversion job=%s failed: %s", job_id, exc)
        _update_job(job_id, status="failed", stage="failed", error=str(exc))
    except Exception as exc:
        log.exception("Unexpected error in conversion job=%s", job_id)
        _update_job(job_id, status="failed", stage="failed", error=f"Internal error: {exc}")
    finally:
        source_path.unlink(missing_ok=True)


# ----------------------------------------------------------------------
# App
# ----------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    _clear_dir_contents(TMP_DIR)
    get_cleaner()  # load the DNN once at start-up
    yield
    executor.shutdown(wait=False, cancel_futures=True)
    _clear_dir_contents(TMP_DIR)


app = FastAPI(
    title="Bookshelf Audiobook Generator",
    description="Auth-only DB + ephemeral PDF/EPUB -> DNN text cleaning -> Piper neural TTS -> MP3",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)


async def _save_temp_upload(file: UploadFile, dest: Path) -> None:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_TYPES:
        raise HTTPException(
            400, f"Unsupported file type '{suffix}'. Please upload a PDF or EPUB file."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
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


@app.post("/jobs/convert")
async def start_conversion_job(
    file: UploadFile = File(...),
    speed: float = Form(DEFAULT_SPEED),
    voice: str = Form(DEFAULT_VOICE),
):
    """Upload a PDF/EPUB for ephemeral conversion. Poll /jobs/{job_id}/status and download assets to the phone."""
    _cleanup_expired_jobs()

    job_id = uuid.uuid4().hex
    work_dir = TMP_DIR / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or f"book_{job_id}.pdf"
    suffix = Path(original_name).suffix.lower()
    source_path = work_dir / f"source{suffix}"
    mp3_path = work_dir / "audio.mp3"
    text_path = work_dir / "cleaned.txt"
    cover_path = work_dir / "cover.png"

    try:
        await _save_temp_upload(file, source_path)
        has_cover = await run_in_threadpool(extract_cover, str(source_path), str(cover_path))
    except HTTPException:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        log.exception("Failed to stage conversion job")
        raise HTTPException(500, f"Internal Server Error: {exc}")

    job = ConversionJob(
        job_id=job_id,
        file_name=original_name,
        file_type=suffix.lstrip("."),
        title=Path(original_name).stem,
        voice=voice or DEFAULT_VOICE,
        speed=speed,
        work_dir=work_dir,
        mp3_path=mp3_path,
        text_path=text_path,
        cover_path=cover_path,
        has_cover=bool(has_cover and cover_path.is_file()),
    )
    with _jobs_lock:
        _jobs[job_id] = job
        snapshot = job.to_dict()

    executor.submit(_process_conversion_job, job_id, source_path)
    return JSONResponse(snapshot)


@app.get("/jobs/{job_id}/status")
def get_job_status(job_id: str):
    job = _get_job(job_id)
    if not job:
        raise HTTPException(404, "Conversion job not found")
    return job.to_dict()


@app.get("/jobs/{job_id}/audio")
def download_job_audio(job_id: str):
    job = _get_job(job_id)
    if not job:
        raise HTTPException(404, "Conversion job not found")
    if job.status != "completed":
        raise HTTPException(409, f"Audiobook is {job.status}")
    if not job.mp3_path.is_file():
        raise HTTPException(404, "Audiobook audio file not found")
    return FileResponse(str(job.mp3_path), media_type="audio/mpeg", filename=f"{job_id}.mp3")


@app.get("/jobs/{job_id}/text", response_class=PlainTextResponse)
def download_job_text(job_id: str):
    job = _get_job(job_id)
    if not job or not job.text_path.is_file():
        raise HTTPException(404, "Cleaned text not available")
    return PlainTextResponse(job.text_path.read_text(encoding="utf-8"))


@app.get("/jobs/{job_id}/cover")
def download_job_cover(job_id: str):
    job = _get_job(job_id)
    if not job or not job.cover_path.is_file():
        raise HTTPException(404, "Cover not available")
    return FileResponse(str(job.cover_path), media_type="image/png")


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return {"status": "not_found"}
        if job.status in ("pending", "processing"):
            raise HTTPException(409, "Conversion job is still in progress")
        _jobs.pop(job_id, None)
    shutil.rmtree(job.work_dir, ignore_errors=True)
    return {"status": "deleted"}


@app.post("/preview-clean/")
async def preview_clean(file: UploadFile = File(...), max_chars: int = Form(6000)):
    """Debug endpoint: see what the DNN keeps / removes without generating audio."""
    suffix = Path(file.filename or "").suffix.lower()
    path = TMP_DIR / f"preview_{uuid.uuid4().hex}{suffix}"
    await _save_temp_upload(file, path)
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
        "title": doc.title,
        "author": doc.author,
        "pages": len(doc.pages),
        "label_counts": result.label_counts,
        "removed_examples": result.removed_examples,
        "paragraphs": len(result.paragraphs),
        "characters": len(text),
        "text_preview": text[:max_chars],
    }


@app.post("/generate-audiobook/")
async def generate_audiobook(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    speed: float = Form(DEFAULT_SPEED),
    voice: str = Form(DEFAULT_VOICE),
):
    """Synchronous variant: upload and wait for the MP3 (only practical for short documents)."""
    job = uuid.uuid4().hex
    suffix = Path(file.filename or "").suffix.lower()
    path = TMP_DIR / f"{job}{suffix}"
    mp3 = TMP_DIR / f"{job}.mp3"
    txt = TMP_DIR / f"{job}.txt"
    await _save_temp_upload(file, path)
    try:
        await run_in_threadpool(run_pipeline, path, mp3, txt, speed, voice)
    except (ExtractionError, TTSError) as exc:
        raise HTTPException(422, str(exc))
    finally:
        path.unlink(missing_ok=True)
        txt.unlink(missing_ok=True)
    background_tasks.add_task(lambda: mp3.unlink(missing_ok=True))
    return FileResponse(
        str(mp3),
        media_type="audio/mpeg",
        filename=f"{Path(file.filename).stem}.mp3",
        background=background_tasks,
    )


@app.get("/health")
def health():
    cleaner = get_cleaner()
    return {
        "status": "ok",
        "storage_mode": "device-only",
        "cleaner": "dnn" if cleaner.available else "heuristic (run: python -m ai.train)",
        "tts_backend": TTS_BACKEND,
        "default_voice": DEFAULT_VOICE,
        "ffmpeg": shutil.which("ffmpeg") is not None,
    }


@app.get("/")
def read_root():
    return {
        "message": (
            "Bookshelf API (Auth DB + Ephemeral AI Narration). "
            "Books & audio are stored locally on the client device. Docs at /docs."
        )
    }

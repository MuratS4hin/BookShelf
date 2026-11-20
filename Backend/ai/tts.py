"""Neural text-to-speech (Piper / VITS) narration to MP3."""
import io
import logging
import os
import re
import shutil
import subprocess
import threading
import wave
from pathlib import Path
from typing import Callable, Dict, List, Optional

import requests

from .cleaner import Paragraph

log = logging.getLogger("bookshelf.tts")

BACKEND_DIR = Path(__file__).resolve().parent.parent
VOICES_DIR = Path(os.getenv("PIPER_VOICES_DIR", BACKEND_DIR / "voices"))
DEFAULT_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")
TTS_BACKEND = os.getenv("TTS_BACKEND", "local").lower()  # "local" or "http"
TTS_SERVER_URL = os.getenv("TTS_SERVER_URL", "http://localhost:5001")
MAX_PIECE_CHARS = 450


class TTSError(Exception):
    pass


_voices: Dict[str, object] = {}
_voices_lock = threading.Lock()


def _voice_path(voice_name: str) -> Path:
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    path = VOICES_DIR / f"{voice_name}.onnx"
    legacy = BACKEND_DIR / f"{voice_name}.onnx"
    if not path.exists() and legacy.exists():
        return legacy
    if not path.exists() or not Path(f"{path}.json").exists():
        log.info("Downloading Piper voice %s ...", voice_name)
        try:
            from piper.download_voices import download_voice
            download_voice(voice_name, VOICES_DIR)
        except Exception as exc:
            raise TTSError(f"Voice '{voice_name}' is missing and could not be downloaded: {exc}") from exc
    return path


def get_voice(voice_name: str = DEFAULT_VOICE):
    with _voices_lock:
        if voice_name not in _voices:
            from piper import PiperVoice
            _voices[voice_name] = PiperVoice.load(str(_voice_path(voice_name)))
            log.info("Loaded Piper voice %s", voice_name)
        return _voices[voice_name]


def split_for_tts(text: str, limit: int = MAX_PIECE_CHARS) -> List[str]:
    """Split long paragraphs at sentence, then clause, then word boundaries."""
    if len(text) <= limit:
        return [text]
    pieces, cur = [], ""
    for sent in re.split(r"(?<=[.!?…])\s+", text):
        sub = [sent]
        if len(sent) > limit:
            sub, buf = [], ""
            for part in re.split(r"(?<=[,;:])\s+|\s+", sent):
                if len(buf) + len(part) + 1 > limit and buf:
                    sub.append(buf)
                    buf = part
                else:
                    buf = f"{buf} {part}".strip()
            if buf:
                sub.append(buf)
        for s in sub:
            if len(cur) + len(s) + 1 > limit and cur:
                pieces.append(cur)
                cur = s
            else:
                cur = f"{cur} {s}".strip()
    if cur:
        pieces.append(cur)
    return pieces


class Narrator:
    """Synthesises a list of paragraphs into one MP3 file, streaming to disk."""

    def __init__(self, voice: str = DEFAULT_VOICE, speed: float = 1.0):
        self.voice_name = voice or DEFAULT_VOICE
        self.speed = min(max(speed or 1.0, 0.5), 2.0)
        self.sample_rate: Optional[int] = None
        self._local_voice = None
        if TTS_BACKEND != "http":
            self._local_voice = get_voice(self.voice_name)
            self.sample_rate = self._local_voice.config.sample_rate

    # -- synthesis backends ---------------------------------------------
    def _synth_local(self, text: str) -> bytes:
        from piper import SynthesisConfig
        cfg = SynthesisConfig(length_scale=1.0 / self.speed)
        out = bytearray()
        silence = self._silence(0.22)
        for chunk in self._local_voice.synthesize(text, syn_config=cfg):
            out += chunk.audio_int16_bytes
            out += silence
        return bytes(out)

    def _synth_http(self, text: str) -> bytes:
        try:
            r = requests.post(TTS_SERVER_URL, json={"text": text, "length_scale": 1.0 / self.speed}, timeout=180)
        except requests.RequestException as exc:
            raise TTSError(f"Cannot reach Piper server at {TTS_SERVER_URL}: {exc}") from exc
        if r.status_code != 200:
            raise TTSError(f"Piper server error {r.status_code}: {r.text[:200]}")
        with wave.open(io.BytesIO(r.content)) as w:
            if self.sample_rate is None:
                self.sample_rate = w.getframerate()
            return w.readframes(w.getnframes())

    def _silence(self, seconds: float) -> bytes:
        return b"\x00\x00" * int((self.sample_rate or 22050) * seconds)

    # -- public ----------------------------------------------------------
    def narrate(self, paragraphs: List[Paragraph], mp3_path: Path,
                progress: Optional[Callable[[float], None]] = None,
                should_stop: Optional[Callable[[], bool]] = None) -> float:
        """Render paragraphs to ``mp3_path``. Returns duration in seconds."""
        if not paragraphs:
            raise TTSError("Nothing to read: the cleaned text is empty.")
        if shutil.which("ffmpeg") is None:
            raise TTSError("FFmpeg is not installed (brew install ffmpeg).")

        mp3_path = Path(mp3_path)
        wav_path = mp3_path.with_suffix(".tmp.wav")
        total_chars = sum(len(p.text) for p in paragraphs) or 1
        done_chars = 0
        frames = 0
        synth = self._synth_http if TTS_BACKEND == "http" else self._synth_local

        wav = None
        try:
            for i, para in enumerate(paragraphs):
                if should_stop and should_stop():
                    raise TTSError("Cancelled")
                for piece in split_for_tts(para.text):
                    pcm = synth(piece)
                    if wav is None:
                        wav = wave.open(str(wav_path), "wb")
                        wav.setnchannels(1)
                        wav.setsampwidth(2)
                        wav.setframerate(self.sample_rate)
                    if para.kind == "heading":
                        pcm = self._silence(0.8) + pcm + self._silence(0.7)
                    wav.writeframes(pcm)
                    frames += len(pcm) // 2
                wav.writeframes(self._silence(0.45))
                frames += len(self._silence(0.45)) // 2
                done_chars += len(para.text)
                if progress:
                    progress(min(done_chars / total_chars, 0.99))
            if wav is None:
                raise TTSError("TTS produced no audio.")
            wav.close()
            wav = None
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
                   "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", str(mp3_path)]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise TTSError(f"FFmpeg failed: {res.stderr.strip()[:300]}")
            return frames / float(self.sample_rate)
        finally:
            if wav is not None:
                wav.close()
            wav_path.unlink(missing_ok=True)

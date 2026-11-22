FROM python:3.11-slim-bookworm

ARG PIPER_VOICE=en_US-lessac-medium
ARG PRELOAD_VOICE=true

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STORAGE_DIR=/app/storage \
    PIPER_VOICES_DIR=/app/voices \
    TTS_BACKEND=local \
    TTS_WORKERS=1 \
    PIPER_VOICE=${PIPER_VOICE}

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        ffmpeg \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install CPU-only PyTorch first so pip does not pull multi-GB CUDA wheels on x86_64.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.2.0" \
    && pip install --no-cache-dir -r requirements.txt

RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash appuser \
    && mkdir -p /app/storage/tmp /app/voices \
    && if [ "$PRELOAD_VOICE" = "true" ]; then \
           python -m piper.download_voices --download-dir /app/voices "$PIPER_VOICE"; \
       fi \
    && chown -R appuser:appuser /app

COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5002/health', timeout=3)" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5002"]

FROM python:3.13.7-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    HF_HOME=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/huggingface \
    TOKENIZERS_PARALLELISM=false

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        curl \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install --requirement requirements.txt

# RAG modeli image oluşturulurken indirilir.
# Böylece container her açılışta modeli yeniden indirmez.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app

RUN groupadd --system intellidesk \
    && useradd \
        --system \
        --gid intellidesk \
        --home-dir /app \
        --shell /usr/sbin/nologin \
        intellidesk \
    && mkdir -p /app/uploads \
    && chown -R intellidesk:intellidesk /app

USER intellidesk

EXPOSE 8000

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=120s \
    --retries=5 \
    CMD curl --fail --silent --show-error \
        "http://127.0.0.1:${PORT:-8000}/health" \
        || exit 1

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
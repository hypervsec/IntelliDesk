from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import (
    DeclarativeBase,
    Session,
    sessionmaker,
)


# =========================================================
# .ENV DOSYASINI YÜKLE
# =========================================================

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

load_dotenv(ENV_PATH)


# =========================================================
# VERİTABANI AYARLARI
# =========================================================

raw_database_url = os.getenv(
    "DATABASE_URL",
    "",
).strip()


def normalize_database_url(
    value: str,
) -> URL:
    """
    PostgreSQL bağlantı adresini SQLAlchemy ve psycopg2
    için uygun sürücü biçimine dönüştürür.
    """

    normalized_value = value

    if normalized_value.startswith(
        "postgres://"
    ):
        normalized_value = (
            "postgresql+psycopg2://"
            + normalized_value[
                len("postgres://") :
            ]
        )

    elif normalized_value.startswith(
        "postgresql://"
    ):
        normalized_value = (
            "postgresql+psycopg2://"
            + normalized_value[
                len("postgresql://") :
            ]
        )

    database_url = make_url(
        normalized_value
    )

    if database_url.get_backend_name() != (
        "postgresql"
    ):
        raise RuntimeError(
            "DATABASE_URL PostgreSQL bağlantısı "
            "olmalıdır."
        )

    return database_url


if raw_database_url:
    DATABASE_URL = normalize_database_url(
        raw_database_url
    )

else:
    DB_HOST = os.getenv(
        "DB_HOST",
        "127.0.0.1",
    )

    try:
        DB_PORT = int(
            os.getenv(
                "DB_PORT",
                "5433",
            )
        )

    except ValueError as error:
        raise RuntimeError(
            "DB_PORT sayısal olmalıdır."
        ) from error

    DB_NAME = os.getenv(
        "DB_NAME",
        "Intellidesk",
    )

    DB_USER = os.getenv(
        "DB_USER",
        "postgres",
    )

    DB_PASSWORD = os.getenv(
        "DB_PASSWORD"
    )

    if not DB_PASSWORD:
        raise RuntimeError(
            "DATABASE_URL veya DB_PASSWORD "
            "bulunamadı. "
            f"Lütfen {ENV_PATH} dosyasını "
            "ve ortam değişkenlerini kontrol et."
        )

    DATABASE_URL = URL.create(
        drivername="postgresql+psycopg2",
        username=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
    )


# =========================================================
# SQLALCHEMY BAĞLANTISI
# =========================================================

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)


# =========================================================
# SESSION
# =========================================================

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# =========================================================
# MODEL BASE
# =========================================================

class Base(DeclarativeBase):
    pass


# =========================================================
# FASTAPI DATABASE DEPENDENCY
# =========================================================

def get_db() -> Generator[
    Session,
    None,
    None,
]:
    database = SessionLocal()

    try:
        yield database

    finally:
        database.close()
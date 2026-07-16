from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import psycopg2
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from psycopg2.extensions import connection as Connection
from psycopg2.extras import execute_values
from sentence_transformers import SentenceTransformer


# =========================================================
# DOSYA VE ORTAM AYARLARI
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / "backend" / ".env"

load_dotenv(ENV_PATH)

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_NAME = os.getenv("DB_NAME", "Intellidesk")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not DB_PASSWORD:
    raise RuntimeError(
        "DB_PASSWORD bulunamadı. "
        f"Lütfen {ENV_PATH} dosyasını kontrol et."
    )

DB_CONFIG = {
    "host": DB_HOST,
    "port": DB_PORT,
    "dbname": DB_NAME,
    "user": DB_USER,
    "password": DB_PASSWORD,
}

MODEL_NAME = (
    "sentence-transformers/"
    "paraphrase-multilingual-MiniLM-L12-v2"
)

EXPECTED_DIMENSION = 384
BATCH_SIZE = 64


# =========================================================
# POSTGRESQL BAĞLANTISI
# =========================================================

def get_connection() -> Connection:
    """PostgreSQL bağlantısını oluşturur."""

    database_connection = psycopg2.connect(
        **DB_CONFIG
    )

    register_vector(database_connection)

    return database_connection


# =========================================================
# VERİTABANI KONTROLLERİ
# =========================================================

def check_database() -> None:
    """Gerekli extension, view ve tabloyu kontrol eder."""

    with get_connection() as database_connection:
        with database_connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_extension
                    WHERE extname = 'vector'
                );
                """
            )

            vector_exists = cursor.fetchone()[0]

            if not vector_exists:
                raise RuntimeError(
                    "pgvector etkin değil. "
                    "Önce CREATE EXTENSION vector; çalıştır."
                )

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.views
                    WHERE table_schema = 'public'
                      AND table_name = 'rag_ticket_data'
                );
                """
            )

            view_exists = cursor.fetchone()[0]

            if not view_exists:
                raise RuntimeError(
                    "rag_ticket_data görünümü bulunamadı."
                )

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'ticket_embeddings'
                );
                """
            )

            table_exists = cursor.fetchone()[0]

            if not table_exists:
                raise RuntimeError(
                    "ticket_embeddings tablosu bulunamadı."
                )


# =========================================================
# EMBEDDING OLUŞTURULACAK KAYITLARI GETİR
# =========================================================

def load_ticket_records() -> list[dict[str, Any]]:
    """
    Henüz embedding oluşturulmamış RAG kayıtlarını getirir.
    """

    query = """
        SELECT
            r.staging_id,
            r.request_id,
            r.ticket_text
        FROM rag_ticket_data AS r

        LEFT JOIN ticket_embeddings AS e
            ON e.request_id = r.request_id

        WHERE e.embedding_id IS NULL

        ORDER BY r.staging_id;
    """

    with get_connection() as database_connection:
        with database_connection.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()

    return [
        {
            "staging_id": row[0],
            "request_id": row[1],
            "ticket_text": row[2],
        }
        for row in rows
    ]


# =========================================================
# EMBEDDING KAYITLARINI KAYDET
# =========================================================

def save_embeddings(
    records: list[dict[str, Any]],
    embeddings: np.ndarray,
) -> None:
    """Embedding kayıtlarını PostgreSQL'e toplu kaydeder."""

    rows = []

    for record, embedding in zip(
        records,
        embeddings,
        strict=True,
    ):
        rows.append(
            (
                record["staging_id"],
                record["request_id"],
                record["ticket_text"],
                embedding,
                MODEL_NAME,
            )
        )

    query = """
        INSERT INTO ticket_embeddings (
            staging_id,
            request_id,
            ticket_text,
            embedding,
            embedding_model
        )
        VALUES %s

        ON CONFLICT (request_id)
        DO NOTHING;
    """

    with get_connection() as database_connection:
        with database_connection.cursor() as cursor:
            execute_values(
                cursor,
                query,
                rows,
                template="(%s, %s, %s, %s, %s)",
                page_size=BATCH_SIZE,
            )

        database_connection.commit()


# =========================================================
# EMBEDDING SAYISINI GETİR
# =========================================================

def get_embedding_count() -> int:
    """Kaydedilmiş embedding sayısını döndürür."""

    with get_connection() as database_connection:
        with database_connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM ticket_embeddings;
                """
            )

            result = cursor.fetchone()

    if result is None:
        return 0

    return int(result[0])


# =========================================================
# ANA İŞLEM
# =========================================================

def main() -> None:
    try:
        print("Veritabanı kontrol ediliyor...")
        check_database()

        print("Embedding modeli yükleniyor...")
        model = SentenceTransformer(MODEL_NAME)

        model_dimension = (
            model.get_sentence_embedding_dimension()
        )

        if model_dimension != EXPECTED_DIMENSION:
            raise RuntimeError(
                "Model boyutu tabloyla uyuşmuyor. "
                f"Model: {model_dimension}, "
                f"Tablo: {EXPECTED_DIMENSION}"
            )

        records = load_ticket_records()

        print(
            "Embedding üretilecek ticket sayısı: "
            f"{len(records)}"
        )

        if not records:
            print(
                "Yeni embedding üretilecek kayıt bulunamadı."
            )
            print(
                f"Toplam embedding: {get_embedding_count()}"
            )
            return

        total = len(records)

        for start in range(0, total, BATCH_SIZE):
            end = min(
                start + BATCH_SIZE,
                total,
            )

            batch_records = records[start:end]

            batch_texts = [
                record["ticket_text"]
                for record in batch_records
            ]

            batch_embeddings = model.encode(
                batch_texts,
                batch_size=BATCH_SIZE,
                normalize_embeddings=True,
                show_progress_bar=False,
                convert_to_numpy=True,
            )

            batch_embeddings = np.asarray(
                batch_embeddings,
                dtype=np.float32,
            )

            save_embeddings(
                batch_records,
                batch_embeddings,
            )

            print(
                f"{end}/{total} embedding oluşturuldu."
            )

        final_count = get_embedding_count()

        print()
        print("Embedding işlemi tamamlandı.")
        print(
            "PostgreSQL'deki toplam embedding: "
            f"{final_count}"
        )

    except KeyboardInterrupt:
        print(
            "\nİşlem kullanıcı tarafından durduruldu."
        )
        sys.exit(1)

    except Exception as error:
        print("\nEmbedding işlemi başarısız.")
        print(type(error).__name__)
        print(error)
        sys.exit(1)


if __name__ == "__main__":
    main()
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

DEFAULT_LIMIT = 5
MAX_LIMIT = 20


# =========================================================
# POSTGRESQL BAĞLANTISI
# =========================================================

def get_connection() -> Connection:
    """
    PostgreSQL bağlantısı oluşturur ve pgvector desteğini
    bağlantıya kaydeder.
    """

    database_connection = psycopg2.connect(
        **DB_CONFIG
    )

    register_vector(database_connection)

    return database_connection


# =========================================================
# VERİTABANI KONTROLLERİ
# =========================================================

def check_database() -> None:
    """
    pgvector extension, ticket_embeddings tablosu ve
    rag_ticket_data görünümünü kontrol eder.
    """

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
                    "pgvector extension etkin değil. "
                    "PostgreSQL üzerinde "
                    "CREATE EXTENSION vector; çalıştır."
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

            embeddings_table_exists = cursor.fetchone()[0]

            if not embeddings_table_exists:
                raise RuntimeError(
                    "ticket_embeddings tablosu bulunamadı."
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

            rag_view_exists = cursor.fetchone()[0]

            if not rag_view_exists:
                raise RuntimeError(
                    "rag_ticket_data görünümü bulunamadı."
                )


# =========================================================
# MODELİ YÜKLE
# =========================================================

def load_model() -> SentenceTransformer:
    """
    Çok dilli sentence-transformer modelini yükler.
    """

    return SentenceTransformer(MODEL_NAME)


# =========================================================
# BENZER TICKET ARAMA
# =========================================================

def search_similar_tickets(
    query_text: str,
    model: SentenceTransformer,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """
    Kullanıcının verdiği açıklamaya en benzer geçmiş
    ticketları pgvector cosine distance ile getirir.
    """

    cleaned_query = query_text.strip()

    if not cleaned_query:
        raise ValueError(
            "Ticket açıklaması boş bırakılamaz."
        )

    if limit < 1:
        raise ValueError(
            "Sonuç limiti en az 1 olmalıdır."
        )

    safe_limit = min(
        limit,
        MAX_LIMIT,
    )

    query_embedding = model.encode(
        cleaned_query,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    query_embedding = np.asarray(
        query_embedding,
        dtype=np.float32,
    )

    query = """
        SELECT
            e.request_id,
            r.category,
            r.subcategory,
            r.subject,
            r.description,
            r.resolution,
            1 - (
                e.embedding <=> %s
            ) AS similarity

        FROM ticket_embeddings AS e

        INNER JOIN rag_ticket_data AS r
            ON r.staging_id = e.staging_id

        ORDER BY e.embedding <=> %s

        LIMIT %s;
    """

    with get_connection() as database_connection:
        with database_connection.cursor() as cursor:
            cursor.execute(
                query,
                (
                    query_embedding,
                    query_embedding,
                    safe_limit,
                ),
            )

            rows = cursor.fetchall()

    return [
        {
            "request_id": row[0],
            "category": row[1],
            "subcategory": row[2],
            "subject": row[3],
            "description": row[4],
            "resolution": row[5],
            "similarity": float(row[6]),
        }
        for row in rows
    ]


# =========================================================
# SONUÇLARI YAZDIR
# =========================================================

def print_results(
    results: list[dict[str, Any]],
) -> None:
    """
    Benzer ticket sonuçlarını terminalde okunabilir biçimde
    gösterir.
    """

    if not results:
        print(
            "\nBenzer geçmiş ticket bulunamadı."
        )
        return

    print("\nEn benzer geçmiş ticketlar:\n")

    for index, result in enumerate(
        results,
        start=1,
    ):
        similarity_percentage = (
            result["similarity"] * 100
        )

        print("=" * 70)
        print(f"{index}. kayıt")
        print(
            f"Request ID: "
            f"{result['request_id'] or '-'}"
        )
        print(
            f"Kategori: "
            f"{result['category'] or '-'}"
        )
        print(
            f"Alt kategori: "
            f"{result['subcategory'] or '-'}"
        )
        print(
            f"Konu: "
            f"{result['subject'] or '-'}"
        )
        print(
            f"Benzerlik: "
            f"%{similarity_percentage:.2f}"
        )

        print()
        print("Açıklama:")
        print(
            result["description"] or "-"
        )

        print()
        print("Geçmiş çözüm:")
        print(
            result["resolution"] or "-"
        )

        print()


# =========================================================
# ANA İŞLEM
# =========================================================

def main() -> None:
    try:
        print("Veritabanı kontrol ediliyor...")
        check_database()

        print("Embedding modeli yükleniyor...")
        model = load_model()

        query_text = input(
            "Yeni ticket açıklamasını yazın: "
        ).strip()

        if not query_text:
            print(
                "Ticket açıklaması boş bırakılamaz."
            )
            return

        results = search_similar_tickets(
            query_text=query_text,
            model=model,
            limit=DEFAULT_LIMIT,
        )

        print_results(results)

    except KeyboardInterrupt:
        print(
            "\nİşlem kullanıcı tarafından durduruldu."
        )
        sys.exit(1)

    except Exception as error:
        print(
            "\nBenzer ticket arama işlemi başarısız."
        )
        print(type(error).__name__)
        print(error)
        sys.exit(1)


if __name__ == "__main__":
    main()
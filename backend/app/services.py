from __future__ import annotations

import os

import numpy as np
import psycopg2
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer


load_dotenv("backend/.env")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "5433")),
    "dbname": os.getenv("DB_NAME", "Intellidesk"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD"),
}

MODEL_NAME = (
    "sentence-transformers/"
    "paraphrase-multilingual-MiniLM-L12-v2"
)

model = SentenceTransformer(MODEL_NAME)


def find_similar_tickets(
    query_text: str,
    limit: int = 5,
) -> list[dict]:
    query_embedding = model.encode(
        query_text,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    query_embedding = np.asarray(
        query_embedding,
        dtype=np.float32,
    )

    connection = psycopg2.connect(**DB_CONFIG)
    register_vector(connection)

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
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

WHERE r.resolution IS NOT NULL
  AND LENGTH(TRIM(r.resolution)) >= 20
  AND LOWER(TRIM(r.resolution)) NOT IN (
      'problem giderildi.',
      'problem giderildi',
      'genel problem.',
      'genel problem',
      'çözüldü.',
      'çözüldü'
  )

ORDER BY e.embedding <=> %s
LIMIT %s;
                """,
                (
                    query_embedding,
                    query_embedding,
                    limit,
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
                "similarity": round(
                    float(row[6]),
                    4,
                ),
            }
            for row in rows
        ]

    finally:
        connection.close()
from __future__ import annotations

import math
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import psycopg2
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer


BACKEND_DIRECTORY = (
    Path(__file__).resolve().parents[1]
)

ENV_FILE = BACKEND_DIRECTORY / ".env"

load_dotenv(
    dotenv_path=ENV_FILE,
    override=False,
)

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

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

STOP_WORDS = {
    "aciklama",
    "ama",
    "bir",
    "bu",
    "da",
    "dair",
    "de",
    "icin",
    "ile",
    "konu",
    "nedeniyle",
    "olarak",
    "sekilde",
    "ve",
    "veya",
}


def normalize_text(
    value: str | None,
) -> str:
    if not value:
        return ""

    normalized_value = value.casefold().translate(
        str.maketrans(
            {
                "ı": "i",
                "İ": "i",
            }
        )
    )

    normalized_value = unicodedata.normalize(
        "NFKD",
        normalized_value,
    )

    return "".join(
        character
        for character in normalized_value
        if not unicodedata.combining(character)
    )


def extract_tokens(
    value: str | None,
) -> set[str]:
    normalized_value = normalize_text(value)

    return {
        token
        for token in TOKEN_PATTERN.findall(
            normalized_value
        )
        if len(token) >= 2
        and token not in STOP_WORDS
    }


def create_stem(
    token: str,
) -> str:
    if (
        token.startswith("unite")
        or token.startswith("birim")
    ):
        return "birim"

    if len(token) < 7:
        return token

    return token[:6]


def extract_stems(
    tokens: set[str],
) -> set[str]:
    return {
        create_stem(token)
        for token in tokens
    }


def calculate_token_weight(
    token: str,
    document_frequencies: Counter,
    total_documents: int,
) -> float:
    document_frequency = (
        document_frequencies.get(
            token,
            0,
        )
    )

    return (
        math.log(
            (total_documents + 1)
            / (document_frequency + 1)
        )
        + 1
    )


def calculate_match_factor(
    token: str,
    target_tokens: set[str],
    target_stems: set[str],
) -> float:
    if token in target_tokens:
        return 1.0

    if create_stem(token) in target_stems:
        return 0.80

    return 0.0


def calculate_directional_coverage(
    source_tokens: set[str],
    target_tokens: set[str],
    target_stems: set[str],
    document_frequencies: Counter,
    total_documents: int,
) -> float:
    if not source_tokens:
        return 0.0

    total_weight = 0.0
    matched_weight = 0.0

    for token in source_tokens:
        token_weight = calculate_token_weight(
            token=token,
            document_frequencies=
                document_frequencies,
            total_documents=total_documents,
        )

        total_weight += token_weight

        match_factor = calculate_match_factor(
            token=token,
            target_tokens=target_tokens,
            target_stems=target_stems,
        )

        matched_weight += (
            token_weight * match_factor
        )

    if total_weight == 0:
        return 0.0

    return matched_weight / total_weight


def calculate_bidirectional_score(
    query_tokens: set[str],
    query_stems: set[str],
    candidate_tokens: set[str],
    candidate_stems: set[str],
    document_frequencies: Counter,
    total_documents: int,
) -> float:
    if not query_tokens or not candidate_tokens:
        return 0.0

    query_coverage = (
        calculate_directional_coverage(
            source_tokens=query_tokens,
            target_tokens=candidate_tokens,
            target_stems=candidate_stems,
            document_frequencies=
                document_frequencies,
            total_documents=total_documents,
        )
    )

    candidate_coverage = (
        calculate_directional_coverage(
            source_tokens=candidate_tokens,
            target_tokens=query_tokens,
            target_stems=query_stems,
            document_frequencies=
                document_frequencies,
            total_documents=total_documents,
        )
    )

    coverage_total = (
        query_coverage
        + candidate_coverage
    )

    if coverage_total == 0:
        return 0.0

    return (
        2
        * query_coverage
        * candidate_coverage
        / coverage_total
    )


def calculate_identifier_score(
    query_tokens: set[str],
    candidate_tokens: set[str],
) -> float:
    query_identifiers = {
        token
        for token in query_tokens
        if any(
            character.isdigit()
            for character in token
        )
    }

    if not query_identifiers:
        return 0.0

    candidate_identifiers = {
        token
        for token in candidate_tokens
        if any(
            character.isdigit()
            for character in token
        )
    }

    matching_identifiers = (
        query_identifiers
        & candidate_identifiers
    )

    return (
        len(matching_identifiers)
        / len(query_identifiers)
    )


def calculate_ranking_score(
    similarity: float,
    lexical_score: float,
    subject_score: float,
    identifier_score: float,
) -> float:
    return (
        similarity * 0.58
        + lexical_score * 0.27
        + subject_score * 0.15
        + identifier_score * 0.20
    )


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

    connection = psycopg2.connect(
        **DB_CONFIG
    )

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
                  AND LENGTH(
                      TRIM(r.resolution)
                  ) >= 20
                  AND LOWER(
                      TRIM(r.resolution)
                  ) NOT IN (
                      'problem giderildi.',
                      'problem giderildi',
                      'genel problem.',
                      'genel problem',
                      'çözüldü.',
                      'çözüldü'
                  );
                """,
                (
                    query_embedding,
                ),
            )

            rows = cursor.fetchall()

        query_tokens = extract_tokens(
            query_text
        )

        query_stems = extract_stems(
            query_tokens
        )

        candidates = []
        document_frequencies = Counter()

        for row in rows:
            candidate_text = "\n".join(
                [
                    row[3] or "",
                    row[4] or "",
                ]
            )

            candidate_tokens = extract_tokens(
                candidate_text
            )

            candidate_stems = extract_stems(
                candidate_tokens
            )

            subject_tokens = extract_tokens(
                row[3]
            )

            subject_stems = extract_stems(
                subject_tokens
            )

            document_frequencies.update(
                candidate_tokens
            )

            candidates.append(
                {
                    "request_id": row[0],
                    "category": row[1],
                    "subcategory": row[2],
                    "subject": row[3],
                    "description": row[4],
                    "resolution": row[5],
                    "similarity": float(
                        row[6]
                    ),
                    "_tokens": candidate_tokens,
                    "_stems": candidate_stems,
                    "_subject_tokens":
                        subject_tokens,
                    "_subject_stems":
                        subject_stems,
                }
            )

        total_documents = len(candidates)

        for candidate in candidates:
            lexical_score = (
                calculate_bidirectional_score(
                    query_tokens=query_tokens,
                    query_stems=query_stems,
                    candidate_tokens=candidate[
                        "_tokens"
                    ],
                    candidate_stems=candidate[
                        "_stems"
                    ],
                    document_frequencies=
                        document_frequencies,
                    total_documents=
                        total_documents,
                )
            )

            subject_score = (
                calculate_bidirectional_score(
                    query_tokens=query_tokens,
                    query_stems=query_stems,
                    candidate_tokens=candidate[
                        "_subject_tokens"
                    ],
                    candidate_stems=candidate[
                        "_subject_stems"
                    ],
                    document_frequencies=
                        document_frequencies,
                    total_documents=
                        total_documents,
                )
            )

            identifier_score = (
                calculate_identifier_score(
                    query_tokens=query_tokens,
                    candidate_tokens=candidate[
                        "_tokens"
                    ],
                )
            )

            candidate["_ranking_score"] = (
                calculate_ranking_score(
                    similarity=candidate[
                        "similarity"
                    ],
                    lexical_score=lexical_score,
                    subject_score=subject_score,
                    identifier_score=
                        identifier_score,
                )
            )

        candidates.sort(
            key=lambda item: (
                item["_ranking_score"],
                item["similarity"],
            ),
            reverse=True,
        )

        selected_candidates = candidates[
            :limit
        ]

        for candidate in selected_candidates:
            candidate["similarity"] = round(
                candidate["similarity"],
                4,
            )

            candidate.pop(
                "_tokens",
                None,
            )

            candidate.pop(
                "_stems",
                None,
            )

            candidate.pop(
                "_subject_tokens",
                None,
            )

            candidate.pop(
                "_subject_stems",
                None,
            )

            candidate.pop(
                "_ranking_score",
                None,
            )

        return selected_candidates

    finally:
        connection.close()
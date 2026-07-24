from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from ..services import find_similar_tickets
from .ai_service import generate_gemini_solution
from .models import AIMessage, AISession


logger = logging.getLogger(__name__)

SIMILAR_TICKET_LIMIT = 5
SUPPORTED_AI_PROVIDER = "gemini"


@dataclass(
    frozen=True,
    slots=True,
)
class TemporaryRAGSolution:
    content: str
    confidence_score: float
    source_request_ids: list[str]


def get_ai_provider() -> str:
    provider = os.getenv(
        "AI_PROVIDER",
        SUPPORTED_AI_PROVIDER,
    ).strip().lower()

    if provider != SUPPORTED_AI_PROVIDER:
        raise RuntimeError(
            f"Desteklenmeyen AI sağlayıcısı: {provider}"
        )

    return provider


def build_session_query(
    ai_session: AISession,
    user_message: AIMessage,
) -> str:
    query_parts = [
        f"Konu: {ai_session.title}",
        f"Açıklama: {user_message.content}",
    ]

    if ai_session.department:
        query_parts.append(
            f"Departman: {ai_session.department}"
        )

    if ai_session.category:
        query_parts.append(
            f"Kategori: {ai_session.category}"
        )

    if ai_session.subcategory:
        query_parts.append(
            f"Alt kategori: {ai_session.subcategory}"
        )

    return "\n".join(query_parts)


def normalize_confidence_score(
    similarity: float,
) -> float:
    return round(
        max(
            0.0,
            min(float(similarity), 1.0),
        ),
        4,
    )


def format_source_ticket(
    request_id: str,
) -> str:
    normalized_id = str(request_id).strip()

    if normalized_id.startswith("#"):
        return normalized_id

    return f"#{normalized_id}"


def get_source_request_ids(
    similar_tickets: list[dict[str, Any]],
) -> list[str]:
    return [
        str(ticket["request_id"])
        for ticket in similar_tickets
        if ticket.get("request_id") is not None
    ]


def get_best_confidence_score(
    similar_tickets: list[dict[str, Any]],
) -> float:
    if not similar_tickets:
        return 0.0

    best_similarity = similar_tickets[0].get(
        "similarity",
        0.0,
    )

    return normalize_confidence_score(
        best_similarity
    )


def build_solution_metadata(
    confidence_score: float,
    source_request_ids: list[str],
) -> str:
    if source_request_ids:
        formatted_sources = ", ".join(
            format_source_ticket(request_id)
            for request_id in source_request_ids
        )
    else:
        formatted_sources = (
            "Benzer geçmiş ticket bulunamadı"
        )

    return (
        "\n\n---\n"
        "RAG bilgileri:\n"
        f"Benzerlik güven puanı: "
        f"%{confidence_score * 100:.2f}\n"
        f"Kaynak ticketlar: {formatted_sources}"
    )


def generate_temporary_rag_solution(
    ai_session: AISession,
    user_message: AIMessage,
) -> TemporaryRAGSolution:
    provider = get_ai_provider()

    model_name = (
        os.getenv(
            "GEMINI_MODEL",
            "",
        ).strip()
        or "varsayılan"
    )

    session_id = ai_session.session_id

    query_text = build_session_query(
        ai_session=ai_session,
        user_message=user_message,
    )

    try:
        similar_tickets = find_similar_tickets(
            query_text=query_text,
            limit=SIMILAR_TICKET_LIMIT,
        )
    except Exception as exc:
        logger.exception(
            (
                "RAG benzer ticket araması başarısız | "
                "session_id=%s | "
                "error_type=%s | "
                "error=%s"
            ),
            session_id,
            type(exc).__name__,
            exc,
        )

        raise

    confidence_score = get_best_confidence_score(
        similar_tickets=similar_tickets,
    )

    source_request_ids = get_source_request_ids(
        similar_tickets=similar_tickets,
    )

    try:
        generated_solution = generate_gemini_solution(
            ai_session=ai_session,
            user_message=user_message,
            similar_tickets=similar_tickets,
        )
    except Exception as exc:
        logger.exception(
            (
                "AI çözüm üretimi başarısız | "
                "session_id=%s | "
                "provider=%s | "
                "model=%s | "
                "source_count=%s | "
                "error_type=%s | "
                "error=%s"
            ),
            session_id,
            provider,
            model_name,
            len(similar_tickets),
            type(exc).__name__,
            exc,
        )

        raise

    metadata = build_solution_metadata(
        confidence_score=confidence_score,
        source_request_ids=source_request_ids,
    )

    return TemporaryRAGSolution(
        content=(
            generated_solution.content.strip()
            + metadata
        ),
        confidence_score=confidence_score,
        source_request_ids=source_request_ids,
    )
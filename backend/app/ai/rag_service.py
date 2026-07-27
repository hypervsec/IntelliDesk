from __future__ import annotations

import hashlib
import hmac
import logging
import os
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from ..attachments.storage import (
    resolve_storage_path,
)
from ..database import SessionLocal
from ..services import find_similar_tickets
from .ai_service import (
    GeminiImageInput,
    generate_gemini_solution,
)
from .models import (
    AIMessage,
    AISession,
    AISessionAttachment,
)


logger = logging.getLogger(__name__)

SIMILAR_TICKET_LIMIT = 5
SUPPORTED_AI_PROVIDER = "gemini"

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
}

# Satır içi görsel isteğinde Base64 kodlama,
# sistem talimatı ve metin promptu için alan bırakılır.
MAX_INLINE_IMAGE_BYTES = (
    14
    * 1024
    * 1024
)


@dataclass(
    frozen=True,
    slots=True,
)
class TemporaryRAGSource:
    request_id: str
    similarity_score: float


@dataclass(
    frozen=True,
    slots=True,
)
class TemporaryRAGSolution:
    content: str
    confidence_score: float
    source_request_ids: list[str]
    sources: list[TemporaryRAGSource]


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
    normalized_id = str(
        request_id
    ).strip()

    if normalized_id.startswith("#"):
        return normalized_id

    return f"#{normalized_id}"


def get_rag_sources(
    similar_tickets: list[dict[str, Any]],
) -> list[TemporaryRAGSource]:
    sources: list[
        TemporaryRAGSource
    ] = []

    used_request_ids: set[str] = set()

    for ticket in similar_tickets:
        request_id = ticket.get(
            "request_id"
        )

        if request_id is None:
            continue

        normalized_request_id = str(
            request_id
        ).strip()

        if not normalized_request_id:
            continue

        if (
            normalized_request_id
            in used_request_ids
        ):
            continue

        similarity_score = (
            normalize_confidence_score(
                ticket.get(
                    "similarity",
                    0.0,
                )
            )
        )

        sources.append(
            TemporaryRAGSource(
                request_id=(
                    normalized_request_id
                ),
                similarity_score=(
                    similarity_score
                ),
            )
        )

        used_request_ids.add(
            normalized_request_id
        )

    return sources


def get_source_request_ids(
    sources: list[TemporaryRAGSource],
) -> list[str]:
    return [
        source.request_id
        for source in sources
    ]


def get_best_confidence_score(
    sources: list[TemporaryRAGSource],
) -> float:
    if not sources:
        return 0.0

    return sources[0].similarity_score


def build_solution_metadata(
    confidence_score: float,
    source_request_ids: list[str],
) -> str:
    if source_request_ids:
        formatted_sources = ", ".join(
            format_source_ticket(
                request_id
            )
            for request_id
            in source_request_ids
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


def get_session_attachment_records(
    session_id: int,
) -> list[AISessionAttachment]:
    with SessionLocal() as database:
        attachments = database.scalars(
            select(
                AISessionAttachment
            )
            .where(
                AISessionAttachment.session_id
                == session_id
            )
            .order_by(
                AISessionAttachment.created_at
                .asc(),

                AISessionAttachment.attachment_id
                .asc(),
            )
        ).all()

        return list(
            attachments
        )


def load_session_images(
    session_id: int,
) -> list[GeminiImageInput]:
    attachments = (
        get_session_attachment_records(
            session_id=session_id,
        )
    )

    if not attachments:
        return []

    session_images: list[
        GeminiImageInput
    ] = []

    total_size_bytes = 0

    for attachment in attachments:
        if (
            attachment.content_type
            not in ALLOWED_IMAGE_CONTENT_TYPES
        ):
            raise RuntimeError(
                "AI oturumunda desteklenmeyen "
                "bir görsel içerik türü bulundu."
            )

        absolute_path = resolve_storage_path(
            attachment.storage_path
        )

        if not absolute_path.is_file():
            raise RuntimeError(
                "AI oturumuna ait görsel "
                "sunucu diskinde bulunamadı."
            )

        image_data = (
            absolute_path.read_bytes()
        )

        if not image_data:
            raise RuntimeError(
                "AI oturumuna ait boş "
                "bir görsel bulundu."
            )

        expected_size = int(
            attachment.size_bytes
        )

        if (
            len(image_data)
            != expected_size
        ):
            raise RuntimeError(
                "AI oturumu görselinin dosya "
                "boyutu veritabanı kaydıyla "
                "eşleşmiyor."
            )

        calculated_sha256 = (
            hashlib.sha256(
                image_data
            ).hexdigest()
        )

        if not hmac.compare_digest(
            calculated_sha256,
            attachment.sha256,
        ):
            raise RuntimeError(
                "AI oturumu görselinin "
                "bütünlük kontrolü "
                "başarısız oldu."
            )

        total_size_bytes += len(
            image_data
        )

        if (
            total_size_bytes
            > MAX_INLINE_IMAGE_BYTES
        ):
            raise RuntimeError(
                "AI oturumu görsellerinin "
                "toplam boyutu 14 MB "
                "sınırını aşıyor."
            )

        session_images.append(
            GeminiImageInput(
                original_filename=(
                    attachment
                    .original_filename
                ),

                content_type=(
                    attachment
                    .content_type
                ),

                data=image_data,
            )
        )

    return session_images


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

    session_id = (
        ai_session.session_id
    )

    query_text = build_session_query(
        ai_session=ai_session,
        user_message=user_message,
    )

    try:
        similar_tickets = (
            find_similar_tickets(
                query_text=query_text,
                limit=(
                    SIMILAR_TICKET_LIMIT
                ),
            )
        )

    except Exception as exc:
        logger.exception(
            (
                "RAG benzer ticket araması "
                "başarısız | "
                "session_id=%s | "
                "error_type=%s | "
                "error=%s"
            ),
            session_id,
            type(exc).__name__,
            exc,
        )

        raise

    sources = get_rag_sources(
        similar_tickets=similar_tickets,
    )

    source_request_ids = (
        get_source_request_ids(
            sources=sources,
        )
    )

    confidence_score = (
        get_best_confidence_score(
            sources=sources,
        )
    )

    try:
        session_images = (
            load_session_images(
                session_id=session_id,
            )
        )

        generated_solution = (
            generate_gemini_solution(
                ai_session=ai_session,

                user_message=(
                    user_message
                ),

                similar_tickets=(
                    similar_tickets
                ),

                session_images=(
                    session_images
                ),
            )
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
            len(sources),
            type(exc).__name__,
            exc,
        )

        raise

    metadata = build_solution_metadata(
        confidence_score=(
            confidence_score
        ),

        source_request_ids=(
            source_request_ids
        ),
    )

    return TemporaryRAGSolution(
        content=(
            generated_solution
            .content
            .strip()
            + metadata
        ),

        confidence_score=(
            confidence_score
        ),

        source_request_ids=(
            source_request_ids
        ),

        sources=sources,
    )
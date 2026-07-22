from dataclasses import dataclass

from ..services import find_similar_tickets
from .models import AIMessage, AISession


MINIMUM_SIMILARITY_SCORE = 0.35
SIMILAR_TICKET_LIMIT = 5


@dataclass(
    frozen=True,
    slots=True,
)
class TemporaryRAGSolution:
    content: str
    confidence_score: float
    source_request_ids: list[str]


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


def generate_temporary_rag_solution(
    ai_session: AISession,
    user_message: AIMessage,
) -> TemporaryRAGSolution:
    query_text = build_session_query(
        ai_session=ai_session,
        user_message=user_message,
    )

    similar_tickets = find_similar_tickets(
        query_text=query_text,
        limit=SIMILAR_TICKET_LIMIT,
    )

    if not similar_tickets:
        return TemporaryRAGSolution(
            content=(
                "Geçmiş Service Desk kayıtlarında "
                "bu sorunla yeterince benzer bir kayıt "
                "bulunamadı.\n\n"
                "Sorununuz devam ediyorsa Service Desk "
                "bölümünden ticket oluşturabilirsiniz."
            ),
            confidence_score=0.0,
            source_request_ids=[],
        )

    best_ticket = similar_tickets[0]

    confidence_score = normalize_confidence_score(
        best_ticket.get(
            "similarity",
            0.0,
        )
    )

    source_request_ids = [
        str(ticket["request_id"])
        for ticket in similar_tickets
        if ticket.get("request_id") is not None
    ]

    formatted_sources = ", ".join(
        format_source_ticket(request_id)
        for request_id in source_request_ids
    )

    if confidence_score < MINIMUM_SIMILARITY_SCORE:
        return TemporaryRAGSolution(
            content=(
                "Geçmiş Service Desk kayıtları "
                "incelendi ancak güvenilir bir çözüm "
                "önerecek kadar benzer kayıt bulunamadı.\n\n"
                f"En yüksek benzerlik oranı: "
                f"%{confidence_score * 100:.2f}\n"
                f"İncelenen kaynak ticketlar: "
                f"{formatted_sources}\n\n"
                "Sorununuz devam ediyorsa Service Desk "
                "bölümünden ticket oluşturabilirsiniz."
            ),
            confidence_score=confidence_score,
            source_request_ids=source_request_ids,
        )

    resolution = str(
        best_ticket.get("resolution") or ""
    ).strip()

    best_subject = str(
        best_ticket.get("subject") or ""
    ).strip()

    return TemporaryRAGSolution(
        content=(
            "Geçmiş Service Desk kayıtları incelendi.\n\n"
            f"En benzer geçmiş sorun: "
            f"{best_subject or 'Başlık bulunamadı'}\n\n"
            "Geçici çözüm önerisi:\n"
            f"{resolution}\n\n"
            f"Benzerlik oranı: "
            f"%{confidence_score * 100:.2f}\n"
            f"Kaynak ticketlar: {formatted_sources}\n\n"
            "Not: Bu cevap şimdilik mevcut RAG sistemi "
            "tarafından hazırlanmıştır. Ollama "
            "entegrasyonundan sonra kaynaklar kullanılarak "
            "yeni ve adım adım bir çözüm üretilecektir."
        ),
        confidence_score=confidence_score,
        source_request_ids=source_request_ids,
    )
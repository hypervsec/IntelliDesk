import logging
from datetime import datetime
from decimal import Decimal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account, Ticket
from ..routers.auth import get_current_account
from ..sla import calculate_sla_deadlines
from .models import (
    AIMessage,
    AISession,
    AISessionSource,
)
from .rag_service import (
    TemporaryRAGSource,
    generate_temporary_rag_solution,
)
from .schemas import (
    AIAnalyticsSummaryResponse,
    AIConfidenceBandPerformance,
    AIMessageResponse,
    AIResolutionUpdate,
    AISessionCreate,
    AISessionDetailResponse,
    AISessionResponse,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/ai",
    tags=["AI Assistant"],
)


STAFF_ROLES = {
    "technician",
    "admin",
}


# =========================================================
# YARDIMCI FONKSİYONLAR
# =========================================================

def build_session_detail_response(
    ai_session: AISession,
    messages: list[AIMessage],
) -> AISessionDetailResponse:
    session_data = AISessionResponse.model_validate(
        ai_session
    )

    return AISessionDetailResponse(
        **session_data.model_dump(),
        messages=[
            AIMessageResponse.model_validate(message)
            for message in messages
        ],
    )


def get_owned_session(
    session_id: int,
    account_id: int,
    db: Session,
) -> AISession:
    ai_session = db.scalar(
        select(AISession).where(
            AISession.session_id == session_id,
            AISession.account_id == account_id,
        )
    )

    if ai_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI oturumu bulunamadı.",
        )

    return ai_session


def get_accessible_ticket_session(
    ticket_id: int,
    current_account: Account,
    db: Session,
) -> AISession:
    query = select(AISession).where(
        AISession.ticket_id == ticket_id
    )

    if current_account.role not in STAFF_ROLES:
        query = query.where(
            AISession.account_id
            == current_account.account_id
        )

    ai_session = db.scalar(query)

    if ai_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Bu ticketa bağlı AI oturumu "
                "bulunamadı."
            ),
        )

    return ai_session


def get_session_messages(
    session_id: int,
    db: Session,
) -> list[AIMessage]:
    messages = db.scalars(
        select(AIMessage)
        .where(
            AIMessage.session_id == session_id
        )
        .order_by(
            AIMessage.created_at.asc(),
            AIMessage.message_id.asc(),
        )
    ).all()

    return list(messages)


def get_initial_user_message(
    session_id: int,
    db: Session,
) -> AIMessage:
    user_message = db.scalar(
        select(AIMessage)
        .where(
            AIMessage.session_id == session_id,
            AIMessage.sender_type == "user",
        )
        .order_by(
            AIMessage.created_at.asc(),
            AIMessage.message_id.asc(),
        )
        .limit(1)
    )

    if user_message is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "AI oturumuna ait kullanıcı "
                "mesajı bulunamadı."
            ),
        )

    return user_message


def session_has_assistant_message(
    session_id: int,
    db: Session,
) -> bool:
    assistant_message_id = db.scalar(
        select(AIMessage.message_id)
        .where(
            AIMessage.session_id == session_id,
            AIMessage.sender_type == "assistant",
        )
        .limit(1)
    )

    return assistant_message_id is not None


def require_staff_account(
    current_account: Account,
) -> None:
    if current_account.role in STAFF_ROLES:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "AI performans verilerini görüntülemek "
            "için teknisyen veya yönetici yetkisi "
            "gereklidir."
        ),
    )


def calculate_success_rate(
    resolved_count: int,
    feedback_count: int,
) -> float | None:
    if feedback_count <= 0:
        return None

    return round(
        resolved_count
        / feedback_count
        * 100,
        2,
    )


def count_sessions(
    db: Session,
    *conditions,
) -> int:
    count_value = db.scalar(
        select(
            func.count(
                AISession.session_id
            )
        ).where(
            *conditions
        )
    )

    return int(count_value or 0)


def count_source_supported_sessions(
    db: Session,
    *conditions,
) -> int:
    count_value = db.scalar(
        select(
            func.count(
                func.distinct(
                    AISessionSource.session_id
                )
            )
        )
        .join(
            AISession,
            AISession.session_id
            == AISessionSource.session_id,
        )
        .where(
            *conditions
        )
    )

    return int(count_value or 0)


def get_average_confidence_score(
    db: Session,
) -> float | None:
    average_value = db.scalar(
        select(
            func.avg(
                AISession.confidence_score
            )
        ).where(
            AISession.status == "completed",
            AISession.confidence_score.is_not(
                None
            ),
        )
    )

    if average_value is None:
        return None

    return round(
        float(average_value),
        4,
    )


def get_average_solution_time_seconds(
    db: Session,
) -> float | None:
    average_value = db.scalar(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    (
                        AISession.completed_at
                        - AISession.created_at
                    ),
                )
            )
        ).where(
            AISession.status == "completed",
            AISession.completed_at.is_not(
                None
            ),
        )
    )

    if average_value is None:
        return None

    return round(
        max(
            0.0,
            float(average_value),
        ),
        2,
    )


def get_confidence_band_performance(
    db: Session,
    band: str,
    label: str,
    minimum_score: Decimal,
    maximum_score: Decimal | None,
) -> AIConfidenceBandPerformance:
    score_conditions = [
        AISession.confidence_score.is_not(
            None
        ),
        AISession.confidence_score
        >= minimum_score,
        AISession.resolution_status.is_not(
            None
        ),
    ]

    if maximum_score is not None:
        score_conditions.append(
            AISession.confidence_score
            < maximum_score
        )

    feedback_count = count_sessions(
        db,
        *score_conditions,
    )

    resolved_count = count_sessions(
        db,
        *score_conditions,
        AISession.resolution_status
        == "resolved",
    )

    unresolved_count = count_sessions(
        db,
        *score_conditions,
        AISession.resolution_status
        == "unresolved",
    )

    return AIConfidenceBandPerformance(
        band=band,
        label=label,
        feedback_count=feedback_count,
        resolved_count=resolved_count,
        unresolved_count=unresolved_count,
        success_rate=calculate_success_rate(
            resolved_count=resolved_count,
            feedback_count=feedback_count,
        ),
    )


def build_session_source_records(
    session_id: int,
    sources: list[TemporaryRAGSource],
    created_at: datetime,
) -> list[AISessionSource]:
    return [
        AISessionSource(
            session_id=session_id,
            request_id=source.request_id,
            similarity_score=Decimal(
                str(
                    source.similarity_score
                )
            ),
            created_at=created_at,
        )
        for source in sources
    ]


def mark_session_failed(
    session_id: int,
    account_id: int,
    db: Session,
) -> None:
    db.rollback()

    failed_session = get_owned_session(
        session_id=session_id,
        account_id=account_id,
        db=db,
    )

    failed_time = datetime.now()

    failed_session.status = "failed"
    failed_session.updated_at = failed_time

    failure_message = AIMessage(
        session_id=session_id,
        sender_type="system",
        content=(
            "AI çözümü oluşturulurken bir hata oluştu. "
            "Lütfen daha sonra tekrar deneyin. "
            "Başarısız AI işlemi için ticket "
            "oluşturulmadı."
        ),
    )

    db.add(failure_message)
    db.commit()


# =========================================================
# AI OTURUMU OLUŞTURMA
# =========================================================

@router.post(
    "/sessions",
    response_model=AISessionDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ai_session(
    session_data: AISessionCreate,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionDetailResponse:
    normalized_title = (
        session_data.title.strip()
    )

    normalized_description = (
        session_data.description.strip()
    )

    try:
        ai_session = AISession(
            account_id=(
                current_account.account_id
            ),
            ticket_id=None,
            title=normalized_title,
            department=session_data.department,
            category=session_data.category,
            subcategory=session_data.subcategory,
            priority=session_data.priority,
            status="pending",
        )

        db.add(ai_session)
        db.flush()

        user_message = AIMessage(
            session_id=ai_session.session_id,
            sender_type="user",
            content=normalized_description,
        )

        db.add(user_message)
        db.commit()

        db.refresh(ai_session)
        db.refresh(user_message)

    except Exception:
        db.rollback()
        raise

    return build_session_detail_response(
        ai_session=ai_session,
        messages=[user_message],
    )


# =========================================================
# AI PERFORMANS ANALİZİ
# =========================================================

@router.get(
    "/analytics/summary",
    response_model=AIAnalyticsSummaryResponse,
)
def get_ai_analytics_summary(
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AIAnalyticsSummaryResponse:
    require_staff_account(
        current_account=current_account
    )

    total_sessions = count_sessions(
        db
    )

    completed_sessions = count_sessions(
        db,
        AISession.status == "completed",
    )

    failed_sessions = count_sessions(
        db,
        AISession.status == "failed",
    )

    resolved_count = count_sessions(
        db,
        AISession.resolution_status
        == "resolved",
    )

    unresolved_count = count_sessions(
        db,
        AISession.resolution_status
        == "unresolved",
    )

    feedback_count = (
        resolved_count
        + unresolved_count
    )

    awaiting_feedback_count = count_sessions(
        db,
        AISession.status == "completed",
        AISession.ticket_id.is_not(None),
        AISession.resolution_status.is_(
            None
        ),
    )

    source_supported_sessions = (
        count_source_supported_sessions(
            db
        )
    )

    source_supported_resolved_count = (
        count_source_supported_sessions(
            db,
            AISession.resolution_status
            == "resolved",
        )
    )

    source_supported_unresolved_count = (
        count_source_supported_sessions(
            db,
            AISession.resolution_status
            == "unresolved",
        )
    )

    source_supported_feedback_count = (
        source_supported_resolved_count
        + source_supported_unresolved_count
    )

    high_confidence_unresolved_count = (
        count_sessions(
            db,
            AISession.resolution_status
            == "unresolved",
            AISession.confidence_score.is_not(
                None
            ),
            AISession.confidence_score
            >= Decimal("0.8000"),
        )
    )

    confidence_bands = [
        get_confidence_band_performance(
            db=db,
            band="high",
            label="%80 ve üzeri",
            minimum_score=Decimal(
                "0.8000"
            ),
            maximum_score=None,
        ),
        get_confidence_band_performance(
            db=db,
            band="medium",
            label="%60 - %79",
            minimum_score=Decimal(
                "0.6000"
            ),
            maximum_score=Decimal(
                "0.8000"
            ),
        ),
        get_confidence_band_performance(
            db=db,
            band="low",
            label="%60 altı",
            minimum_score=Decimal(
                "0.0000"
            ),
            maximum_score=Decimal(
                "0.6000"
            ),
        ),
    ]

    return AIAnalyticsSummaryResponse(
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        failed_sessions=failed_sessions,

        resolved_count=resolved_count,
        unresolved_count=unresolved_count,
        awaiting_feedback_count=(
            awaiting_feedback_count
        ),

        success_rate=calculate_success_rate(
            resolved_count=resolved_count,
            feedback_count=feedback_count,
        ),

        average_confidence_score=(
            get_average_confidence_score(
                db=db
            )
        ),

        average_solution_time_seconds=(
            get_average_solution_time_seconds(
                db=db
            )
        ),

        source_supported_sessions=(
            source_supported_sessions
        ),

        source_supported_feedback_count=(
            source_supported_feedback_count
        ),

        source_supported_resolved_count=(
            source_supported_resolved_count
        ),

        source_supported_unresolved_count=(
            source_supported_unresolved_count
        ),

        source_supported_success_rate=(
            calculate_success_rate(
                resolved_count=(
                    source_supported_resolved_count
                ),
                feedback_count=(
                    source_supported_feedback_count
                ),
            )
        ),

        high_confidence_unresolved_count=(
            high_confidence_unresolved_count
        ),

        confidence_bands=confidence_bands,
    )


# =========================================================
# KULLANICININ AI OTURUMLARI
# =========================================================

@router.get(
    "/sessions",
    response_model=list[AISessionResponse],
)
def list_my_ai_sessions(
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> list[AISession]:
    ai_sessions = db.scalars(
        select(AISession)
        .where(
            AISession.account_id
            == current_account.account_id
        )
        .order_by(
            AISession.created_at.desc(),
            AISession.session_id.desc(),
        )
    ).all()

    return list(ai_sessions)


# =========================================================
# TICKETA BAĞLI AI OTURUMU
# =========================================================

@router.get(
    "/tickets/{ticket_id}",
    response_model=AISessionDetailResponse,
)
def get_ticket_ai_session(
    ticket_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionDetailResponse:
    ai_session = get_accessible_ticket_session(
        ticket_id=ticket_id,
        current_account=current_account,
        db=db,
    )

    messages = get_session_messages(
        session_id=ai_session.session_id,
        db=db,
    )

    return build_session_detail_response(
        ai_session=ai_session,
        messages=messages,
    )


# =========================================================
# AI OTURUM DETAYI
# =========================================================

@router.get(
    "/sessions/{session_id}",
    response_model=AISessionDetailResponse,
)
def get_ai_session_detail(
    session_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionDetailResponse:
    ai_session = get_owned_session(
        session_id=session_id,
        account_id=(
            current_account.account_id
        ),
        db=db,
    )

    messages = get_session_messages(
        session_id=session_id,
        db=db,
    )

    return build_session_detail_response(
        ai_session=ai_session,
        messages=messages,
    )


# =========================================================
# RAG ÇÖZÜMÜ VE TICKET OLUŞTURMA
# =========================================================

@router.post(
    "/sessions/{session_id}/solution",
    response_model=AISessionDetailResponse,
)
def generate_ai_session_solution(
    session_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionDetailResponse:
    ai_session = get_owned_session(
        session_id=session_id,
        account_id=(
            current_account.account_id
        ),
        db=db,
    )

    if ai_session.resolution_status is not None:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Sonuçlandırılmış bir AI oturumu "
                "için çözüm oluşturulamaz."
            ),
        )

    if ai_session.status == "processing":
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Bu AI oturumu şu anda "
                "işlenmektedir."
            ),
        )

    if session_has_assistant_message(
        session_id=session_id,
        db=db,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Bu AI oturumu için çözüm "
                "zaten oluşturulmuş."
            ),
        )

    if ai_session.ticket_id is not None:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Bu AI oturumu için ticket "
                "zaten oluşturulmuş."
            ),
        )

    user_message = get_initial_user_message(
        session_id=session_id,
        db=db,
    )

    processing_time = datetime.now()

    ai_session.status = "processing"
    ai_session.updated_at = processing_time

    db.commit()
    db.refresh(ai_session)

    try:
        rag_solution = (
            generate_temporary_rag_solution(
                ai_session=ai_session,
                user_message=user_message,
            )
        )

    except Exception as exc:
        mark_session_failed(
            session_id=session_id,
            account_id=(
                current_account.account_id
            ),
            db=db,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI çözüm servisi şu anda "
                "kullanılamıyor. "
                "Ticket oluşturulmadı."
            ),
        ) from exc

    completed_time = datetime.now()

    confidence_score = Decimal(
        str(
            rag_solution.confidence_score
        )
    )

    (
        first_response_due_at,
        resolution_due_at,
    ) = calculate_sla_deadlines(
        created_at=completed_time,
        priority=ai_session.priority,
    )

    try:
        ticket = Ticket(
            title=ai_session.title,
            description=user_message.content,
            requester_name=(
                current_account.full_name
            ),
            department=ai_session.department,
            category=ai_session.category,
            subcategory=ai_session.subcategory,
            priority=ai_session.priority,
            status="open",

            ai_recommendation=(
                rag_solution.content
            ),
            ai_confidence_score=(
                confidence_score
            ),

            created_at=completed_time,
            sla_started_at=completed_time,

            first_response_due_at=(
                first_response_due_at
            ),

            resolution_due_at=(
                resolution_due_at
            ),

            first_responded_at=None,
        )

        db.add(ticket)
        db.flush()

        assistant_message = AIMessage(
            session_id=session_id,
            sender_type="assistant",
            content=rag_solution.content,
        )

        source_records = (
            build_session_source_records(
                session_id=session_id,
                sources=rag_solution.sources,
                created_at=completed_time,
            )
        )

        ai_session.ticket_id = (
            ticket.ticket_id
        )

        ai_session.status = "completed"

        ai_session.confidence_score = (
            confidence_score
        )

        ai_session.updated_at = completed_time
        ai_session.completed_at = completed_time

        db.add(assistant_message)

        if source_records:
            db.add_all(
                source_records
            )

        db.commit()

    except Exception as exc:
        logger.exception(
            (
                "AI çözüm kayıt işlemi başarısız | "
                "session_id=%s | "
                "source_count=%s | "
                "error_type=%s | "
                "error=%s"
            ),
            session_id,
            len(rag_solution.sources),
            type(exc).__name__,
            exc,
        )

        mark_session_failed(
            session_id=session_id,
            account_id=(
                current_account.account_id
            ),
            db=db,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "AI çözümü alındı ancak kayıt "
                "tamamlanamadı. "
                "Ticket oluşturulmadı."
            ),
        ) from exc

    db.refresh(ticket)
    db.refresh(ai_session)
    db.refresh(assistant_message)

    messages = get_session_messages(
        session_id=session_id,
        db=db,
    )

    return build_session_detail_response(
        ai_session=ai_session,
        messages=messages,
    )


# =========================================================
# AI OTURUM SONUCU
# =========================================================

@router.patch(
    "/sessions/{session_id}/resolution",
    response_model=AISessionDetailResponse,
)
def update_ai_session_resolution(
    session_id: int,
    resolution_data: AIResolutionUpdate,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionDetailResponse:
    ai_session = get_owned_session(
        session_id=session_id,
        account_id=(
            current_account.account_id
        ),
        db=db,
    )

    if not session_has_assistant_message(
        session_id=session_id,
        db=db,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "AI çözümü oluşmadan sonuç "
                "geri bildirimi kaydedilemez."
            ),
        )

    current_time = datetime.now()

    ai_session.resolution_status = (
        resolution_data.resolution_status
    )

    ai_session.status = "completed"
    ai_session.updated_at = current_time

    if ai_session.completed_at is None:
        ai_session.completed_at = (
            current_time
        )

    db.commit()
    db.refresh(ai_session)

    messages = get_session_messages(
        session_id=session_id,
        db=db,
    )

    return build_session_detail_response(
        ai_session=ai_session,
        messages=messages,
    )
from datetime import datetime
from decimal import Decimal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account, Ticket
from ..routers.auth import get_current_account
from .models import AIMessage, AISession
from .rag_service import generate_temporary_rag_solution
from .schemas import (
    AIMessageResponse,
    AIResolutionUpdate,
    AISessionCreate,
    AISessionDetailResponse,
    AISessionResponse,
)


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
    normalized_title = session_data.title.strip()
    normalized_description = (
        session_data.description.strip()
    )

    try:
        # Bu aşamada ticket oluşturulmaz.
        # Ticket yalnızca AI çözümü başarılı olursa
        # solution endpointinde oluşturulur.
        ai_session = AISession(
            account_id=current_account.account_id,
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
        account_id=current_account.account_id,
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
        account_id=current_account.account_id,
        db=db,
    )

    if ai_session.resolution_status is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Sonuçlandırılmış bir AI oturumu "
                "için çözüm oluşturulamaz."
            ),
        )

    if ai_session.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Bu AI oturumu için çözüm "
                "zaten oluşturulmuş."
            ),
        )

    if ai_session.ticket_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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
        # Önce AI servisinden başarılı cevap beklenir.
        rag_solution = generate_temporary_rag_solution(
            ai_session=ai_session,
            user_message=user_message,
        )

    except Exception as exc:
        mark_session_failed(
            session_id=session_id,
            account_id=current_account.account_id,
            db=db,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI çözüm servisi şu anda "
                "kullanılamıyor. Ticket oluşturulmadı."
            ),
        ) from exc

    completed_time = datetime.now()

    try:
        # AI cevabı başarılı olduktan sonra ticket
        # ve assistant mesajı aynı transaction içinde
        # oluşturulur.
        ticket = Ticket(
            title=ai_session.title,
            description=user_message.content,
            requester_name=current_account.full_name,
            department=ai_session.department,
            category=ai_session.category,
            subcategory=ai_session.subcategory,
            priority=ai_session.priority,
            status="open",
        )

        db.add(ticket)
        db.flush()

        assistant_message = AIMessage(
            session_id=session_id,
            sender_type="assistant",
            content=rag_solution.content,
        )

        ai_session.ticket_id = ticket.ticket_id
        ai_session.status = "completed"

        ai_session.confidence_score = Decimal(
            str(rag_solution.confidence_score)
        )

        ai_session.updated_at = completed_time
        ai_session.completed_at = completed_time

        db.add(assistant_message)
        db.commit()

    except Exception as exc:
        mark_session_failed(
            session_id=session_id,
            account_id=current_account.account_id,
            db=db,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "AI çözümü alındı ancak kayıt "
                "tamamlanamadı. Ticket oluşturulmadı."
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
        account_id=current_account.account_id,
        db=db,
    )

    if not session_has_assistant_message(
        session_id=session_id,
        db=db,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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
        ai_session.completed_at = current_time

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
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
from ..models import Account
from ..routers.auth import get_current_account
from .models import AIMessage, AISession
from .rag_service import (
    generate_temporary_rag_solution,
)
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
            AIMessageResponse.model_validate(
                message
            )
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
    ai_session = AISession(
        account_id=current_account.account_id,
        title=session_data.title.strip(),
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
        content=session_data.description.strip(),
    )

    db.add(user_message)
    db.commit()

    db.refresh(ai_session)
    db.refresh(user_message)

    return build_session_detail_response(
        ai_session=ai_session,
        messages=[
            user_message,
        ],
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
# GEÇİCİ RAG ÇÖZÜMÜ
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
        db.rollback()

        failed_session = get_owned_session(
            session_id=session_id,
            account_id=current_account.account_id,
            db=db,
        )

        failed_time = datetime.now()

        failed_session.status = "failed"
        failed_session.updated_at = failed_time

        failure_message = AIMessage(
            session_id=session_id,
            sender_type="system",
            content=(
                "AI çözümü oluşturulurken bir hata "
                "oluştu. Lütfen daha sonra tekrar "
                "deneyin veya Service Desk bölümünden "
                "ticket oluşturun."
            ),
        )

        db.add(failure_message)
        db.commit()

        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "AI çözüm servisi şu anda "
                "kullanılamıyor."
            ),
        ) from exc

    completed_time = datetime.now()

    assistant_message = AIMessage(
        session_id=session_id,
        sender_type="assistant",
        content=rag_solution.content,
    )

    ai_session.status = "completed"
    ai_session.confidence_score = Decimal(
        str(rag_solution.confidence_score)
    )
    ai_session.updated_at = completed_time
    ai_session.completed_at = completed_time

    db.add(assistant_message)
    db.commit()

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
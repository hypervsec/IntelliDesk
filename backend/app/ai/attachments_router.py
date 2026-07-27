from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..attachments.storage import (
    delete_stored_file,
    remove_empty_ticket_directory,
    resolve_storage_path,
)
from ..database import get_db
from ..models import Account
from ..routers.auth import get_current_account
from .attachment_schemas import (
    AISessionAttachmentDeleteResponse,
    AISessionAttachmentResponse,
)
from .attachment_storage import (
    MAX_AI_SESSION_ATTACHMENTS,
    save_ai_session_attachment,
)
from .models import (
    AISession,
    AISessionAttachment,
)


router = APIRouter(
    prefix="/ai/sessions",
    tags=["AI Session Attachments"],
)

STAFF_ROLES = {
    "technician",
    "admin",
}

EDITABLE_SESSION_STATUSES = {
    "pending",
    "failed",
}


def get_accessible_session(
    session_id: int,
    current_account: Account,
    db: Session,
) -> AISession:
    query = select(AISession).where(
        AISession.session_id == session_id
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
            detail="AI oturumu bulunamadı.",
        )

    return ai_session


def ensure_session_is_editable(
    ai_session: AISession,
) -> None:
    is_editable = (
        ai_session.status
        in EDITABLE_SESSION_STATUSES
        and ai_session.ticket_id is None
        and ai_session.resolution_status is None
    )

    if is_editable:
        return

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            "AI çözümü oluşturulmaya başladıktan "
            "sonra görseller değiştirilemez."
        ),
    )


def get_attachment_or_404(
    session_id: int,
    attachment_id: int,
    db: Session,
) -> AISessionAttachment:
    attachment = db.scalar(
        select(AISessionAttachment).where(
            AISessionAttachment.attachment_id
            == attachment_id,
            AISessionAttachment.session_id
            == session_id,
        )
    )

    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI oturumu görseli bulunamadı.",
        )

    return attachment


def count_session_attachments(
    session_id: int,
    db: Session,
) -> int:
    attachment_count = db.scalar(
        select(
            func.count(
                AISessionAttachment.attachment_id
            )
        ).where(
            AISessionAttachment.session_id
            == session_id
        )
    )

    return int(attachment_count or 0)


@router.get(
    "/{session_id}/attachments",
    response_model=list[
        AISessionAttachmentResponse
    ],
)
def list_ai_session_attachments(
    session_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> list[AISessionAttachment]:
    get_accessible_session(
        session_id=session_id,
        current_account=current_account,
        db=db,
    )

    attachments = db.scalars(
        select(AISessionAttachment)
        .where(
            AISessionAttachment.session_id
            == session_id
        )
        .order_by(
            AISessionAttachment.created_at.asc(),
            AISessionAttachment.attachment_id.asc(),
        )
    ).all()

    return list(attachments)


@router.post(
    "/{session_id}/attachments",
    response_model=(
        AISessionAttachmentResponse
    ),
    status_code=status.HTTP_201_CREATED,
)
async def upload_ai_session_attachment(
    session_id: int,
    file: UploadFile = File(...),
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionAttachment:
    ai_session = get_accessible_session(
        session_id=session_id,
        current_account=current_account,
        db=db,
    )

    ensure_session_is_editable(ai_session)

    attachment_count = count_session_attachments(
        session_id=session_id,
        db=db,
    )

    if attachment_count >= MAX_AI_SESSION_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Bir AI oturumuna en fazla "
                f"{MAX_AI_SESSION_ATTACHMENTS} "
                "görsel yüklenebilir."
            ),
        )

    stored_attachment = (
        await save_ai_session_attachment(
            session_id=session_id,
            upload_file=file,
        )
    )

    attachment = AISessionAttachment(
        session_id=session_id,
        uploader_account_id=(
            current_account.account_id
        ),
        uploader_name=current_account.full_name,
        uploader_role=current_account.role,
        original_filename=(
            stored_attachment.original_filename
        ),
        stored_filename=(
            stored_attachment.stored_filename
        ),
        storage_path=(
            stored_attachment.storage_path
        ),
        content_type=(
            stored_attachment.content_type
        ),
        file_extension=(
            stored_attachment.file_extension
        ),
        size_bytes=(
            stored_attachment.size_bytes
        ),
        sha256=stored_attachment.sha256,
    )

    db.add(attachment)

    try:
        db.commit()
        db.refresh(attachment)

    except Exception:
        db.rollback()

        try:
            delete_stored_file(
                stored_attachment.storage_path
            )
        except OSError:
            pass

        raise

    return attachment


@router.get(
    "/{session_id}/attachments/"
    "{attachment_id}/content",
    response_class=FileResponse,
)
def get_ai_session_attachment_content(
    session_id: int,
    attachment_id: int,
    download: bool = Query(default=False),
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> Response:
    get_accessible_session(
        session_id=session_id,
        current_account=current_account,
        db=db,
    )

    attachment = get_attachment_or_404(
        session_id=session_id,
        attachment_id=attachment_id,
        db=db,
    )

    absolute_path = resolve_storage_path(
        attachment.storage_path
    )

    if not absolute_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Görsel sunucu diskinde "
                "bulunamadı."
            ),
        )

    disposition_type = (
        "attachment"
        if download
        else "inline"
    )

    encoded_filename = quote(
        attachment.original_filename,
        safe="",
    )

    return FileResponse(
        path=absolute_path,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": (
                f"{disposition_type}; "
                "filename*=UTF-8''"
                f"{encoded_filename}"
            ),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete(
    "/{session_id}/attachments/"
    "{attachment_id}",
    response_model=(
        AISessionAttachmentDeleteResponse
    ),
)
def delete_ai_session_attachment(
    session_id: int,
    attachment_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AISessionAttachmentDeleteResponse:
    ai_session = get_accessible_session(
        session_id=session_id,
        current_account=current_account,
        db=db,
    )

    ensure_session_is_editable(ai_session)

    attachment = get_attachment_or_404(
        session_id=session_id,
        attachment_id=attachment_id,
        db=db,
    )

    original_filename = (
        attachment.original_filename
    )

    absolute_path = resolve_storage_path(
        attachment.storage_path
    )

    temporary_delete_path: Path | None = None

    if absolute_path.is_file():
        temporary_delete_path = (
            absolute_path.with_name(
                f".{absolute_path.name}."
                f"{uuid4().hex}.deleting"
            )
        )

        absolute_path.replace(
            temporary_delete_path
        )

    db.delete(attachment)

    try:
        db.commit()

    except Exception:
        db.rollback()

        if (
            temporary_delete_path is not None
            and temporary_delete_path.is_file()
        ):
            temporary_delete_path.replace(
                absolute_path
            )

        raise

    if temporary_delete_path is not None:
        try:
            temporary_delete_path.unlink(
                missing_ok=True
            )
        except OSError:
            pass

    remove_empty_ticket_directory(
        absolute_path.parent
    )

    return AISessionAttachmentDeleteResponse(
        message=(
            f"{original_filename} "
            "görseli kaldırıldı."
        )
    )
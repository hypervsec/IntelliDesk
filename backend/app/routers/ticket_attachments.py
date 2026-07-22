from datetime import datetime
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
from sqlalchemy import (
    select,
)
from sqlalchemy.orm import Session

from ..attachments.models import (
    TicketAttachment,
)
from ..attachments.schemas import (
    AttachmentDeleteResponse,
    TicketAttachmentResponse,
)
from ..attachments.storage import (
    delete_stored_file,
    remove_empty_ticket_directory,
    resolve_storage_path,
    save_ticket_attachment,
)
from ..audit.service import (
    insert_audit_log,
)
from ..database import get_db
from ..models import (
    Account,
    Ticket,
    TicketTimelineEntry,
)
from ..request_context import (
    get_request_metadata,
)
from .auth import get_current_account


router = APIRouter(
    prefix="/tickets",
    tags=["Ticket Attachments"],
)


STAFF_ROLES = {
    "technician",
    "admin",
}


def get_ticket_or_404(
    db: Session,
    ticket_id: int,
) -> Ticket:
    ticket = db.get(
        Ticket,
        ticket_id,
    )

    if ticket is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Ticket bulunamadı.",
        )

    return ticket


def get_attachment_or_404(
    db: Session,
    ticket_id: int,
    attachment_id: int,
) -> TicketAttachment:
    attachment = db.scalar(
        select(
            TicketAttachment
        ).where(
            TicketAttachment.attachment_id
            == attachment_id,
            TicketAttachment.ticket_id
            == ticket_id,
        )
    )

    if attachment is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Dosya eki bulunamadı.",
        )

    return attachment


def get_audit_request_values() -> tuple[
    str | None,
    str | None,
    str | None,
]:
    request_metadata = (
        get_request_metadata()
    )

    if request_metadata is None:
        return (
            None,
            None,
            None,
        )

    return (
        request_metadata.ip_address,
        request_metadata.http_method,
        request_metadata.request_path,
    )


@router.get(
    "/{ticket_id}/attachments",
    response_model=list[
        TicketAttachmentResponse
    ],
)
def list_ticket_attachments(
    ticket_id: int,
    _current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> list[TicketAttachment]:
    get_ticket_or_404(
        db,
        ticket_id,
    )

    attachments = db.scalars(
        select(
            TicketAttachment
        )
        .where(
            TicketAttachment.ticket_id
            == ticket_id
        )
        .order_by(
            TicketAttachment.created_at
            .desc(),
            TicketAttachment.attachment_id
            .desc(),
        )
    ).all()

    return list(attachments)


@router.post(
    "/{ticket_id}/attachments",
    response_model=(
        TicketAttachmentResponse
    ),
    status_code=(
        status.HTTP_201_CREATED
    ),
)
async def upload_ticket_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> TicketAttachment:
    ticket = get_ticket_or_404(
        db,
        ticket_id,
    )

    stored_attachment = (
        await save_ticket_attachment(
            ticket_id,
            file,
        )
    )

    created_at = datetime.now()

    attachment = TicketAttachment(
        ticket_id=ticket.ticket_id,
        uploader_account_id=(
            current_account.account_id
        ),
        uploader_name=(
            current_account.full_name
        ),
        uploader_role=(
            current_account.role
        ),
        original_filename=(
            stored_attachment
            .original_filename
        ),
        stored_filename=(
            stored_attachment
            .stored_filename
        ),
        storage_path=(
            stored_attachment
            .storage_path
        ),
        content_type=(
            stored_attachment
            .content_type
        ),
        file_extension=(
            stored_attachment
            .file_extension
        ),
        size_bytes=(
            stored_attachment
            .size_bytes
        ),
        sha256=(
            stored_attachment
            .sha256
        ),
        created_at=created_at,
    )

    timeline_entry = TicketTimelineEntry(
        ticket_id=ticket.ticket_id,
        actor_account_id=(
            current_account.account_id
        ),
        actor_name=(
            current_account.full_name
        ),
        actor_role=(
            current_account.role
        ),
        entry_type="attachment_added",
        field_name="attachment",
        old_value=None,
        new_value=(
            stored_attachment
            .original_filename
        ),
        content=(
            f"{stored_attachment.original_filename} "
            "dosyası eklendi."
        ),
        created_at=created_at,
    )

    db.add(attachment)
    db.add(timeline_entry)

    ticket.updated_at = created_at

    if (
        current_account.role
        in STAFF_ROLES
        and ticket.sla_started_at
        is not None
        and ticket.first_responded_at
        is None
    ):
        ticket.first_responded_at = (
            created_at
        )

    try:
        db.flush()

        (
            ip_address,
            http_method,
            request_path,
        ) = get_audit_request_values()

        insert_audit_log(
            db.connection(),
            actor_account_id=(
                current_account.account_id
            ),
            actor_name=(
                current_account.full_name
            ),
            actor_role=(
                current_account.role
            ),
            action_type=(
                "ticket_attachment_uploaded"
            ),
            entity_type=(
                "ticket_attachment"
            ),
            entity_id=(
                attachment.attachment_id
            ),
            ticket_id=ticket.ticket_id,
            description=(
                f"{current_account.full_name}, "
                f"{stored_attachment.original_filename} "
                f"dosyasını #{ticket.ticket_id} "
                "numaralı ticketa ekledi."
            ),
            ip_address=ip_address,
            http_method=http_method,
            request_path=request_path,
            status_code=(
                status.HTTP_201_CREATED
            ),
            details={
                "attachment_id": (
                    attachment.attachment_id
                ),
                "filename": (
                    stored_attachment
                    .original_filename
                ),
                "content_type": (
                    stored_attachment
                    .content_type
                ),
                "size_bytes": (
                    stored_attachment
                    .size_bytes
                ),
                "sha256": (
                    stored_attachment
                    .sha256
                ),
            },
            created_at=created_at,
        )

        db.commit()
        db.refresh(attachment)

        return attachment

    except Exception:
        db.rollback()

        stored_attachment.absolute_path.unlink(
            missing_ok=True
        )

        remove_empty_ticket_directory(
            stored_attachment
            .absolute_path
            .parent
        )

        raise


@router.get(
    "/{ticket_id}/attachments/"
    "{attachment_id}/content",
    response_class=FileResponse,
)
def get_ticket_attachment_content(
    ticket_id: int,
    attachment_id: int,
    download: bool = Query(
        default=False,
    ),
    _current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> Response:
    get_ticket_or_404(
        db,
        ticket_id,
    )

    attachment = get_attachment_or_404(
        db,
        ticket_id,
        attachment_id,
    )

    absolute_path = resolve_storage_path(
        attachment.storage_path
    )

    if not absolute_path.is_file():
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Dosya sunucu diskinde bulunamadı."
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

    response_headers = {
        "Content-Disposition": (
            f"{disposition_type}; "
            f"filename*=UTF-8''"
            f"{encoded_filename}"
        ),
        "X-Content-Type-Options": "nosniff",
    }

    return FileResponse(
        path=absolute_path,
        media_type=(
            attachment.content_type
        ),
        headers=response_headers,
    )


@router.delete(
    "/{ticket_id}/attachments/"
    "{attachment_id}",
    response_model=(
        AttachmentDeleteResponse
    ),
)
def delete_ticket_attachment(
    ticket_id: int,
    attachment_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> AttachmentDeleteResponse:
    ticket = get_ticket_or_404(
        db,
        ticket_id,
    )

    attachment = get_attachment_or_404(
        db,
        ticket_id,
        attachment_id,
    )

    is_uploader = (
        attachment.uploader_account_id
        == current_account.account_id
    )

    is_staff = (
        current_account.role
        in STAFF_ROLES
    )

    if not is_uploader and not is_staff:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Bu dosyayı yalnızca yükleyen "
                "kullanıcı, teknisyen veya "
                "yönetici silebilir."
            ),
        )

    original_filename = (
        attachment.original_filename
    )

    storage_path = (
        attachment.storage_path
    )

    absolute_path = resolve_storage_path(
        storage_path
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

    created_at = datetime.now()

    timeline_entry = TicketTimelineEntry(
        ticket_id=ticket.ticket_id,
        actor_account_id=(
            current_account.account_id
        ),
        actor_name=(
            current_account.full_name
        ),
        actor_role=(
            current_account.role
        ),
        entry_type="attachment_removed",
        field_name="attachment",
        old_value=original_filename,
        new_value=None,
        content=(
            f"{original_filename} "
            "dosyası kaldırıldı."
        ),
        created_at=created_at,
    )

    db.add(timeline_entry)
    db.delete(attachment)

    ticket.updated_at = created_at

    try:
        (
            ip_address,
            http_method,
            request_path,
        ) = get_audit_request_values()

        insert_audit_log(
            db.connection(),
            actor_account_id=(
                current_account.account_id
            ),
            actor_name=(
                current_account.full_name
            ),
            actor_role=(
                current_account.role
            ),
            action_type=(
                "ticket_attachment_deleted"
            ),
            entity_type=(
                "ticket_attachment"
            ),
            entity_id=attachment_id,
            ticket_id=ticket.ticket_id,
            description=(
                f"{current_account.full_name}, "
                f"{original_filename} dosyasını "
                f"#{ticket.ticket_id} numaralı "
                "ticket üzerinden kaldırdı."
            ),
            ip_address=ip_address,
            http_method=http_method,
            request_path=request_path,
            status_code=(
                status.HTTP_200_OK
            ),
            details={
                "attachment_id": (
                    attachment_id
                ),
                "filename": (
                    original_filename
                ),
            },
            created_at=created_at,
        )

        db.commit()

    except Exception:
        db.rollback()

        if (
            temporary_delete_path
            is not None
            and temporary_delete_path
            .is_file()
        ):
            temporary_delete_path.replace(
                absolute_path
            )

        raise

    if temporary_delete_path is not None:
        temporary_delete_path.unlink(
            missing_ok=True
        )

        remove_empty_ticket_directory(
            temporary_delete_path.parent
        )
    else:
        delete_stored_file(
            storage_path
        )

    return AttachmentDeleteResponse(
        message=(
            "Dosya eki başarıyla silindi."
        )
    )
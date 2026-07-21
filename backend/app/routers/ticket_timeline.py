from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Account,
    Ticket,
    TicketTimelineEntry,
)
from ..routers.auth import (
    get_current_account,
)
from ..timeline_schemas import (
    TicketCommentCreate,
    TicketTimelineEntryResponse,
)


router = APIRouter(
    prefix="/tickets",
    tags=["Ticket Timeline"],
)


STAFF_ROLES = {
    "technician",
    "admin",
}


# =========================================================
# ZAMAN ÇİZELGESİNİ LİSTELE
# =========================================================

@router.get(
    "/{ticket_id}/timeline",
    response_model=list[
        TicketTimelineEntryResponse
    ],
)
def list_ticket_timeline(
    ticket_id: int,
    _current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> list[TicketTimelineEntry]:
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

    timeline_entries = db.scalars(
        select(
            TicketTimelineEntry
        )
        .where(
            TicketTimelineEntry.ticket_id
            == ticket_id
        )
        .order_by(
            TicketTimelineEntry
            .created_at
            .asc(),
            TicketTimelineEntry
            .entry_id
            .asc(),
        )
    ).all()

    return list(timeline_entries)


# =========================================================
# YORUM EKLE
# =========================================================

@router.post(
    "/{ticket_id}/comments",
    response_model=(
        TicketTimelineEntryResponse
    ),
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_ticket_comment(
    ticket_id: int,
    comment_data: TicketCommentCreate,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> TicketTimelineEntry:
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

    created_at = datetime.now()

    timeline_entry = (
        TicketTimelineEntry(
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
            entry_type="comment",
            field_name=None,
            old_value=None,
            new_value=None,
            content=comment_data.content,
            created_at=created_at,
        )
    )

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

    db.commit()
    db.refresh(timeline_entry)

    return timeline_entry
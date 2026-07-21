from datetime import datetime

from sqlalchemy import (
    event,
    func,
    inspect,
    select,
)
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapper

from ..models import (
    Account,
    Notification,
    Ticket,
)
from ..sla import calculate_sla_deadlines


FIRST_RESPONSE_STATUSES = {
    "assigned",
    "in_progress",
    "waiting_user",
    "resolved",
    "closed",
}


# =========================================================
# YENİ TICKET İÇİN SLA TARİHLERİ
# =========================================================

@event.listens_for(
    Ticket,
    "before_insert",
)
def set_initial_ticket_sla(
    _mapper: Mapper,
    _connection: Connection,
    ticket: Ticket,
) -> None:
    created_at = (
        ticket.created_at
        or datetime.now()
    )

    ticket.created_at = created_at

    if ticket.sla_started_at is None:
        ticket.sla_started_at = created_at

    (
        first_response_due_at,
        resolution_due_at,
    ) = calculate_sla_deadlines(
        created_at=ticket.sla_started_at,
        priority=ticket.priority,
    )

    if ticket.first_response_due_at is None:
        ticket.first_response_due_at = (
            first_response_due_at
        )

    if ticket.resolution_due_at is None:
        ticket.resolution_due_at = (
            resolution_due_at
        )

    assigned_technician = (
        ticket.assigned_technician
        or ""
    ).strip()

    if (
        ticket.first_responded_at is None
        and (
            assigned_technician
            or ticket.status
            in FIRST_RESPONSE_STATUSES
        )
    ):
        ticket.first_responded_at = created_at


# =========================================================
# TICKET GÜNCELLENİRKEN SLA YÖNETİMİ
# =========================================================

@event.listens_for(
    Ticket,
    "before_update",
)
def update_ticket_sla(
    _mapper: Mapper,
    _connection: Connection,
    ticket: Ticket,
) -> None:
    if ticket.sla_started_at is None:
        return

    ticket_state = inspect(ticket)

    priority_history = (
        ticket_state
        .attrs
        .priority
        .history
    )

    priority_changed = (
        priority_history.has_changes()
    )

    if (
        priority_changed
        or ticket.first_response_due_at is None
        or ticket.resolution_due_at is None
    ):
        (
            first_response_due_at,
            resolution_due_at,
        ) = calculate_sla_deadlines(
            created_at=ticket.sla_started_at,
            priority=ticket.priority,
        )

        if (
            priority_changed
            or ticket.first_response_due_at is None
        ):
            ticket.first_response_due_at = (
                first_response_due_at
            )

        if (
            priority_changed
            or ticket.resolution_due_at is None
        ):
            ticket.resolution_due_at = (
                resolution_due_at
            )

    if ticket.first_responded_at is not None:
        return

    assignment_history = (
        ticket_state
        .attrs
        .assigned_technician
        .history
    )

    status_history = (
        ticket_state
        .attrs
        .status
        .history
    )

    assigned_technician = (
        ticket.assigned_technician
        or ""
    ).strip()

    technician_assigned = (
        assignment_history.has_changes()
        and bool(assigned_technician)
    )

    response_status_started = (
        status_history.has_changes()
        and ticket.status
        in FIRST_RESPONSE_STATUSES
    )

    if (
        technician_assigned
        or response_status_started
    ):
        ticket.first_responded_at = (
            datetime.now()
        )


# =========================================================
# TICKET ATAMA BİLDİRİMİ
# =========================================================

@event.listens_for(
    Ticket,
    "after_update",
)
def create_ticket_assignment_notification(
    _mapper: Mapper,
    connection: Connection,
    ticket: Ticket,
) -> None:
    ticket_state = inspect(ticket)

    assignment_history = (
        ticket_state
        .attrs
        .assigned_technician
        .history
    )

    if not assignment_history.has_changes():
        return

    assigned_technician = (
        ticket.assigned_technician
    )

    if assigned_technician is None:
        return

    normalized_name = (
        assigned_technician
        .strip()
        .lower()
    )

    if not normalized_name:
        return

    account_id = connection.execute(
        select(Account.account_id).where(
            Account.is_active.is_(True),
            func.lower(
                func.trim(
                    Account.full_name
                )
            )
            == normalized_name,
        )
    ).scalar_one_or_none()

    if account_id is None:
        return

    connection.execute(
        Notification.__table__.insert().values(
            account_id=account_id,
            ticket_id=ticket.ticket_id,
            notification_type=(
                "ticket_assigned"
            ),
            title="Yeni ticket atandı",
            message=(
                f"#{ticket.ticket_id} numaralı "
                f'"{ticket.title}" başlıklı '
                "ticket size atandı."
            ),
            is_read=False,
            created_at=datetime.now(),
            read_at=None,
        )
    )
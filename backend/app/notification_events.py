from datetime import datetime

from sqlalchemy import (
    event,
    func,
    inspect,
    select,
)
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapper

from .models import (
    Account,
    Notification,
    Ticket,
)


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
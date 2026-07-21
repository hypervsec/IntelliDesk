from datetime import datetime

from sqlalchemy import (
    event,
    inspect,
)
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapper

from ..models import (
    Ticket,
    TicketTimelineEntry,
)
from ..request_context import (
    get_request_actor,
)
from .service import (
    TRACKED_TICKET_FIELDS,
    create_change_description,
    normalize_timeline_value,
)


# =========================================================
# TICKET OLUŞTURMA KAYDI
# =========================================================

@event.listens_for(
    Ticket,
    "after_insert",
)
def create_ticket_created_entry(
    _mapper: Mapper,
    connection: Connection,
    ticket: Ticket,
) -> None:
    actor = get_request_actor()

    requester_name = (
        ticket.requester_name
        or ""
    ).strip()

    if actor is None:
        actor_account_id = None
        actor_name = (
            requester_name
            or "Sistem"
        )
        actor_role = None
    else:
        actor_account_id = (
            actor.account_id
        )
        actor_name = actor.name
        actor_role = actor.role

    connection.execute(
        TicketTimelineEntry
        .__table__
        .insert()
        .values(
            ticket_id=(
                ticket.ticket_id
            ),
            actor_account_id=(
                actor_account_id
            ),
            actor_name=actor_name,
            actor_role=actor_role,
            entry_type=(
                "ticket_created"
            ),
            field_name=None,
            old_value=None,
            new_value=None,
            content=(
                "Ticket oluşturuldu."
            ),
            created_at=(
                ticket.created_at
                or datetime.now()
            ),
        )
    )


# =========================================================
# TICKET ALAN DEĞİŞİKLİKLERİ
# =========================================================

@event.listens_for(
    Ticket,
    "after_update",
)
def create_ticket_change_entries(
    _mapper: Mapper,
    connection: Connection,
    ticket: Ticket,
) -> None:
    actor = get_request_actor()

    if actor is None:
        return

    ticket_state = inspect(ticket)

    change_time = datetime.now()

    timeline_rows: list[
        dict[str, object]
    ] = []

    for field_name, field_label in (
        TRACKED_TICKET_FIELDS.items()
    ):
        field_history = (
            ticket_state
            .attrs[field_name]
            .history
        )

        if (
            not field_history
            .has_changes()
        ):
            continue

        old_raw_value = (
            field_history.deleted[0]
            if field_history.deleted
            else None
        )

        new_raw_value = (
            field_history.added[0]
            if field_history.added
            else getattr(
                ticket,
                field_name,
                None,
            )
        )

        old_value = (
            normalize_timeline_value(
                old_raw_value
            )
        )

        new_value = (
            normalize_timeline_value(
                new_raw_value
            )
        )

        if old_value == new_value:
            continue

        timeline_rows.append(
            {
                "ticket_id":
                    ticket.ticket_id,
                "actor_account_id":
                    actor.account_id,
                "actor_name":
                    actor.name,
                "actor_role":
                    actor.role,
                "entry_type":
                    "field_changed",
                "field_name":
                    field_name,
                "old_value":
                    old_value,
                "new_value":
                    new_value,
                "content":
                    create_change_description(
                        field_name=(
                            field_name
                        ),
                        field_label=(
                            field_label
                        ),
                        old_value=(
                            old_value
                        ),
                        new_value=(
                            new_value
                        ),
                    ),
                "created_at":
                    change_time,
            }
        )

    if not timeline_rows:
        return

    connection.execute(
        TicketTimelineEntry
        .__table__
        .insert(),
        timeline_rows,
    )
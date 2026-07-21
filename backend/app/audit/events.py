from sqlalchemy import (
    event,
    inspect,
)
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapper

from .service import insert_audit_log
from ..models import (
    Ticket,
    TicketTimelineEntry,
)
from ..request_context import (
    get_request_actor,
    get_request_metadata,
)


COMMENT_PREVIEW_LIMIT = 500


AUDITED_TICKET_FIELDS = {
    "title": "Başlık",
    "description": "Açıklama",
    "requester_name": "Talep sahibi",
    "department": "Departman",
    "category": "Kategori",
    "subcategory": "Alt kategori",
    "priority": "Öncelik",
    "status": "Durum",
    "assigned_technician": (
        "Atanan teknisyen"
    ),
    "resolution": "Çözüm",
    "ai_recommendation": (
        "AI çözüm önerisi"
    ),
    "ai_confidence_score": (
        "AI güven puanı"
    ),
    "ai_feedback": (
        "AI geri bildirimi"
    ),
    "ai_feedback_note": (
        "AI geri bildirim notu"
    ),
    "resolved_at": (
        "Çözülme tarihi"
    ),
    "closed_at": (
        "Kapanma tarihi"
    ),
}


def get_request_values() -> tuple[
    str | None,
    str | None,
    str | None,
]:
    metadata = get_request_metadata()

    if metadata is None:
        return (
            None,
            None,
            None,
        )

    return (
        metadata.ip_address,
        metadata.http_method,
        metadata.request_path,
    )


def get_changed_ticket_fields(
    ticket: Ticket,
) -> tuple[
    list[str],
    list[str],
]:
    ticket_state = inspect(ticket)

    changed_field_names: list[str] = []
    changed_field_labels: list[str] = []

    for (
        field_name,
        field_label,
    ) in AUDITED_TICKET_FIELDS.items():
        attribute_state = (
            ticket_state.attrs[
                field_name
            ]
        )

        if not (
            attribute_state
            .history
            .has_changes()
        ):
            continue

        changed_field_names.append(
            field_name
        )

        changed_field_labels.append(
            field_label
        )

    return (
        changed_field_names,
        changed_field_labels,
    )


def create_comment_audit_details(
    timeline_entry: TicketTimelineEntry,
) -> dict[str, object]:
    comment_content = (
        timeline_entry.content
        or ""
    ).strip()

    comment_was_truncated = (
        len(comment_content)
        > COMMENT_PREVIEW_LIMIT
    )

    comment_preview = (
        comment_content[
            :COMMENT_PREVIEW_LIMIT
        ]
    )

    if comment_was_truncated:
        comment_preview = (
            f"{comment_preview}…"
        )

    details: dict[str, object] = {
        "timeline_entry_id": (
            timeline_entry.entry_id
        ),
        "Yorum içeriği": (
            comment_preview
            or "Yorum içeriği bulunmuyor."
        ),
    }

    if comment_was_truncated:
        details["Not"] = (
            "Yorum içeriğinin yalnızca "
            "ilk 500 karakteri gösteriliyor."
        )

    return details


@event.listens_for(
    Ticket,
    "after_insert",
)
def create_ticket_audit_log(
    _mapper: Mapper,
    connection: Connection,
    ticket: Ticket,
) -> None:
    actor = get_request_actor()

    ip_address, http_method, request_path = (
        get_request_values()
    )

    actor_name = (
        actor.name
        if actor is not None
        else (
            ticket.requester_name
            or "Sistem"
        )
    )

    insert_audit_log(
        connection,
        actor_account_id=(
            actor.account_id
            if actor is not None
            else None
        ),
        actor_name=actor_name,
        actor_role=(
            actor.role
            if actor is not None
            else None
        ),
        action_type="ticket_created",
        entity_type="ticket",
        entity_id=ticket.ticket_id,
        ticket_id=ticket.ticket_id,
        description=(
            f"#{ticket.ticket_id} "
            "numaralı ticket oluşturuldu."
        ),
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
        status_code=201,
        details={
            "ticket_title": (
                ticket.title[:250]
            ),
            "priority": ticket.priority,
            "status": ticket.status,
        },
        created_at=ticket.created_at,
    )


@event.listens_for(
    Ticket,
    "after_update",
)
def create_ticket_update_audit_log(
    _mapper: Mapper,
    connection: Connection,
    ticket: Ticket,
) -> None:
    (
        changed_field_names,
        changed_field_labels,
    ) = get_changed_ticket_fields(
        ticket
    )

    if not changed_field_names:
        return

    actor = get_request_actor()

    ip_address, http_method, request_path = (
        get_request_values()
    )

    changed_fields_text = ", ".join(
        changed_field_labels
    )

    insert_audit_log(
        connection,
        actor_account_id=(
            actor.account_id
            if actor is not None
            else None
        ),
        actor_name=(
            actor.name
            if actor is not None
            else "Sistem"
        ),
        actor_role=(
            actor.role
            if actor is not None
            else None
        ),
        action_type="ticket_updated",
        entity_type="ticket",
        entity_id=ticket.ticket_id,
        ticket_id=ticket.ticket_id,
        description=(
            f"#{ticket.ticket_id} "
            "numaralı ticket güncellendi. "
            "Değişen alanlar: "
            f"{changed_fields_text}."
        ),
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
        status_code=200,
        details={
            "changed_fields": (
                changed_field_names
            ),
            "changed_field_labels": (
                changed_field_labels
            ),
        },
    )


@event.listens_for(
    TicketTimelineEntry,
    "after_insert",
)
def create_timeline_audit_log(
    _mapper: Mapper,
    connection: Connection,
    timeline_entry: TicketTimelineEntry,
) -> None:
    if (
        timeline_entry.entry_type
        != "comment"
    ):
        return

    ip_address, http_method, request_path = (
        get_request_values()
    )

    insert_audit_log(
        connection,
        actor_account_id=(
            timeline_entry.actor_account_id
        ),
        actor_name=(
            timeline_entry.actor_name
            or "Sistem"
        ),
        actor_role=(
            timeline_entry.actor_role
        ),
        action_type=(
            "ticket_comment_added"
        ),
        entity_type="ticket_comment",
        entity_id=(
            timeline_entry.entry_id
        ),
        ticket_id=(
            timeline_entry.ticket_id
        ),
        description=(
            f"#{timeline_entry.ticket_id} "
            "numaralı ticketa yorum "
            "eklendi."
        ),
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
        status_code=201,
        details=(
            create_comment_audit_details(
                timeline_entry
            )
        ),
        created_at=(
            timeline_entry.created_at
        ),
    )
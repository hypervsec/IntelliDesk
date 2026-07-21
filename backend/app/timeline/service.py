from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..models import (
    Account,
    Ticket,
    TicketTimelineEntry,
)


TRACKED_TICKET_FIELDS = {
    "status": "Durum",
    "priority": "Öncelik",
    "assigned_technician": "Atanan teknisyen",
    "department": "Departman",
    "category": "Kategori",
    "subcategory": "Alt kategori",
    "resolution": "Çözüm",
}


def create_ticket_change_entries(
    db: Session,
    ticket: Ticket,
    update_data: dict[str, Any],
    current_account: Account,
    created_at: datetime | None = None,
) -> list[TicketTimelineEntry]:
    change_time = created_at or datetime.now()

    created_entries: list[
        TicketTimelineEntry
    ] = []

    for field_name, field_label in (
        TRACKED_TICKET_FIELDS.items()
    ):
        if field_name not in update_data:
            continue

        old_value = getattr(
            ticket,
            field_name,
            None,
        )

        new_value = update_data[
            field_name
        ]

        normalized_old_value = (
            normalize_timeline_value(
                old_value
            )
        )

        normalized_new_value = (
            normalize_timeline_value(
                new_value
            )
        )

        if (
            normalized_old_value
            == normalized_new_value
        ):
            continue

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
                entry_type="field_changed",
                field_name=field_name,
                old_value=(
                    normalized_old_value
                ),
                new_value=(
                    normalized_new_value
                ),
                content=(
                    create_change_description(
                        field_name=field_name,
                        field_label=field_label,
                        old_value=(
                            normalized_old_value
                        ),
                        new_value=(
                            normalized_new_value
                        ),
                    )
                ),
                created_at=change_time,
            )
        )

        db.add(timeline_entry)

        created_entries.append(
            timeline_entry
        )

    return created_entries


def create_change_description(
    field_name: str,
    field_label: str,
    old_value: str | None,
    new_value: str | None,
) -> str:
    if field_name == "resolution":
        if new_value is None:
            return (
                "Çözüm bilgisi kaldırıldı."
            )

        if old_value is None:
            return (
                "Çözüm bilgisi eklendi."
            )

        return (
            "Çözüm bilgisi güncellendi."
        )

    old_display_value = (
        old_value
        if old_value is not None
        else "Belirtilmemiş"
    )

    new_display_value = (
        new_value
        if new_value is not None
        else "Belirtilmemiş"
    )

    return (
        f"{field_label} değiştirildi: "
        f"{old_display_value} → "
        f"{new_display_value}."
    )


def normalize_timeline_value(
    value: Any,
) -> str | None:
    if value is None:
        return None

    normalized_value = str(
        value
    ).strip()

    if not normalized_value:
        return None

    return normalized_value
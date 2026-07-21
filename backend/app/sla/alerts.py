import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Account,
    Notification,
    Ticket,
)
from .service import (
    calculate_remaining_minutes,
    calculate_sla_status,
)


logger = logging.getLogger(__name__)


STAFF_ROLES = {
    "admin",
    "technician",
}


RESOLUTION_COMPLETED_STATUSES = {
    "resolved",
    "closed",
    "cancelled",
}


SLA_NOTIFICATION_TYPES = {
    "sla_first_response_approaching",
    "sla_first_response_breached",
    "sla_resolution_approaching",
    "sla_resolution_breached",
}


def create_sla_alert_notifications(
    db: Session,
    now: datetime | None = None,
) -> int:
    check_time = now or datetime.now()

    tickets = list(
        db.scalars(
            select(Ticket).where(
                Ticket.sla_started_at.is_not(None),
                Ticket.status != "cancelled",
            )
        ).all()
    )

    if not tickets:
        return 0

    staff_accounts = list(
        db.scalars(
            select(Account).where(
                Account.is_active.is_(True),
                Account.role.in_(STAFF_ROLES),
            )
        ).all()
    )

    admin_account_ids = {
        account.account_id
        for account in staff_accounts
        if account.role == "admin"
    }

    staff_accounts_by_name = {
        normalize_name(account.full_name):
            account
        for account in staff_accounts
        if normalize_name(account.full_name)
    }

    ticket_ids = [
        ticket.ticket_id
        for ticket in tickets
    ]

    existing_notifications = list(
        db.scalars(
            select(Notification).where(
                Notification.ticket_id.in_(
                    ticket_ids
                ),
                Notification.notification_type.in_(
                    SLA_NOTIFICATION_TYPES
                ),
            )
        ).all()
    )

    existing_notification_keys = {
        (
            notification.account_id,
            notification.ticket_id,
            notification.notification_type,
        )
        for notification
        in existing_notifications
    }

    created_notification_count = 0

    for ticket in tickets:
        recipient_account_ids = set(
            admin_account_ids
        )

        assigned_technician_name = (
            normalize_name(
                ticket.assigned_technician
            )
        )

        assigned_account = (
            staff_accounts_by_name.get(
                assigned_technician_name
            )
        )

        if assigned_account is not None:
            recipient_account_ids.add(
                assigned_account.account_id
            )

        if not recipient_account_ids:
            continue

        alert_definitions = (
            get_ticket_alert_definitions(
                ticket=ticket,
                check_time=check_time,
            )
        )

        for alert_definition in (
            alert_definitions
        ):
            notification_type = (
                alert_definition[
                    "notification_type"
                ]
            )

            title = alert_definition["title"]
            message = alert_definition[
                "message"
            ]

            for account_id in (
                recipient_account_ids
            ):
                notification_key = (
                    account_id,
                    ticket.ticket_id,
                    notification_type,
                )

                if (
                    notification_key
                    in existing_notification_keys
                ):
                    continue

                db.add(
                    Notification(
                        account_id=account_id,
                        ticket_id=(
                            ticket.ticket_id
                        ),
                        notification_type=(
                            notification_type
                        ),
                        title=title,
                        message=message,
                        is_read=False,
                        created_at=check_time,
                        read_at=None,
                    )
                )

                existing_notification_keys.add(
                    notification_key
                )

                created_notification_count += 1

    if created_notification_count > 0:
        db.flush()

    return created_notification_count


def get_ticket_alert_definitions(
    ticket: Ticket,
    check_time: datetime,
) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []

    if (
        ticket.sla_started_at is None
    ):
        return alerts

    if (
        ticket.first_responded_at is None
        and ticket.first_response_due_at
        is not None
    ):
        first_response_status = (
            calculate_sla_status(
                started_at=(
                    ticket.sla_started_at
                ),
                due_at=(
                    ticket
                    .first_response_due_at
                ),
                now=check_time,
            )
        )

        if (
            first_response_status
            == "approaching"
        ):
            remaining_minutes = (
                calculate_remaining_minutes(
                    due_at=(
                        ticket
                        .first_response_due_at
                    ),
                    now=check_time,
                )
            )

            alerts.append(
                {
                    "notification_type": (
                        "sla_first_response_"
                        "approaching"
                    ),
                    "title": (
                        "Ä°lk cevap SLA sÃ¼resi "
                        "yaklaÅŸÄ±yor"
                    ),
                    "message": (
                        create_approaching_message(
                            ticket=ticket,
                            sla_name="Ä°lk cevap",
                            remaining_minutes=(
                                remaining_minutes
                            ),
                        )
                    ),
                }
            )

        if (
            first_response_status
            == "breached"
        ):
            alerts.append(
                {
                    "notification_type": (
                        "sla_first_response_"
                        "breached"
                    ),
                    "title": (
                        "Ä°lk cevap SLA ihlali"
                    ),
                    "message": (
                        create_breached_message(
                            ticket=ticket,
                            sla_name="Ä°lk cevap",
                        )
                    ),
                }
            )

    resolution_is_completed = (
        ticket.resolved_at is not None
        or ticket.closed_at is not None
        or ticket.status
        in RESOLUTION_COMPLETED_STATUSES
    )

    if (
        not resolution_is_completed
        and ticket.resolution_due_at
        is not None
    ):
        resolution_status = (
            calculate_sla_status(
                started_at=(
                    ticket.sla_started_at
                ),
                due_at=(
                    ticket.resolution_due_at
                ),
                now=check_time,
            )
        )

        if (
            resolution_status
            == "approaching"
        ):
            remaining_minutes = (
                calculate_remaining_minutes(
                    due_at=(
                        ticket.resolution_due_at
                    ),
                    now=check_time,
                )
            )

            alerts.append(
                {
                    "notification_type": (
                        "sla_resolution_"
                        "approaching"
                    ),
                    "title": (
                        "Ã‡Ã¶zÃ¼m SLA sÃ¼resi "
                        "yaklaÅŸÄ±yor"
                    ),
                    "message": (
                        create_approaching_message(
                            ticket=ticket,
                            sla_name="Ã‡Ã¶zÃ¼m",
                            remaining_minutes=(
                                remaining_minutes
                            ),
                        )
                    ),
                }
            )

        if (
            resolution_status
            == "breached"
        ):
            alerts.append(
                {
                    "notification_type": (
                        "sla_resolution_"
                        "breached"
                    ),
                    "title": (
                        "Ã‡Ã¶zÃ¼m SLA ihlali"
                    ),
                    "message": (
                        create_breached_message(
                            ticket=ticket,
                            sla_name="Ã‡Ã¶zÃ¼m",
                        )
                    ),
                }
            )

    return alerts


def create_approaching_message(
    ticket: Ticket,
    sla_name: str,
    remaining_minutes: int,
) -> str:
    remaining_time = format_duration(
        max(0, remaining_minutes)
    )

    return (
        f"#{ticket.ticket_id} numaralÄ± "
        f'"{ticket.title}" ticketÄ±nÄ±n '
        f"{sla_name.lower()} SLA sÃ¼resinin "
        f"yaklaÅŸÄ±k {remaining_time} sÃ¼resi "
        "kaldÄ±."
    )


def create_breached_message(
    ticket: Ticket,
    sla_name: str,
) -> str:
    return (
        f"#{ticket.ticket_id} numaralÄ± "
        f'"{ticket.title}" ticketÄ±nda '
        f"{sla_name.lower()} SLA hedefi "
        "aÅŸÄ±ldÄ±."
    )


def format_duration(
    total_minutes: int,
) -> str:
    normalized_minutes = max(
        0,
        int(total_minutes),
    )

    days = normalized_minutes // 1440

    hours = (
        normalized_minutes % 1440
    ) // 60

    minutes = normalized_minutes % 60

    if days > 0:
        if hours > 0:
            return (
                f"{days} gÃ¼n "
                f"{hours} saat"
            )

        return f"{days} gÃ¼n"

    if hours > 0:
        if minutes > 0:
            return (
                f"{hours} saat "
                f"{minutes} dakika"
            )

        return f"{hours} saat"

    return f"{minutes} dakika"


def normalize_name(
    value: str | None,
) -> str:
    if not value:
        return ""

    return " ".join(
        value.strip().lower().split()
    )


async def run_sla_alert_loop(
    interval_seconds: int = 60,
) -> None:
    while True:
        try:
            with SessionLocal() as db:
                try:
                    created_count = (
                        create_sla_alert_notifications(
                            db=db,
                        )
                    )

                    if created_count > 0:
                        db.commit()

                        logger.info(
                            "%s SLA bildirimi "
                            "oluÅŸturuldu.",
                            created_count,
                        )
                except Exception:
                    db.rollback()
                    raise

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "SLA bildirim kontrolÃ¼ "
                "sÄ±rasÄ±nda hata oluÅŸtu."
            )

        await asyncio.sleep(
            interval_seconds
        )

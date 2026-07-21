import json
from datetime import datetime
from typing import Any

from sqlalchemy.engine import Connection

from ..models import AuditLog


def normalize_optional_value(
    value: str | None,
    maximum_length: int,
) -> str | None:
    if value is None:
        return None

    normalized_value = value.strip()

    if not normalized_value:
        return None

    return normalized_value[
        :maximum_length
    ]


def serialize_audit_details(
    details: dict[str, Any] | None,
) -> str | None:
    if not details:
        return None

    return json.dumps(
        details,
        ensure_ascii=False,
        default=str,
    )


def insert_audit_log(
    connection: Connection,
    *,
    actor_account_id: int | None,
    actor_name: str,
    actor_role: str | None,
    action_type: str,
    entity_type: str,
    entity_id: int | None,
    ticket_id: int | None,
    description: str,
    ip_address: str | None = None,
    http_method: str | None = None,
    request_path: str | None = None,
    status_code: int | None = None,
    details: dict[str, Any] | None = None,
    created_at: datetime | None = None,
) -> None:
    normalized_actor_name = (
        actor_name.strip()
        if actor_name
        else "Sistem"
    )

    if not normalized_actor_name:
        normalized_actor_name = "Sistem"

    connection.execute(
        AuditLog.__table__.insert().values(
            actor_account_id=(
                actor_account_id
            ),
            actor_name=(
                normalized_actor_name[:150]
            ),
            actor_role=(
                normalize_optional_value(
                    actor_role,
                    30,
                )
            ),
            action_type=(
                action_type[:80]
            ),
            entity_type=(
                entity_type[:50]
            ),
            entity_id=entity_id,
            ticket_id=ticket_id,
            description=description,
            ip_address=(
                normalize_optional_value(
                    ip_address,
                    45,
                )
            ),
            http_method=(
                normalize_optional_value(
                    http_method,
                    10,
                )
            ),
            request_path=(
                normalize_optional_value(
                    request_path,
                    500,
                )
            ),
            status_code=status_code,
            details=serialize_audit_details(
                details
            ),
            created_at=(
                created_at
                or datetime.now()
            ),
        )
    )
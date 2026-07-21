from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
)


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    audit_log_id: int

    actor_account_id: int | None
    actor_name: str
    actor_role: str | None

    action_type: str

    entity_type: str
    entity_id: int | None

    ticket_id: int | None

    description: str

    ip_address: str | None
    http_method: str | None
    request_path: str | None
    status_code: int | None

    details: str | None

    created_at: datetime


class AuditLogPageResponse(BaseModel):
    items: list[AuditLogResponse]

    total: int
    page: int
    page_size: int
    total_pages: int
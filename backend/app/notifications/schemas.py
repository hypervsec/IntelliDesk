from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    notification_id: int
    account_id: int
    ticket_id: int | None

    notification_type: str
    title: str
    message: str

    is_read: bool
    created_at: datetime
    read_at: datetime | None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
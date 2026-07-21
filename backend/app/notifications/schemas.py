from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    field_validator,
)

from ..text_encoding import (
    repair_mojibake,
)


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

    @field_validator(
        "title",
        "message",
        mode="before",
    )
    @classmethod
    def repair_notification_text(
        cls,
        value: str | None,
    ) -> str | None:
        return repair_mojibake(
            value
        )


class NotificationListResponse(BaseModel):
    notifications: list[
        NotificationResponse
    ]

    unread_count: int
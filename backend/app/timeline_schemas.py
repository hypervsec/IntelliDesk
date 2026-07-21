from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class TicketCommentCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000,
    )

    @field_validator("content")
    @classmethod
    def validate_content(
        cls,
        value: str,
    ) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError(
                "Yorum içeriği boş olamaz."
            )

        return normalized_value


class TicketTimelineEntryResponse(
    BaseModel
):
    model_config = ConfigDict(
        from_attributes=True,
    )

    entry_id: int
    ticket_id: int

    actor_account_id: int | None
    actor_name: str
    actor_role: str | None

    entry_type: str
    field_name: str | None

    old_value: str | None
    new_value: str | None

    content: str
    created_at: datetime
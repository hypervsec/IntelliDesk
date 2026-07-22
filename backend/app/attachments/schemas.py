from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
)


class TicketAttachmentResponse(
    BaseModel
):
    model_config = ConfigDict(
        from_attributes=True,
    )

    attachment_id: int
    ticket_id: int

    uploader_account_id: int | None
    uploader_name: str
    uploader_role: str | None

    original_filename: str
    content_type: str
    file_extension: str
    size_bytes: int
    sha256: str

    created_at: datetime


class AttachmentDeleteResponse(
    BaseModel
):
    message: str
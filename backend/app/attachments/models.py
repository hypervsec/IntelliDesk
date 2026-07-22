from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from ..database import Base


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    __table_args__ = (
        UniqueConstraint(
            "stored_filename",
            name=(
                "uq_ticket_attachments_"
                "stored_filename"
            ),
        ),
        CheckConstraint(
            "size_bytes > 0",
            name=(
                "ck_ticket_attachments_"
                "size_positive"
            ),
        ),
        Index(
            "ix_ticket_attachments_ticket_created",
            "ticket_id",
            "created_at",
        ),
        Index(
            "ix_ticket_attachments_uploader",
            "uploader_account_id",
        ),
    )

    attachment_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    ticket_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "tickets.ticket_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    uploader_account_id: Mapped[
        int | None
    ] = mapped_column(
        BigInteger,
        ForeignKey(
            "accounts.account_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    uploader_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    uploader_role: Mapped[
        str | None
    ] = mapped_column(
        String(30),
        nullable=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    stored_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    file_extension: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )
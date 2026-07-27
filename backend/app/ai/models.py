from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from ..database import Base


class AISession(Base):
    __tablename__ = "ai_sessions"

    __table_args__ = (
        CheckConstraint(
            (
                "priority IN "
                "('low', 'medium', 'high', 'critical')"
            ),
            name="ck_ai_sessions_priority",
        ),
        CheckConstraint(
            (
                "status IN "
                "('pending', 'processing', "
                "'completed', 'failed')"
            ),
            name="ck_ai_sessions_status",
        ),
        CheckConstraint(
            (
                "resolution_status IS NULL "
                "OR resolution_status IN "
                "('resolved', 'unresolved')"
            ),
            name=(
                "ck_ai_sessions_"
                "resolution_status"
            ),
        ),
        CheckConstraint(
            (
                "confidence_score IS NULL "
                "OR "
                "(confidence_score >= 0 "
                "AND confidence_score <= 1)"
            ),
            name=(
                "ck_ai_sessions_"
                "confidence_score_range"
            ),
        ),
        UniqueConstraint(
            "ticket_id",
            name="uq_ai_sessions_ticket_id",
        ),
        Index(
            "ix_ai_sessions_account_created",
            "account_id",
            "created_at",
        ),
        Index(
            "ix_ai_sessions_status_created",
            "status",
            "created_at",
        ),
        Index(
            "ix_ai_sessions_ticket_id",
            "ticket_id",
        ),
    )

    session_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    account_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "accounts.account_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    ticket_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey(
            "tickets.ticket_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    department: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    category: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    subcategory: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    priority: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="medium",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
    )

    confidence_score: Mapped[
        Decimal | None
    ] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    resolution_status: Mapped[
        str | None
    ] = mapped_column(
        String(30),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now,
    )

    completed_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True,
    )


class AISessionSource(Base):
    __tablename__ = "ai_session_sources"

    __table_args__ = (
        CheckConstraint(
            (
                "similarity_score >= 0 "
                "AND similarity_score <= 1"
            ),
            name=(
                "ck_ai_session_sources_"
                "similarity_score_range"
            ),
        ),
        UniqueConstraint(
            "session_id",
            "request_id",
            name=(
                "uq_ai_session_sources_"
                "session_request"
            ),
        ),
        Index(
            "ix_ai_session_sources_session_id",
            "session_id",
        ),
        Index(
            "ix_ai_session_sources_request_id",
            "request_id",
        ),
        Index(
            "ix_ai_session_sources_similarity",
            "similarity_score",
        ),
    )

    source_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    session_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "ai_sessions.session_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    request_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    similarity_score: Mapped[
        Decimal
    ] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )


class AISessionAttachment(Base):
    __tablename__ = "ai_session_attachments"

    __table_args__ = (
        UniqueConstraint(
            "stored_filename",
            name=(
                "uq_ai_session_attachments_"
                "stored_filename"
            ),
        ),
        CheckConstraint(
            "size_bytes > 0",
            name=(
                "ck_ai_session_attachments_"
                "size_positive"
            ),
        ),
        CheckConstraint(
            (
                "content_type IN "
                "('image/png', 'image/jpeg', 'image/webp')"
            ),
            name=(
                "ck_ai_session_attachments_"
                "content_type"
            ),
        ),
        CheckConstraint(
            (
                "file_extension IN "
                "('.png', '.jpg', '.jpeg', '.webp')"
            ),
            name=(
                "ck_ai_session_attachments_"
                "file_extension"
            ),
        ),
        Index(
            "ix_ai_session_attachments_session_created",
            "session_id",
            "created_at",
        ),
        Index(
            "ix_ai_session_attachments_uploader",
            "uploader_account_id",
        ),
    )

    attachment_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    session_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "ai_sessions.session_id",
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


class AIMessage(Base):
    __tablename__ = "ai_messages"

    __table_args__ = (
        CheckConstraint(
            (
                "sender_type IN "
                "('user', 'assistant', 'system')"
            ),
            name="ck_ai_messages_sender_type",
        ),
        Index(
            "ix_ai_messages_session_created",
            "session_id",
            "created_at",
        ),
    )

    message_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    session_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "ai_sessions.session_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    sender_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )
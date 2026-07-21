from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    __table_args__ = (
        Index(
            "ix_tickets_first_response_due_at",
            "first_response_due_at",
        ),
        Index(
            "ix_tickets_resolution_due_at",
            "resolution_due_at",
        ),
    )

    ticket_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    requester_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
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
        default="open",
    )

    assigned_technician: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    resolution: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    ai_recommendation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    ai_confidence_score: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    ai_feedback: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    ai_feedback_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    ai_feedback_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )

    sla_started_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True,
    )

    first_response_due_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True,
    )

    resolution_due_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True,
    )

    first_responded_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )


class ServiceCatalog(Base):
    __tablename__ = "service_catalog"

    __table_args__ = (
        UniqueConstraint(
            "department",
            "category",
            "subcategory",
            name=(
                "uq_service_catalog_"
                "department_category_subcategory"
            ),
        ),
        Index(
            "ix_service_catalog_department",
            "department",
        ),
        Index(
            "ix_service_catalog_department_category",
            "department",
            "category",
        ),
    )

    catalog_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    department: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    category: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    subcategory: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )


class Account(Base):
    __tablename__ = "accounts"

    __table_args__ = (
        UniqueConstraint(
            "email",
            name="uq_accounts_email",
        ),
        CheckConstraint(
            "role IN ('admin', 'technician', 'user')",
            name="ck_accounts_role",
        ),
    )

    account_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="user",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
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

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )


class TicketTimelineEntry(Base):
    __tablename__ = "ticket_timeline_entries"

    __table_args__ = (
        Index(
            "ix_ticket_timeline_ticket_created",
            "ticket_id",
            "created_at",
        ),
        Index(
            "ix_ticket_timeline_actor_account_id",
            "actor_account_id",
        ),
    )

    entry_id: Mapped[int] = mapped_column(
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

    actor_account_id: Mapped[
        int | None
    ] = mapped_column(
        BigInteger,
        ForeignKey(
            "accounts.account_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    actor_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    actor_role: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    entry_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    field_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    old_value: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    new_value: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
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


class AuditLog(Base):
    __tablename__ = "audit_logs"

    __table_args__ = (
        Index(
            "ix_audit_logs_created_at",
            "created_at",
        ),
        Index(
            "ix_audit_logs_actor_created",
            "actor_account_id",
            "created_at",
        ),
        Index(
            "ix_audit_logs_action_created",
            "action_type",
            "created_at",
        ),
        Index(
            "ix_audit_logs_ticket_created",
            "ticket_id",
            "created_at",
        ),
        Index(
            "ix_audit_logs_entity",
            "entity_type",
            "entity_id",
        ),
    )

    audit_log_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    actor_account_id: Mapped[
        int | None
    ] = mapped_column(
        BigInteger,
        ForeignKey(
            "accounts.account_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    actor_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    actor_role: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    action_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    entity_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    ticket_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey(
            "tickets.ticket_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    http_method: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    request_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    status_code: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )


class Notification(Base):
    __tablename__ = "notifications"

    __table_args__ = (
        Index(
            "ix_notifications_account_unread_created",
            "account_id",
            "is_read",
            "created_at",
        ),
        Index(
            "ix_notifications_ticket_id",
            "ticket_id",
        ),
    )

    notification_id: Mapped[int] = mapped_column(
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

    notification_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )

    read_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Ticket(Base):
    __tablename__ = "tickets"

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
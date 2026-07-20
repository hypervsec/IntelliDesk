"""create notifications table

Revision ID: b7f4c9d2e310
Revises: a4e2c7b8d901
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "b7f4c9d2e310"
down_revision: str | None = "a4e2c7b8d901"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column(
            "notification_id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "account_id",
            sa.BigInteger(),
            nullable=False,
        ),
        sa.Column(
            "ticket_id",
            sa.BigInteger(),
            nullable=True,
        ),
        sa.Column(
            "notification_type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "message",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "is_read",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text(
                "CURRENT_TIMESTAMP"
            ),
            nullable=False,
        ),
        sa.Column(
            "read_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.account_id"],
            name=(
                "fk_notifications_account_id_"
                "accounts"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.ticket_id"],
            name=(
                "fk_notifications_ticket_id_"
                "tickets"
            ),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint(
            "notification_id",
            name="pk_notifications",
        ),
    )

    op.create_index(
        "ix_notifications_account_unread_created",
        "notifications",
        [
            "account_id",
            "is_read",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_notifications_ticket_id",
        "notifications",
        ["ticket_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notifications_ticket_id",
        table_name="notifications",
    )

    op.drop_index(
        "ix_notifications_account_unread_created",
        table_name="notifications",
    )

    op.drop_table("notifications")
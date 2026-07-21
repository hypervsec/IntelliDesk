"""add ticket timeline

Revision ID: e6f8b2a4c915
Revises: d4a9f2c6e731
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e6f8b2a4c915"
down_revision: str | None = "d4a9f2c6e731"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_timeline_entries",
        sa.Column(
            "entry_id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "ticket_id",
            sa.BigInteger(),
            nullable=False,
        ),
        sa.Column(
            "actor_account_id",
            sa.BigInteger(),
            nullable=True,
        ),
        sa.Column(
            "actor_name",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "actor_role",
            sa.String(length=30),
            nullable=True,
        ),
        sa.Column(
            "entry_type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "field_name",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "old_value",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "new_value",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_account_id"],
            ["accounts.account_id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.ticket_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "entry_id",
        ),
    )

    op.create_index(
        "ix_ticket_timeline_ticket_created",
        "ticket_timeline_entries",
        [
            "ticket_id",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ticket_timeline_actor_account_id",
        "ticket_timeline_entries",
        [
            "actor_account_id",
        ],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO ticket_timeline_entries (
            ticket_id,
            actor_account_id,
            actor_name,
            actor_role,
            entry_type,
            field_name,
            old_value,
            new_value,
            content,
            created_at
        )
        SELECT
            ticket_id,
            NULL,
            COALESCE(
                NULLIF(
                    TRIM(requester_name),
                    ''
                ),
                'Sistem'
            ),
            NULL,
            'ticket_created',
            NULL,
            NULL,
            NULL,
            'Ticket oluşturuldu.',
            created_at
        FROM tickets
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ticket_timeline_actor_account_id",
        table_name="ticket_timeline_entries",
    )

    op.drop_index(
        "ix_ticket_timeline_ticket_created",
        table_name="ticket_timeline_entries",
    )

    op.drop_table(
        "ticket_timeline_entries",
    )
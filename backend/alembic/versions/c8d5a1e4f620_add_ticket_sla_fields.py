"""add ticket SLA fields

Revision ID: c8d5a1e4f620
Revises: b7f4c9d2e310
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "c8d5a1e4f620"
down_revision: str | None = "b7f4c9d2e310"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column(
            "first_response_due_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.add_column(
        "tickets",
        sa.Column(
            "resolution_due_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.add_column(
        "tickets",
        sa.Column(
            "first_responded_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE tickets
        SET first_response_due_at =
            created_at
            + CASE LOWER(
                COALESCE(priority, 'medium')
            )
                WHEN 'critical'
                    THEN INTERVAL '15 minutes'
                WHEN 'high'
                    THEN INTERVAL '30 minutes'
                WHEN 'low'
                    THEN INTERVAL '4 hours'
                ELSE INTERVAL '2 hours'
            END,
            resolution_due_at =
            created_at
            + CASE LOWER(
                COALESCE(priority, 'medium')
            )
                WHEN 'critical'
                    THEN INTERVAL '4 hours'
                WHEN 'high'
                    THEN INTERVAL '8 hours'
                WHEN 'low'
                    THEN INTERVAL '48 hours'
                ELSE INTERVAL '24 hours'
            END
        WHERE first_response_due_at IS NULL
           OR resolution_due_at IS NULL
        """
    )

    op.create_index(
        "ix_tickets_first_response_due_at",
        "tickets",
        ["first_response_due_at"],
        unique=False,
    )

    op.create_index(
        "ix_tickets_resolution_due_at",
        "tickets",
        ["resolution_due_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_tickets_resolution_due_at",
        table_name="tickets",
    )

    op.drop_index(
        "ix_tickets_first_response_due_at",
        table_name="tickets",
    )

    op.drop_column(
        "tickets",
        "first_responded_at",
    )

    op.drop_column(
        "tickets",
        "resolution_due_at",
    )

    op.drop_column(
        "tickets",
        "first_response_due_at",
    )
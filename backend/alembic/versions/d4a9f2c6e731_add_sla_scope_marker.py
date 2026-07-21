"""add SLA scope marker

Revision ID: d4a9f2c6e731
Revises: c8d5a1e4f620
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "d4a9f2c6e731"
down_revision: str | None = "c8d5a1e4f620"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column(
            "sla_started_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE tickets
        SET sla_started_at = NULL,
            first_response_due_at = NULL,
            resolution_due_at = NULL,
            first_responded_at = NULL
        """
    )


def downgrade() -> None:
    op.drop_column(
        "tickets",
        "sla_started_at",
    )
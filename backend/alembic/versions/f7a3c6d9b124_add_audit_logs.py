"""add audit logs

Revision ID: f7a3c6d9b124
Revises: e6f8b2a4c915
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f7a3c6d9b124"
down_revision: str | None = "e6f8b2a4c915"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column(
            "audit_log_id",
            sa.BigInteger(),
            autoincrement=True,
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
            "action_type",
            sa.String(length=80),
            nullable=False,
        ),
        sa.Column(
            "entity_type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "entity_id",
            sa.BigInteger(),
            nullable=True,
        ),
        sa.Column(
            "ticket_id",
            sa.BigInteger(),
            nullable=True,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "ip_address",
            sa.String(length=45),
            nullable=True,
        ),
        sa.Column(
            "http_method",
            sa.String(length=10),
            nullable=True,
        ),
        sa.Column(
            "request_path",
            sa.String(length=500),
            nullable=True,
        ),
        sa.Column(
            "status_code",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "details",
            sa.Text(),
            nullable=True,
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
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint(
            "audit_log_id",
        ),
    )

    op.create_index(
        "ix_audit_logs_created_at",
        "audit_logs",
        ["created_at"],
        unique=False,
    )

    op.create_index(
        "ix_audit_logs_actor_created",
        "audit_logs",
        [
            "actor_account_id",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_audit_logs_action_created",
        "audit_logs",
        [
            "action_type",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_audit_logs_ticket_created",
        "audit_logs",
        [
            "ticket_id",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_audit_logs_entity",
        "audit_logs",
        [
            "entity_type",
            "entity_id",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_audit_logs_entity",
        table_name="audit_logs",
    )

    op.drop_index(
        "ix_audit_logs_ticket_created",
        table_name="audit_logs",
    )

    op.drop_index(
        "ix_audit_logs_action_created",
        table_name="audit_logs",
    )

    op.drop_index(
        "ix_audit_logs_actor_created",
        table_name="audit_logs",
    )

    op.drop_index(
        "ix_audit_logs_created_at",
        table_name="audit_logs",
    )

    op.drop_table(
        "audit_logs",
    )
"""create ticket attachments

Revision ID: a1c4e7f9b203
Revises: f7a3c6d9b124
Create Date: 2026-07-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a1c4e7f9b203"
down_revision: str | None = "f7a3c6d9b124"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_attachments",
        sa.Column(
            "attachment_id",
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
            "uploader_account_id",
            sa.BigInteger(),
            nullable=True,
        ),
        sa.Column(
            "uploader_name",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "uploader_role",
            sa.String(length=30),
            nullable=True,
        ),
        sa.Column(
            "original_filename",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "stored_filename",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "storage_path",
            sa.String(length=500),
            nullable=False,
        ),
        sa.Column(
            "content_type",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "file_extension",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "size_bytes",
            sa.BigInteger(),
            nullable=False,
        ),
        sa.Column(
            "sha256",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "size_bytes > 0",
            name=(
                "ck_ticket_attachments_"
                "size_positive"
            ),
        ),
        sa.ForeignKeyConstraint(
            [
                "ticket_id",
            ],
            [
                "tickets.ticket_id",
            ],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            [
                "uploader_account_id",
            ],
            [
                "accounts.account_id",
            ],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint(
            "attachment_id",
        ),
        sa.UniqueConstraint(
            "stored_filename",
            name=(
                "uq_ticket_attachments_"
                "stored_filename"
            ),
        ),
    )

    op.create_index(
        "ix_ticket_attachments_ticket_created",
        "ticket_attachments",
        [
            "ticket_id",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ticket_attachments_uploader",
        "ticket_attachments",
        [
            "uploader_account_id",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ticket_attachments_uploader",
        table_name="ticket_attachments",
    )

    op.drop_index(
        "ix_ticket_attachments_ticket_created",
        table_name="ticket_attachments",
    )

    op.drop_table(
        "ticket_attachments",
    )
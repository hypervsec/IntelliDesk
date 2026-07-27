"""add ai session attachments

Revision ID: b7d2f8a1c4e6
Revises: e6b8c1a4d2f9
Create Date: 2026-07-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "b7d2f8a1c4e6"

down_revision: str | None = (
    "e6b8c1a4d2f9"
)

branch_labels: (
    str
    | Sequence[str]
    | None
) = None

depends_on: (
    str
    | Sequence[str]
    | None
) = None


def upgrade() -> None:
    op.create_table(
        "ai_session_attachments",

        sa.Column(
            "attachment_id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
        ),

        sa.Column(
            "session_id",
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
            server_default=sa.text(
                "CURRENT_TIMESTAMP"
            ),
        ),

        sa.CheckConstraint(
            "size_bytes > 0",
            name=(
                "ck_ai_session_attachments_"
                "size_positive"
            ),
        ),

        sa.CheckConstraint(
            (
                "content_type IN "
                "('image/png', 'image/jpeg', 'image/webp')"
            ),
            name=(
                "ck_ai_session_attachments_"
                "content_type"
            ),
        ),

        sa.CheckConstraint(
            (
                "file_extension IN "
                "('.png', '.jpg', '.jpeg', '.webp')"
            ),
            name=(
                "ck_ai_session_attachments_"
                "file_extension"
            ),
        ),

        sa.ForeignKeyConstraint(
            ["session_id"],
            ["ai_sessions.session_id"],
            name=(
                "fk_ai_session_attachments_"
                "session_id"
            ),
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["uploader_account_id"],
            ["accounts.account_id"],
            name=(
                "fk_ai_session_attachments_"
                "uploader_account_id"
            ),
            ondelete="SET NULL",
        ),

        sa.PrimaryKeyConstraint(
            "attachment_id",
            name=(
                "pk_ai_session_attachments"
            ),
        ),

        sa.UniqueConstraint(
            "stored_filename",
            name=(
                "uq_ai_session_attachments_"
                "stored_filename"
            ),
        ),
    )

    op.create_index(
        "ix_ai_session_attachments_session_created",
        "ai_session_attachments",
        [
            "session_id",
            "created_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ai_session_attachments_uploader",
        "ai_session_attachments",
        [
            "uploader_account_id",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_session_attachments_uploader",
        table_name="ai_session_attachments",
    )

    op.drop_index(
        "ix_ai_session_attachments_session_created",
        table_name="ai_session_attachments",
    )

    op.drop_table(
        "ai_session_attachments"
    )
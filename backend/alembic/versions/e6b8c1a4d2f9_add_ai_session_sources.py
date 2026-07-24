"""add ai session sources

Revision ID: e6b8c1a4d2f9
Revises: 793a5bd2d70a
Create Date: 2026-07-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e6b8c1a4d2f9"

down_revision: str | None = (
    "793a5bd2d70a"
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
        "ai_session_sources",

        sa.Column(
            "source_id",
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
            "request_id",
            sa.String(length=100),
            nullable=False,
        ),

        sa.Column(
            "similarity_score",
            sa.Numeric(
                precision=5,
                scale=4,
            ),
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
            (
                "similarity_score >= 0 "
                "AND similarity_score <= 1"
            ),
            name=(
                "ck_ai_session_sources_"
                "similarity_score_range"
            ),
        ),

        sa.ForeignKeyConstraint(
            ["session_id"],
            ["ai_sessions.session_id"],
            name=(
                "fk_ai_session_sources_"
                "session_id"
            ),
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "source_id",
            name=(
                "pk_ai_session_sources"
            ),
        ),

        sa.UniqueConstraint(
            "session_id",
            "request_id",
            name=(
                "uq_ai_session_sources_"
                "session_request"
            ),
        ),
    )

    op.create_index(
        "ix_ai_session_sources_session_id",
        "ai_session_sources",
        ["session_id"],
        unique=False,
    )

    op.create_index(
        "ix_ai_session_sources_request_id",
        "ai_session_sources",
        ["request_id"],
        unique=False,
    )

    op.create_index(
        "ix_ai_session_sources_similarity",
        "ai_session_sources",
        ["similarity_score"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_session_sources_similarity",
        table_name="ai_session_sources",
    )

    op.drop_index(
        "ix_ai_session_sources_request_id",
        table_name="ai_session_sources",
    )

    op.drop_index(
        "ix_ai_session_sources_session_id",
        table_name="ai_session_sources",
    )

    op.drop_table(
        "ai_session_sources"
    )
"""create service catalog table

Revision ID: a4e2c7b8d901
Revises: f239e4305856
Create Date: 2026-07-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a4e2c7b8d901"
down_revision: str | None = "f239e4305856"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "service_catalog",
        sa.Column(
            "catalog_id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "department",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "subcategory",
            sa.String(length=150),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint(
            "catalog_id",
            name="pk_service_catalog",
        ),
        sa.UniqueConstraint(
            "department",
            "category",
            "subcategory",
            name=(
                "uq_service_catalog_"
                "department_category_subcategory"
            ),
        ),
    )

    op.create_index(
        "ix_service_catalog_department",
        "service_catalog",
        ["department"],
        unique=False,
    )

    op.create_index(
        "ix_service_catalog_department_category",
        "service_catalog",
        [
            "department",
            "category",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_service_catalog_department_category",
        table_name="service_catalog",
    )

    op.drop_index(
        "ix_service_catalog_department",
        table_name="service_catalog",
    )

    op.drop_table(
        "service_catalog"
    )
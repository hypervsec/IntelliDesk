"""link ai sessions to tickets

Revision ID: 793a5bd2d70a
Revises: a4ccd284f5b2
Create Date: 2026-07-24 12:59:39.748265

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "793a5bd2d70a"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "a4ccd284f5b2"

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    """AI oturumlarını oluşturulan ticketlara bağlar."""

    op.add_column(
        "ai_sessions",
        sa.Column(
            "ticket_id",
            sa.BigInteger(),
            nullable=True,
        ),
    )

    # Daha önce aynı işlem sırasında oluşturulmuş
    # AI oturumları ile ticketları eşleştirir.
    op.execute(
        sa.text(
            """
            WITH candidate_pairs AS (
                SELECT
                    ai_session.session_id,
                    ticket.ticket_id,

                    ROW_NUMBER() OVER (
                        PARTITION BY ai_session.session_id
                        ORDER BY
                            ABS(
                                EXTRACT(
                                    EPOCH FROM (
                                        ticket.created_at
                                        - ai_session.created_at
                                    )
                                )
                            ),
                            ticket.ticket_id
                    ) AS session_rank,

                    ROW_NUMBER() OVER (
                        PARTITION BY ticket.ticket_id
                        ORDER BY
                            ABS(
                                EXTRACT(
                                    EPOCH FROM (
                                        ticket.created_at
                                        - ai_session.created_at
                                    )
                                )
                            ),
                            ai_session.session_id
                    ) AS ticket_rank

                FROM ai_sessions AS ai_session

                INNER JOIN ticket_timeline_entries AS timeline
                    ON timeline.entry_type = 'ticket_created'
                    AND timeline.actor_account_id = ai_session.account_id

                INNER JOIN tickets AS ticket
                    ON ticket.ticket_id = timeline.ticket_id

                WHERE
                    ai_session.ticket_id IS NULL
                    AND ticket.title = ai_session.title
                    AND ABS(
                        EXTRACT(
                            EPOCH FROM (
                                ticket.created_at
                                - ai_session.created_at
                            )
                        )
                    ) <= 10
            )

            UPDATE ai_sessions AS ai_session

            SET ticket_id = candidate_pairs.ticket_id

            FROM candidate_pairs

            WHERE
                ai_session.session_id = candidate_pairs.session_id
                AND candidate_pairs.session_rank = 1
                AND candidate_pairs.ticket_rank = 1
            """
        )
    )

    op.create_index(
        "ix_ai_sessions_ticket_id",
        "ai_sessions",
        ["ticket_id"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_ai_sessions_ticket_id",
        "ai_sessions",
        ["ticket_id"],
    )

    op.create_foreign_key(
        "fk_ai_sessions_ticket_id_tickets",
        "ai_sessions",
        "tickets",
        ["ticket_id"],
        ["ticket_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """AI oturumu ve ticket bağlantısını kaldırır."""

    # Migration ilk kez isimsiz foreign key ile uygulanmış
    # olabilir. PostgreSQL'deki gerçek constraint adını
    # bularak güvenli şekilde kaldırır.
    op.execute(
        sa.text(
            """
            DO $$
            DECLARE
                foreign_key_name TEXT;
            BEGIN
                SELECT constraint_data.conname
                INTO foreign_key_name
                FROM pg_constraint AS constraint_data
                INNER JOIN pg_class AS table_data
                    ON table_data.oid = constraint_data.conrelid
                INNER JOIN pg_namespace AS namespace_data
                    ON namespace_data.oid = table_data.relnamespace
                INNER JOIN unnest(
                    constraint_data.conkey
                ) AS column_number(attnum)
                    ON TRUE
                INNER JOIN pg_attribute AS column_data
                    ON column_data.attrelid = table_data.oid
                    AND column_data.attnum = column_number.attnum
                WHERE
                    namespace_data.nspname = current_schema()
                    AND table_data.relname = 'ai_sessions'
                    AND constraint_data.contype = 'f'
                    AND column_data.attname = 'ticket_id'
                LIMIT 1;

                IF foreign_key_name IS NOT NULL THEN
                    EXECUTE format(
                        'ALTER TABLE %I.%I DROP CONSTRAINT %I',
                        current_schema(),
                        'ai_sessions',
                        foreign_key_name
                    );
                END IF;
            END
            $$;
            """
        )
    )

    op.drop_constraint(
        "uq_ai_sessions_ticket_id",
        "ai_sessions",
        type_="unique",
    )

    op.drop_index(
        "ix_ai_sessions_ticket_id",
        table_name="ai_sessions",
    )

    op.drop_column(
        "ai_sessions",
        "ticket_id",
    )
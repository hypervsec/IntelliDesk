from collections.abc import Generator
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.models import AIMessage, AISession
from app.ai.rag_service import TemporaryRAGSolution
from app.database import engine, get_db
from app.main import app
from app.models import Account
from app.routers.auth import get_current_account


@pytest.fixture
def ai_test_context(
) -> Generator[
    tuple[
        TestClient,
        Session,
        dict[str, Account],
        Account,
        Account,
    ],
    None,
    None,
]:
    connection = engine.connect()
    transaction = connection.begin()

    database = Session(
        bind=connection,
        expire_on_commit=False,
    )

    unique_value = uuid4().hex

    first_account = Account(
        full_name="AI Test Kullanıcısı",
        email=(
            f"ai-test-{unique_value}"
            "@example.com"
        ),
        password_hash="test-password-hash",
        role="user",
        is_active=True,
    )

    second_account = Account(
        full_name="İkinci AI Test Kullanıcısı",
        email=(
            f"ai-test-second-{unique_value}"
            "@example.com"
        ),
        password_hash="test-password-hash",
        role="user",
        is_active=True,
    )

    database.add_all(
        [
            first_account,
            second_account,
        ]
    )
    database.flush()

    active_account = {
        "value": first_account,
    }

    def override_get_db(
    ) -> Generator[
        Session,
        None,
        None,
    ]:
        yield database

    def override_get_current_account(
    ) -> Account:
        return active_account["value"]

    app.dependency_overrides[get_db] = (
        override_get_db
    )

    app.dependency_overrides[
        get_current_account
    ] = override_get_current_account

    client = TestClient(app)

    try:
        yield (
            client,
            database,
            active_account,
            first_account,
            second_account,
        )
    finally:
        app.dependency_overrides.clear()
        database.close()

        if transaction.is_active:
            transaction.rollback()

        connection.close()


def test_ai_session_full_flow(
    ai_test_context: tuple[
        TestClient,
        Session,
        dict[str, Account],
        Account,
        Account,
    ],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    (
        client,
        database,
        _active_account,
        first_account,
        _second_account,
    ) = ai_test_context

    create_response = client.post(
        "/ai/sessions",
        json={
            "title": (
                "DECT telefon çalışmıyor"
            ),
            "description": (
                "DECT telefon açılıyor ancak "
                "arama yapılamıyor."
            ),
            "department": (
                "Bilgi Teknolojileri"
            ),
            "category": "Telefon",
            "subcategory": "DECT Telefon",
            "priority": "medium",
        },
    )

    assert create_response.status_code == 201

    created_session = create_response.json()

    session_id = created_session["session_id"]

    assert (
        created_session["account_id"]
        == first_account.account_id
    )
    assert created_session["status"] == "pending"
    assert (
        created_session["confidence_score"]
        is None
    )
    assert (
        created_session["resolution_status"]
        is None
    )

    assert len(
        created_session["messages"]
    ) == 1

    assert (
        created_session["messages"][0][
            "sender_type"
        ]
        == "user"
    )

    list_response = client.get(
        "/ai/sessions"
    )

    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = client.get(
        f"/ai/sessions/{session_id}"
    )

    assert detail_response.status_code == 200
    assert (
        detail_response.json()["session_id"]
        == session_id
    )

    def fake_rag_solution(
        ai_session: AISession,
        user_message: AIMessage,
    ) -> TemporaryRAGSolution:
        assert (
            ai_session.session_id
            == session_id
        )

        assert (
            user_message.sender_type
            == "user"
        )

        return TemporaryRAGSolution(
            content=(
                "1. Telefonun hat bağlantısını "
                "kontrol edin.\n"
                "2. Cihazı yeniden başlatın."
            ),
            confidence_score=0.8123,
            source_request_ids=[
                "10165",
                "10645",
            ],
        )

    monkeypatch.setattr(
        (
            "app.ai.router."
            "generate_temporary_rag_solution"
        ),
        fake_rag_solution,
    )

    solution_response = client.post(
        (
            f"/ai/sessions/{session_id}"
            "/solution"
        )
    )

    assert solution_response.status_code == 200

    solution_data = solution_response.json()

    assert solution_data["status"] == "completed"
    assert (
        float(
            solution_data[
                "confidence_score"
            ]
        )
        == 0.8123
    )

    assert len(
        solution_data["messages"]
    ) == 2

    assert (
        solution_data["messages"][1][
            "sender_type"
        ]
        == "assistant"
    )

    assert (
        "Telefonun hat bağlantısını"
        in solution_data["messages"][1][
            "content"
        ]
    )

    duplicate_solution_response = (
        client.post(
            (
                f"/ai/sessions/{session_id}"
                "/solution"
            )
        )
    )

    assert (
        duplicate_solution_response.status_code
        == 409
    )

    resolution_response = client.patch(
        (
            f"/ai/sessions/{session_id}"
            "/resolution"
        ),
        json={
            "resolution_status": (
                "unresolved"
            ),
        },
    )

    assert resolution_response.status_code == 200

    resolution_data = (
        resolution_response.json()
    )

    assert (
        resolution_data["status"]
        == "completed"
    )
    assert (
        resolution_data[
            "resolution_status"
        ]
        == "unresolved"
    )
    assert (
        resolution_data["completed_at"]
        is not None
    )

    database.expire_all()

    stored_session = database.get(
        AISession,
        session_id,
    )

    assert stored_session is not None
    assert (
        stored_session.account_id
        == first_account.account_id
    )
    assert (
        stored_session.resolution_status
        == "unresolved"
    )

    stored_messages = database.scalars(
        select(AIMessage)
        .where(
            AIMessage.session_id
            == session_id
        )
        .order_by(
            AIMessage.message_id.asc()
        )
    ).all()

    assert len(stored_messages) == 2
    assert (
        stored_messages[0].sender_type
        == "user"
    )
    assert (
        stored_messages[1].sender_type
        == "assistant"
    )


def test_user_cannot_access_another_session(
    ai_test_context: tuple[
        TestClient,
        Session,
        dict[str, Account],
        Account,
        Account,
    ],
) -> None:
    (
        client,
        _database,
        active_account,
        first_account,
        second_account,
    ) = ai_test_context

    create_response = client.post(
        "/ai/sessions",
        json={
            "title": "Yazıcı bağlantı sorunu",
            "description": (
                "Yazıcı çevrim dışı görünüyor."
            ),
            "department": (
                "Bilgi Teknolojileri"
            ),
            "category": "Yazıcı",
            "subcategory": (
                "Bağlantı Sorunu"
            ),
            "priority": "low",
        },
    )

    assert create_response.status_code == 201

    session_id = (
        create_response.json()["session_id"]
    )

    assert (
        create_response.json()["account_id"]
        == first_account.account_id
    )

    active_account["value"] = second_account

    detail_response = client.get(
        f"/ai/sessions/{session_id}"
    )

    assert detail_response.status_code == 404

    solution_response = client.post(
        (
            f"/ai/sessions/{session_id}"
            "/solution"
        )
    )

    assert solution_response.status_code == 404

    resolution_response = client.patch(
        (
            f"/ai/sessions/{session_id}"
            "/resolution"
        ),
        json={
            "resolution_status": "resolved",
        },
    )

    assert resolution_response.status_code == 404

    list_response = client.get(
        "/ai/sessions"
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
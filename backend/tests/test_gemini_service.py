from types import SimpleNamespace

import pytest

import app.ai.gemini_service as gemini_service
from app.ai.models import AIMessage, AISession


def build_ai_session() -> AISession:
    return AISession(
        account_id=1,
        title="DECT telefon çalışmıyor",
        department="Üretim",
        category="Donanım",
        subcategory="Telefon",
        priority="high",
        status="pending",
    )


def build_user_message() -> AIMessage:
    return AIMessage(
        session_id=1,
        sender_type="user",
        content=(
            "DECT telefon açılmıyor ve şarj olmuyor. "
            "Ekranda herhangi bir görüntü bulunmuyor."
        ),
    )


def build_similar_tickets() -> list[dict]:
    return [
        {
            "request_id": 10165,
            "subject": "DECT TELEFON ARIZASI",
            "description": (
                "Üretim sahasındaki DECT telefon açılmıyor."
            ),
            "resolution": "DECT telefon değiştirildi.",
            "similarity": 0.8503,
        },
        {
            "request_id": 10645,
            "subject": "DECT TELEFON ŞARJ SORUNU",
            "description": (
                "Telefon şarj ünitesinde enerji almıyor."
            ),
            "resolution": (
                "Şarj adaptörü ve batarya kontrol edildi."
            ),
            "similarity": 0.7125,
        },
    ]


def test_build_gemini_prompt_contains_session_and_sources():
    prompt = gemini_service.build_gemini_prompt(
        ai_session=build_ai_session(),
        user_message=build_user_message(),
        similar_tickets=build_similar_tickets(),
    )

    assert "DECT telefon çalışmıyor" in prompt
    assert "Üretim" in prompt
    assert "Donanım" in prompt
    assert "Telefon" in prompt
    assert "DECT TELEFON ARIZASI" in prompt
    assert "DECT telefon değiştirildi." in prompt
    assert "10165" in prompt
    assert "%85.03" in prompt


def test_generate_gemini_solution_returns_generated_content(
    monkeypatch,
):
    captured: dict = {}

    class FakeModels:
        def generate_content(
            self,
            *,
            model,
            contents,
            config,
        ):
            captured["model"] = model
            captured["contents"] = contents
            captured["config"] = config

            return SimpleNamespace(
                text=(
                    "Sorun değerlendirmesi:\n"
                    "Telefon enerji almıyor olabilir.\n\n"
                    "Önerilen çözüm:\n"
                    "1. Şarj adaptörünü kontrol edin."
                )
            )

    class FakeClient:
        def __init__(
            self,
            *,
            api_key,
            http_options,
        ):
            captured["api_key"] = api_key
            captured["http_options"] = http_options
            captured["closed"] = False
            self.models = FakeModels()

        def close(self):
            captured["closed"] = True

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )
    monkeypatch.setenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash",
    )
    monkeypatch.setenv(
        "GEMINI_TIMEOUT_SECONDS",
        "45",
    )
    monkeypatch.setattr(
        gemini_service.genai,
        "Client",
        FakeClient,
    )

    result = gemini_service.generate_gemini_solution(
        ai_session=build_ai_session(),
        user_message=build_user_message(),
        similar_tickets=build_similar_tickets(),
    )

    assert result.model == "gemini-3.5-flash"
    assert result.content.startswith(
        "Sorun değerlendirmesi:"
    )

    assert captured["api_key"] == "test-api-key"
    assert captured["model"] == "gemini-3.5-flash"
    assert "DECT telefon çalışmıyor" in captured["contents"]

    assert (
        captured["http_options"].timeout
        == 45_000
    )
    assert (
        captured["config"].max_output_tokens
        == 1400
    )
    assert captured["closed"] is True


def test_generate_gemini_solution_requires_api_key(
    monkeypatch,
):
    monkeypatch.delenv(
        "GEMINI_API_KEY",
        raising=False,
    )
    monkeypatch.setenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash",
    )
    monkeypatch.setenv(
        "GEMINI_TIMEOUT_SECONDS",
        "60",
    )

    with pytest.raises(
        gemini_service.GeminiServiceError,
        match="GEMINI_API_KEY",
    ):
        gemini_service.generate_gemini_solution(
            ai_session=build_ai_session(),
            user_message=build_user_message(),
            similar_tickets=[],
        )


def test_generate_gemini_solution_rejects_invalid_timeout(
    monkeypatch,
):
    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )
    monkeypatch.setenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash",
    )
    monkeypatch.setenv(
        "GEMINI_TIMEOUT_SECONDS",
        "gecersiz",
    )

    with pytest.raises(
        gemini_service.GeminiServiceError,
        match="tam sayı",
    ):
        gemini_service.generate_gemini_solution(
            ai_session=build_ai_session(),
            user_message=build_user_message(),
            similar_tickets=[],
        )


def test_generate_gemini_solution_converts_api_error(
    monkeypatch,
):
    captured = {
        "closed": False,
    }

    class FakeAPIError(Exception):
        pass

    class FakeModels:
        def generate_content(
            self,
            *,
            model,
            contents,
            config,
        ):
            raise FakeAPIError(
                "API bağlantı hatası"
            )

    class FakeClient:
        def __init__(
            self,
            *,
            api_key,
            http_options,
        ):
            self.models = FakeModels()

        def close(self):
            captured["closed"] = True

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )
    monkeypatch.setenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash",
    )
    monkeypatch.setenv(
        "GEMINI_TIMEOUT_SECONDS",
        "60",
    )
    monkeypatch.setattr(
        gemini_service,
        "APIError",
        FakeAPIError,
    )
    monkeypatch.setattr(
        gemini_service.genai,
        "Client",
        FakeClient,
    )

    with pytest.raises(
        gemini_service.GeminiServiceError,
        match="Gemini API isteği başarısız",
    ):
        gemini_service.generate_gemini_solution(
            ai_session=build_ai_session(),
            user_message=build_user_message(),
            similar_tickets=[],
        )

    assert captured["closed"] is True


def test_generate_gemini_solution_rejects_empty_response(
    monkeypatch,
):
    class FakeModels:
        def generate_content(
            self,
            *,
            model,
            contents,
            config,
        ):
            return SimpleNamespace(
                text="   "
            )

    class FakeClient:
        def __init__(
            self,
            *,
            api_key,
            http_options,
        ):
            self.models = FakeModels()

        def close(self):
            pass

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )
    monkeypatch.setenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash",
    )
    monkeypatch.setenv(
        "GEMINI_TIMEOUT_SECONDS",
        "60",
    )
    monkeypatch.setattr(
        gemini_service.genai,
        "Client",
        FakeClient,
    )

    with pytest.raises(
        gemini_service.GeminiServiceError,
        match="boş bir cevap",
    ):
        gemini_service.generate_gemini_solution(
            ai_session=build_ai_session(),
            user_message=build_user_message(),
            similar_tickets=[],
        )
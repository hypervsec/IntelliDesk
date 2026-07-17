from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError


# =========================================================
# .ENV DOSYASINI YÜKLE
# =========================================================

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

load_dotenv(ENV_PATH)


# =========================================================
# JWT AYARLARI
# =========================================================

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"

JWT_ISSUER = "intellidesk-api"
JWT_AUDIENCE = "intellidesk-frontend"

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY bulunamadı. "
        f"Lütfen {ENV_PATH} dosyasını kontrol et."
    )

if len(JWT_SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET_KEY en az 32 karakter olmalıdır."
    )

try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv(
            "ACCESS_TOKEN_EXPIRE_MINUTES",
            "60",
        )
    )
except ValueError as exc:
    raise RuntimeError(
        "ACCESS_TOKEN_EXPIRE_MINUTES sayısal olmalıdır."
    ) from exc

if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError(
        "ACCESS_TOKEN_EXPIRE_MINUTES sıfırdan büyük olmalıdır."
    )

ACCESS_TOKEN_EXPIRE_SECONDS = (
    ACCESS_TOKEN_EXPIRE_MINUTES * 60
)


# =========================================================
# PAROLA HASHLEME
# =========================================================

password_hash = PasswordHash.recommended()

DUMMY_PASSWORD_HASH = password_hash.hash(
    "IntelliDeskDummyPassword123!"
)


def hash_password(
    plain_password: str,
) -> str:
    """
    Düz metin parolayı Argon2 ile hashler.
    """

    return password_hash.hash(
        plain_password
    )


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Kullanıcının girdiği parola ile veritabanındaki
    parola hash değerini karşılaştırır.
    """

    try:
        return password_hash.verify(
            plain_password,
            hashed_password,
        )
    except (
        UnknownHashError,
        ValueError,
        TypeError,
    ):
        return False


def verify_password_with_dummy(
    plain_password: str,
    hashed_password: str | None,
) -> bool:
    """
    Hesap bulunamadığında da parola doğrulama işlemi
    gerçekleştirerek giriş kontrolünün benzer sürede
    tamamlanmasını sağlar.
    """

    if hashed_password is None:
        verify_password(
            plain_password,
            DUMMY_PASSWORD_HASH,
        )
        return False

    return verify_password(
        plain_password,
        hashed_password,
    )


# =========================================================
# JWT OLUŞTURMA
# =========================================================

def create_access_token(
    account_id: int,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Belirtilen hesap için JWT access token üretir.
    """

    if account_id <= 0:
        raise ValueError(
            "account_id sıfırdan büyük olmalıdır."
        )

    current_time = datetime.now(
        timezone.utc
    )

    expiration_time = current_time + (
        expires_delta
        if expires_delta is not None
        else timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(account_id),
        "type": "access",
        "iat": current_time,
        "exp": expiration_time,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# =========================================================
# JWT DOĞRULAMA
# =========================================================

def decode_access_token(
    token: str,
) -> dict[str, Any]:
    """
    JWT access token değerini doğrular ve içeriğini döndürür.

    Geçersiz veya süresi dolmuş token durumunda
    InvalidTokenError oluşturur.
    """

    payload = jwt.decode(
        token,
        JWT_SECRET_KEY,
        algorithms=[
            JWT_ALGORITHM,
        ],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
        options={
            "require": [
                "sub",
                "type",
                "iat",
                "exp",
                "iss",
                "aud",
            ],
        },
    )

    if payload.get("type") != "access":
        raise InvalidTokenError(
            "Geçersiz token türü."
        )

    subject = payload.get("sub")

    try:
        account_id = int(subject)
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise InvalidTokenError(
            "Geçersiz hesap kimliği."
        ) from exc

    if account_id <= 0:
        raise InvalidTokenError(
            "Geçersiz hesap kimliği."
        )

    payload["account_id"] = account_id

    return payload
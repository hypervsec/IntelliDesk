from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jwt.exceptions import InvalidTokenError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account
from ..schemas import (
    AccountLogin,
    AccountRegister,
    AccountResponse,
    TokenResponse,
)
from ..security import (
    ACCESS_TOKEN_EXPIRE_SECONDS,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password_with_dummy,
)


router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

bearer_scheme = HTTPBearer(
    auto_error=False,
)


# =========================================================
# HATA YARDIMCILARI
# =========================================================

def create_authentication_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Oturum bilgisi geçersiz veya süresi dolmuş.",
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )


# =========================================================
# AKTİF KULLANICI BAĞIMLILIĞI
# =========================================================

def get_current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> Account:
    if credentials is None:
        raise create_authentication_exception()

    if credentials.scheme.lower() != "bearer":
        raise create_authentication_exception()

    try:
        token_payload = decode_access_token(
            credentials.credentials
        )
    except InvalidTokenError as exc:
        raise create_authentication_exception() from exc

    account_id = token_payload["account_id"]

    account = db.scalar(
        select(Account).where(
            Account.account_id == account_id
        )
    )

    if account is None:
        raise create_authentication_exception()

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu kullanıcı hesabı devre dışı bırakılmış.",
        )

    return account


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_account(
    register_data: AccountRegister,
    db: Session = Depends(get_db),
) -> Account:
    normalized_email = str(
        register_data.email
    ).strip().lower()

    existing_account = db.scalar(
        select(Account).where(
            func.lower(Account.email)
            == normalized_email
        )
    )

    if existing_account is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresiyle kayıtlı bir hesap bulunmaktadır.",
        )

    account = Account(
        full_name=register_data.full_name,
        email=normalized_email,
        password_hash=hash_password(
            register_data.password
        ),
        role="user",
        is_active=True,
    )

    db.add(account)

    try:
        db.commit()
        db.refresh(account)
    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresiyle kayıtlı bir hesap bulunmaktadır.",
        ) from exc

    return account


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login_account(
    login_data: AccountLogin,
    db: Session = Depends(get_db),
) -> TokenResponse:
    normalized_email = str(
        login_data.email
    ).strip().lower()

    account = db.scalar(
        select(Account).where(
            func.lower(Account.email)
            == normalized_email
        )
    )

    password_is_valid = verify_password_with_dummy(
        plain_password=login_data.password,
        hashed_password=(
            account.password_hash
            if account is not None
            else None
        ),
    )

    if account is None or not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta adresi veya parola hatalı.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu kullanıcı hesabı devre dışı bırakılmış.",
        )

    account.last_login_at = datetime.now()

    db.commit()
    db.refresh(account)

    access_token = create_access_token(
        account_id=account.account_id
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_SECONDS,
        account=AccountResponse.model_validate(
            account
        ),
    )


# =========================================================
# CURRENT ACCOUNT
# =========================================================

@router.get(
    "/me",
    response_model=AccountResponse,
)
def get_my_account(
    current_account: Account = Depends(
        get_current_account
    ),
) -> Account:
    return current_account
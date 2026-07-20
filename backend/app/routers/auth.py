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
    AccountAdminUpdate,
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
# AUTH HATALARI
# =========================================================

def create_authentication_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "Oturum bilgisi geçersiz "
            "veya süresi dolmuş."
        ),
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )


# =========================================================
# OTURUM AÇMIŞ KULLANICI
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
            detail=(
                "Bu kullanıcı hesabı "
                "devre dışı bırakılmış."
            ),
        )

    return account


# =========================================================
# ROL KONTROLLERİ
# =========================================================

def get_current_staff_account(
    current_account: Account = Depends(
        get_current_account
    ),
) -> Account:
    if current_account.role not in {
        "technician",
        "admin",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Bu işlem için teknisyen veya "
                "yönetici yetkisi gereklidir."
            ),
        )

    return current_account


def get_current_admin_account(
    current_account: Account = Depends(
        get_current_account
    ),
) -> Account:
    if current_account.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Bu işlem için yönetici "
                "yetkisi gereklidir."
            ),
        )

    return current_account


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
            detail=(
                "Bu e-posta adresiyle kayıtlı "
                "bir hesap bulunmaktadır."
            ),
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
            detail=(
                "Bu e-posta adresiyle kayıtlı "
                "bir hesap bulunmaktadır."
            ),
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
            detail=(
                "E-posta adresi veya parola hatalı."
            ),
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Bu kullanıcı hesabı "
                "devre dışı bırakılmış."
            ),
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


# =========================================================
# AKTİF TEKNİK PERSONEL
# =========================================================

@router.get(
    "/staff",
    response_model=list[AccountResponse],
)
def list_active_staff_accounts(
    _current_account: Account = Depends(
        get_current_staff_account
    ),
    db: Session = Depends(get_db),
) -> list[Account]:
    staff_accounts = db.scalars(
        select(Account)
        .where(
            Account.is_active.is_(True),
            Account.role.in_(
                (
                    "technician",
                    "admin",
                )
            ),
        )
        .order_by(
            Account.full_name.asc(),
            Account.account_id.asc(),
        )
    ).all()

    return list(staff_accounts)


# =========================================================
# ADMIN - TÜM HESAPLARI LİSTELE
# =========================================================

@router.get(
    "/accounts",
    response_model=list[AccountResponse],
)
def list_accounts(
    _current_admin: Account = Depends(
        get_current_admin_account
    ),
    db: Session = Depends(get_db),
) -> list[Account]:
    accounts = db.scalars(
        select(Account).order_by(
            Account.created_at.desc(),
            Account.account_id.desc(),
        )
    ).all()

    return list(accounts)


# =========================================================
# ADMIN - HESAP GÜNCELLE
# =========================================================

@router.patch(
    "/accounts/{account_id}",
    response_model=AccountResponse,
)
def update_account_by_admin(
    account_id: int,
    update_data: AccountAdminUpdate,
    current_admin: Account = Depends(
        get_current_admin_account
    ),
    db: Session = Depends(get_db),
) -> Account:
    account = db.scalar(
        select(Account).where(
            Account.account_id == account_id
        )
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı hesabı bulunamadı.",
        )

    changes = update_data.model_dump(
        exclude_unset=True
    )

    requested_role = changes.get("role")
    requested_is_active = changes.get(
        "is_active"
    )

    is_current_account = (
        account.account_id
        == current_admin.account_id
    )

    if (
        is_current_account
        and requested_role is not None
        and requested_role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Kendi yönetici rolünüzü "
                "değiştiremezsiniz."
            ),
        )

    if (
        is_current_account
        and requested_is_active is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Kendi hesabınızı devre dışı "
                "bırakamazsınız."
            ),
        )

    account_is_active_admin = (
        account.role == "admin"
        and account.is_active
    )

    account_will_lose_admin_access = (
        (
            requested_role is not None
            and requested_role != "admin"
        )
        or requested_is_active is False
    )

    if (
        account_is_active_admin
        and account_will_lose_admin_access
    ):
        active_admin_count = db.scalar(
            select(
                func.count(Account.account_id)
            ).where(
                Account.role == "admin",
                Account.is_active.is_(True),
            )
        )

        if int(active_admin_count or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Sistemde en az bir aktif "
                    "yönetici hesabı bulunmalıdır."
                ),
            )

    for field, value in changes.items():
        setattr(
            account,
            field,
            value,
        )

    account.updated_at = datetime.now()

    db.commit()
    db.refresh(account)

    return account
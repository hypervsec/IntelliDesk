from __future__ import annotations

from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy.orm import Session

from ..audit.service import insert_audit_log
from ..database import get_db
from ..models import Account
from ..request_context import (
    get_request_metadata,
)
from ..schemas import MessageResponse
from ..security import (
    hash_password,
    verify_password,
)
from .auth import get_current_account


router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(
        min_length=1,
        max_length=128,
    )

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )

    password_confirm: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(
        cls,
        value: str,
    ) -> str:
        if not any(
            character.islower()
            for character in value
        ):
            raise ValueError(
                "Yeni parola en az bir küçük "
                "harf içermelidir."
            )

        if not any(
            character.isupper()
            for character in value
        ):
            raise ValueError(
                "Yeni parola en az bir büyük "
                "harf içermelidir."
            )

        if not any(
            character.isdigit()
            for character in value
        ):
            raise ValueError(
                "Yeni parola en az bir rakam "
                "içermelidir."
            )

        return value

    @model_validator(mode="after")
    def validate_password_confirmation(
        self,
    ) -> PasswordChangeRequest:
        if (
            self.new_password
            != self.password_confirm
        ):
            raise ValueError(
                "Yeni parola ve parola tekrarı "
                "eşleşmiyor."
            )

        return self


@router.patch(
    "/password",
    response_model=MessageResponse,
)
def change_my_password(
    password_data: PasswordChangeRequest,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> MessageResponse:
    current_password_is_valid = (
        verify_password(
            plain_password=(
                password_data.current_password
            ),
            hashed_password=(
                current_account.password_hash
            ),
        )
    )

    if not current_password_is_valid:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail="Mevcut parola hatalı.",
        )

    new_password_is_current_password = (
        verify_password(
            plain_password=(
                password_data.new_password
            ),
            hashed_password=(
                current_account.password_hash
            ),
        )
    )

    if new_password_is_current_password:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Yeni parola mevcut paroladan "
                "farklı olmalıdır."
            ),
        )

    current_account.password_hash = (
        hash_password(
            password_data.new_password
        )
    )

    current_account.updated_at = (
        datetime.now()
    )

    request_metadata = (
        get_request_metadata()
    )

    insert_audit_log(
        db.connection(),
        actor_account_id=(
            current_account.account_id
        ),
        actor_name=(
            current_account.full_name
        ),
        actor_role=(
            current_account.role
        ),
        action_type="password_changed",
        entity_type="account",
        entity_id=(
            current_account.account_id
        ),
        ticket_id=None,
        description=(
            f"{current_account.full_name} "
            "hesap parolasını değiştirdi."
        ),
        ip_address=(
            request_metadata.ip_address
            if request_metadata is not None
            else None
        ),
        http_method=(
            request_metadata.http_method
            if request_metadata is not None
            else None
        ),
        request_path=(
            request_metadata.request_path
            if request_metadata is not None
            else None
        ),
        status_code=status.HTTP_200_OK,
        details={
            "account_id": (
                current_account.account_id
            ),
            "result": "success",
        },
    )

    db.commit()

    return MessageResponse(
        message=(
            "Parolanız başarıyla güncellendi."
        )
    )
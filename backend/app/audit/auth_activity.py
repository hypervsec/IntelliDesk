from sqlalchemy import event
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapper, Session

from .service import insert_audit_log
from ..models import Account
from ..request_context import (
    get_request_metadata,
)


def get_request_values() -> tuple[
    str | None,
    str | None,
    str | None,
]:
    metadata = get_request_metadata()

    if metadata is None:
        return (
            None,
            None,
            None,
        )

    return (
        metadata.ip_address,
        metadata.http_method,
        metadata.request_path,
    )


# =========================================================
# YENİ KULLANICI HESABI
# =========================================================

@event.listens_for(
    Account,
    "after_insert",
)
def record_account_created(
    _mapper: Mapper,
    connection: Connection,
    account: Account,
) -> None:
    ip_address, http_method, request_path = (
        get_request_values()
    )

    insert_audit_log(
        connection,
        actor_account_id=account.account_id,
        actor_name=account.full_name,
        actor_role=account.role,
        action_type="account_created",
        entity_type="account",
        entity_id=account.account_id,
        ticket_id=None,
        description=(
            f"{account.full_name} kullanıcı hesabı "
            "oluşturuldu."
        ),
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
        status_code=201,
        details={
            "target_account_id": (
                account.account_id
            ),
            "target_full_name": (
                account.full_name
            ),
            "target_email": (
                account.email
            ),
            "new_role": account.role,
            "new_is_active": (
                account.is_active
            ),
        },
    )


# =========================================================
# OTURUM AÇMA DENEMESİ
# =========================================================

def record_login_attempt(
    db: Session,
    *,
    attempted_email: str,
    account: Account | None,
    succeeded: bool,
    status_code: int,
    failure_reason: str | None = None,
) -> None:
    ip_address, http_method, request_path = (
        get_request_values()
    )

    if succeeded:
        actor_name = (
            account.full_name
            if account is not None
            else attempted_email
        )

        description = (
            f"{actor_name} sisteme giriş yaptı."
        )

        action_type = "login_succeeded"
    else:
        actor_name = (
            account.full_name
            if account is not None
            else attempted_email
        )

        description = (
            f"{attempted_email} adresiyle giriş "
            "denemesi başarısız oldu."
        )

        action_type = "login_failed"

    details: dict[str, object] = {
        "email": attempted_email,
        "result": (
            "success"
            if succeeded
            else "failed"
        ),
    }

    if failure_reason:
        details["failure_reason"] = (
            failure_reason
        )

    insert_audit_log(
        db.connection(),
        actor_account_id=(
            account.account_id
            if account is not None
            else None
        ),
        actor_name=actor_name,
        actor_role=(
            account.role
            if account is not None
            else None
        ),
        action_type=action_type,
        entity_type="authentication",
        entity_id=(
            account.account_id
            if account is not None
            else None
        ),
        ticket_id=None,
        description=description,
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
        status_code=status_code,
        details=details,
    )


# =========================================================
# YÖNETİCİ HESAP GÜNCELLEMESİ
# =========================================================

def record_account_admin_update(
    db: Session,
    *,
    actor: Account,
    target_account: Account,
    old_role: str,
    old_is_active: bool,
) -> None:
    role_changed = (
        old_role
        != target_account.role
    )

    active_status_changed = (
        old_is_active
        != target_account.is_active
    )

    if (
        not role_changed
        and not active_status_changed
    ):
        return

    if (
        role_changed
        and active_status_changed
    ):
        action_type = (
            "account_role_and_status_changed"
        )

        changed_text = (
            "rolü ve hesap durumu"
        )
    elif role_changed:
        action_type = (
            "account_role_changed"
        )

        changed_text = "rolü"
    else:
        action_type = (
            "account_status_changed"
        )

        changed_text = (
            "hesap durumu"
        )

    ip_address, http_method, request_path = (
        get_request_values()
    )

    details: dict[str, object] = {
        "target_account_id": (
            target_account.account_id
        ),
        "target_full_name": (
            target_account.full_name
        ),
        "target_email": (
            target_account.email
        ),
    }

    if role_changed:
        details["old_role"] = old_role
        details["new_role"] = (
            target_account.role
        )

    if active_status_changed:
        details["old_is_active"] = (
            old_is_active
        )

        details["new_is_active"] = (
            target_account.is_active
        )

    insert_audit_log(
        db.connection(),
        actor_account_id=(
            actor.account_id
        ),
        actor_name=actor.full_name,
        actor_role=actor.role,
        action_type=action_type,
        entity_type="account",
        entity_id=(
            target_account.account_id
        ),
        ticket_id=None,
        description=(
            f"{target_account.full_name} "
            f"kullanıcısının {changed_text} "
            "güncellendi."
        ),
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
        status_code=200,
        details=details,
    )
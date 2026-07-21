import logging
import re
from typing import Any

from fastapi import Request
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from .service import insert_audit_log
from ..database import SessionLocal
from ..models import Account, Ticket
from ..security import decode_access_token


logger = logging.getLogger(__name__)


ADMIN_ACCOUNT_PATH_PATTERN = re.compile(
    r"^/auth/accounts/(?P<account_id>\d+)$"
)

AI_RECOMMENDATION_PATH_PATTERN = re.compile(
    r"^/tickets/(?P<ticket_id>\d+)/recommendation$"
)

AI_FEEDBACK_PATH_PATTERN = re.compile(
    r"^/tickets/(?P<ticket_id>\d+)/feedback$"
)


def get_request_ip(
    request: Request,
) -> str | None:
    forwarded_for = request.headers.get(
        "x-forwarded-for"
    )

    if forwarded_for:
        forwarded_ip = (
            forwarded_for
            .split(",")[0]
            .strip()
        )

        if forwarded_ip:
            return forwarded_ip[:45]

    if request.client is None:
        return None

    return request.client.host[:45]


def get_bearer_token(
    request: Request,
) -> str | None:
    authorization = request.headers.get(
        "authorization"
    )

    if not authorization:
        return None

    scheme, separator, token = (
        authorization.partition(" ")
    )

    if (
        not separator
        or scheme.lower() != "bearer"
        or not token.strip()
    ):
        return None

    return token.strip()


def resolve_actor(
    db: Session,
    request: Request,
) -> Account | None:
    token = get_bearer_token(
        request
    )

    if token is None:
        return None

    try:
        token_payload = decode_access_token(
            token
        )
    except InvalidTokenError:
        return None

    account_id = token_payload.get(
        "account_id"
    )

    if not isinstance(account_id, int):
        return None

    return db.get(
        Account,
        account_id,
    )


def build_registration_failure(
    *,
    status_code: int,
) -> dict[str, Any] | None:
    if status_code != 409:
        return None

    return {
        "action_type": (
            "account_registration_failed"
        ),
        "entity_type": "account",
        "entity_id": None,
        "ticket_id": None,
        "description": (
            "Yeni kullanıcı hesabı oluşturma "
            "denemesi başarısız oldu."
        ),
        "details": {
            "result": "failed",
            "failure_reason": (
                "email_already_registered"
            ),
        },
    }


def build_admin_action_failure(
    db: Session,
    *,
    actor: Account | None,
    account_id: int,
    status_code: int,
) -> dict[str, Any] | None:
    if status_code != 400:
        return None

    target_account = db.get(
        Account,
        account_id,
    )

    is_self_action = (
        actor is not None
        and actor.account_id == account_id
    )

    if is_self_action:
        failure_reason = (
            "self_account_protection"
        )

        description = (
            "Yöneticinin kendi rolünü veya "
            "hesap durumunu değiştirme işlemi "
            "güvenlik kuralı nedeniyle engellendi."
        )
    else:
        failure_reason = (
            "last_active_admin_protection"
        )

        description = (
            "Yönetici hesabı güncelleme işlemi, "
            "sistemde aktif yönetici kalmasını "
            "sağlayan güvenlik kuralı nedeniyle "
            "engellendi."
        )

    details: dict[str, Any] = {
        "target_account_id": account_id,
        "result": "blocked",
        "failure_reason": failure_reason,
    }

    if target_account is not None:
        details["target_full_name"] = (
            target_account.full_name
        )

        details["target_email"] = (
            target_account.email
        )

        details["old_role"] = (
            target_account.role
        )

        details["old_is_active"] = (
            target_account.is_active
        )

    return {
        "action_type": (
            "account_admin_action_blocked"
        ),
        "entity_type": "account",
        "entity_id": account_id,
        "ticket_id": None,
        "description": description,
        "details": details,
    }


def build_recommendation_failure(
    db: Session,
    *,
    ticket_id: int,
    status_code: int,
) -> dict[str, Any] | None:
    if status_code != 404:
        return None

    ticket = db.get(
        Ticket,
        ticket_id,
    )

    if ticket is None:
        failure_reason = "ticket_not_found"

        description = (
            f"#{ticket_id} numaralı ticket "
            "bulunamadığı için AI çözüm önerisi "
            "oluşturulamadı."
        )
    else:
        failure_reason = (
            "similar_ticket_not_found"
        )

        description = (
            f"#{ticket_id} numaralı ticket için "
            "uygun geçmiş kayıt bulunamadığından "
            "AI çözüm önerisi oluşturulamadı."
        )

    details: dict[str, Any] = {
        "ticket_id": ticket_id,
        "result": "failed",
        "failure_reason": failure_reason,
    }

    if ticket is not None:
        details["ticket_title"] = (
            ticket.title[:250]
        )

    return {
        "action_type": (
            "ai_recommendation_failed"
        ),
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "ticket_id": (
            ticket_id
            if ticket is not None
            else None
        ),
        "description": description,
        "details": details,
    }


def build_feedback_failure(
    db: Session,
    *,
    ticket_id: int,
    status_code: int,
) -> dict[str, Any] | None:
    if status_code not in {
        400,
        404,
    }:
        return None

    ticket = db.get(
        Ticket,
        ticket_id,
    )

    if ticket is None:
        failure_reason = "ticket_not_found"

        description = (
            f"#{ticket_id} numaralı ticket "
            "bulunamadığı için AI geri bildirimi "
            "kaydedilemedi."
        )
    elif ticket.ai_recommendation is None:
        failure_reason = (
            "recommendation_missing"
        )

        description = (
            f"#{ticket_id} numaralı ticket için "
            "AI önerisi bulunmadığından geri "
            "bildirim kaydedilemedi."
        )
    else:
        failure_reason = (
            "feedback_validation_failed"
        )

        description = (
            f"#{ticket_id} numaralı ticketın "
            "AI geri bildirimi doğrulama hatası "
            "nedeniyle kaydedilemedi."
        )

    details: dict[str, Any] = {
        "ticket_id": ticket_id,
        "result": "failed",
        "failure_reason": failure_reason,
    }

    if ticket is not None:
        details["ticket_title"] = (
            ticket.title[:250]
        )

    return {
        "action_type": (
            "ai_feedback_failed"
        ),
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "ticket_id": (
            ticket_id
            if ticket is not None
            else None
        ),
        "description": description,
        "details": details,
    }


def build_failure_event(
    db: Session,
    *,
    request: Request,
    actor: Account | None,
    status_code: int,
) -> dict[str, Any] | None:
    request_method = (
        request.method.upper()
    )

    request_path = (
        request.url.path.rstrip("/")
        or "/"
    )

    if (
        request_method == "POST"
        and request_path == "/auth/register"
    ):
        return build_registration_failure(
            status_code=status_code,
        )

    admin_match = (
        ADMIN_ACCOUNT_PATH_PATTERN.match(
            request_path
        )
    )

    if (
        request_method == "PATCH"
        and admin_match is not None
    ):
        return build_admin_action_failure(
            db,
            actor=actor,
            account_id=int(
                admin_match.group(
                    "account_id"
                )
            ),
            status_code=status_code,
        )

    recommendation_match = (
        AI_RECOMMENDATION_PATH_PATTERN.match(
            request_path
        )
    )

    if (
        request_method == "POST"
        and recommendation_match is not None
    ):
        return build_recommendation_failure(
            db,
            ticket_id=int(
                recommendation_match.group(
                    "ticket_id"
                )
            ),
            status_code=status_code,
        )

    feedback_match = (
        AI_FEEDBACK_PATH_PATTERN.match(
            request_path
        )
    )

    if (
        request_method == "POST"
        and feedback_match is not None
    ):
        return build_feedback_failure(
            db,
            ticket_id=int(
                feedback_match.group(
                    "ticket_id"
                )
            ),
            status_code=status_code,
        )

    return None


def record_failed_request_audit(
    request: Request,
    status_code: int,
) -> None:
    if status_code < 400:
        return

    db = SessionLocal()

    try:
        actor = resolve_actor(
            db,
            request,
        )

        failure_event = build_failure_event(
            db,
            request=request,
            actor=actor,
            status_code=status_code,
        )

        if failure_event is None:
            return

        actor_name = (
            actor.full_name
            if actor is not None
            else "Anonim kullanıcı"
        )

        actor_role = (
            actor.role
            if actor is not None
            else None
        )

        actor_account_id = (
            actor.account_id
            if actor is not None
            else None
        )

        insert_audit_log(
            db.connection(),
            actor_account_id=(
                actor_account_id
            ),
            actor_name=actor_name,
            actor_role=actor_role,
            action_type=(
                failure_event[
                    "action_type"
                ]
            ),
            entity_type=(
                failure_event[
                    "entity_type"
                ]
            ),
            entity_id=(
                failure_event[
                    "entity_id"
                ]
            ),
            ticket_id=(
                failure_event[
                    "ticket_id"
                ]
            ),
            description=(
                failure_event[
                    "description"
                ]
            ),
            ip_address=get_request_ip(
                request
            ),
            http_method=(
                request.method.upper()
            ),
            request_path=(
                request.url.path
            ),
            status_code=status_code,
            details=(
                failure_event[
                    "details"
                ]
            ),
        )

        db.commit()
    except Exception:
        db.rollback()

        logger.exception(
            "Başarısız işlem audit kaydı "
            "oluşturulamadı."
        )
    finally:
        db.close()
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import (
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from ..audit_schemas import (
    AuditLogPageResponse,
)
from ..database import get_db
from ..models import (
    Account,
    AuditLog,
)
from .auth import (
    get_current_admin_account,
)


router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"],
)


# =========================================================
# AUDIT LOG İŞLEM TÜRLERİ
# =========================================================

@router.get(
    "/action-types",
    response_model=list[str],
)
def list_audit_action_types(
    _current_admin: Account = Depends(
        get_current_admin_account
    ),
    db: Session = Depends(get_db),
) -> list[str]:
    action_types = db.scalars(
        select(
            AuditLog.action_type
        )
        .distinct()
        .order_by(
            AuditLog.action_type.asc()
        )
    ).all()

    return [
        action_type
        for action_type in action_types
        if action_type
    ]


# =========================================================
# AUDIT LOGLARI
# =========================================================

@router.get(
    "",
    response_model=AuditLogPageResponse,
)
def list_audit_logs(
    search: str | None = Query(
        default=None,
        max_length=200,
    ),
    action_type: str | None = Query(
        default=None,
        max_length=80,
    ),
    actor_account_id: int | None = Query(
        default=None,
        ge=1,
    ),
    ticket_id: int | None = Query(
        default=None,
        ge=1,
    ),
    start_date: datetime | None = Query(
        default=None,
    ),
    end_date: datetime | None = Query(
        default=None,
    ),
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=25,
        ge=10,
        le=100,
    ),
    _current_admin: Account = Depends(
        get_current_admin_account
    ),
    db: Session = Depends(get_db),
) -> AuditLogPageResponse:
    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Başlangıç tarihi bitiş "
                "tarihinden sonra olamaz."
            ),
        )

    filters = []

    normalized_search = (
        search.strip()
        if search
        else ""
    )

    if normalized_search:
        search_term = (
            f"%{normalized_search}%"
        )

        filters.append(
            or_(
                AuditLog.actor_name.ilike(
                    search_term
                ),
                AuditLog.action_type.ilike(
                    search_term
                ),
                AuditLog.entity_type.ilike(
                    search_term
                ),
                AuditLog.description.ilike(
                    search_term
                ),
                AuditLog.ip_address.ilike(
                    search_term
                ),
                AuditLog.request_path.ilike(
                    search_term
                ),
            )
        )

    normalized_action_type = (
        action_type.strip()
        if action_type
        else ""
    )

    if normalized_action_type:
        filters.append(
            AuditLog.action_type
            == normalized_action_type
        )

    if actor_account_id is not None:
        filters.append(
            AuditLog.actor_account_id
            == actor_account_id
        )

    if ticket_id is not None:
        filters.append(
            AuditLog.ticket_id
            == ticket_id
        )

    if start_date is not None:
        filters.append(
            AuditLog.created_at
            >= start_date
        )

    if end_date is not None:
        filters.append(
            AuditLog.created_at
            <= end_date
        )

    count_query = select(
        func.count(
            AuditLog.audit_log_id
        )
    )

    if filters:
        count_query = (
            count_query.where(
                *filters
            )
        )

    total = int(
        db.scalar(
            count_query
        )
        or 0
    )

    total_pages = max(
        1,
        (
            total
            + page_size
            - 1
        )
        // page_size,
    )

    offset = (
        page - 1
    ) * page_size

    logs_query = (
        select(AuditLog)
        .order_by(
            AuditLog.created_at.desc(),
            AuditLog.audit_log_id.desc(),
        )
        .offset(offset)
        .limit(page_size)
    )

    if filters:
        logs_query = (
            logs_query.where(
                *filters
            )
        )

    audit_logs = db.scalars(
        logs_query
    ).all()

    return AuditLogPageResponse(
        items=list(audit_logs),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
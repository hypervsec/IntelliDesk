from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..models import Account
from ..notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
)
from ..routers.auth import get_current_account
from ..schemas import MessageResponse


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


# =========================================================
# BİLDİRİMLERİ LİSTELE
# =========================================================

@router.get(
    "",
    response_model=NotificationListResponse,
)
def list_notifications(
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    notifications = db.scalars(
        select(models.Notification)
        .where(
            models.Notification.account_id
            == current_account.account_id
        )
        .order_by(
            models.Notification.created_at.desc(),
            models.Notification.notification_id.desc(),
        )
        .limit(limit)
    ).all()

    unread_count = db.scalar(
        select(
            func.count(
                models.Notification.notification_id
            )
        ).where(
            models.Notification.account_id
            == current_account.account_id,
            models.Notification.is_read.is_(False),
        )
    )

    return NotificationListResponse(
        notifications=[
            NotificationResponse.model_validate(
                notification
            )
            for notification in notifications
        ],
        unread_count=int(unread_count or 0),
    )


# =========================================================
# TÜM BİLDİRİMLERİ OKUNDU YAP
# =========================================================

@router.patch(
    "/read-all",
    response_model=MessageResponse,
)
def mark_all_notifications_as_read(
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> MessageResponse:
    unread_notifications = db.scalars(
        select(models.Notification).where(
            models.Notification.account_id
            == current_account.account_id,
            models.Notification.is_read.is_(False),
        )
    ).all()

    if not unread_notifications:
        return MessageResponse(
            message=(
                "Okunmamış bildirim bulunmamaktadır."
            )
        )

    read_time = datetime.now()

    for notification in unread_notifications:
        notification.is_read = True
        notification.read_at = read_time

    db.commit()

    return MessageResponse(
        message=(
            f"{len(unread_notifications)} bildirim "
            "okundu olarak işaretlendi."
        )
    )


# =========================================================
# TEK BİLDİRİMİ OKUNDU YAP
# =========================================================

@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_as_read(
    notification_id: int,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(get_db),
) -> models.Notification:
    notification = db.scalar(
        select(models.Notification).where(
            models.Notification.notification_id
            == notification_id,
            models.Notification.account_id
            == current_account.account_id,
        )
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bildirim bulunamadı.",
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now()

        db.commit()
        db.refresh(notification)

    return notification
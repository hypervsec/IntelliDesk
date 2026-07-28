import asyncio
import os
from collections.abc import (
    AsyncGenerator,
)
from contextlib import (
    asynccontextmanager,
    suppress,
)
from pathlib import Path

from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    status,
)
from fastapi.middleware.cors import (
    CORSMiddleware,
)
from sqlalchemy import (
    and_,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from .ai import attachments_router as ai_attachments_router
from .ai import router as ai_router
from .ai.models import AISession
from .audit import events as audit_events  # noqa: F401
from .audit.failures import (
    record_failed_request_audit,
)
from .database import get_db
from .models import (
    Account,
    Ticket,
    TicketTimelineEntry,
)
from .notifications import events as notification_events  # noqa: F401
from .request_context import (
    reset_request_actor,
    reset_request_metadata,
    set_request_actor,
    set_request_metadata,
)
from .routers import account_password
from .routers import assigned_tickets
from .routers import audit_logs
from .routers import auth
from .routers import notifications
from .routers import ticket_attachments
from .routers import ticket_pagination
from .routers import ticket_timeline
from .routers import tickets
from .routers.auth import (
    get_current_account,
)
from .sla.alerts import (
    run_sla_alert_loop,
)
from .timeline import events as timeline_events  # noqa: F401


# =========================================================
# ORTAM DEĞİŞKENLERİ
# =========================================================

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

load_dotenv(ENV_PATH)


DEFAULT_CORS_ALLOWED_ORIGINS = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173"
)


def get_cors_allowed_origins() -> list[str]:
    raw_origins = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        DEFAULT_CORS_ALLOWED_ORIGINS,
    )

    normalized_origins: list[str] = []

    for raw_origin in raw_origins.split(","):
        origin = raw_origin.strip().rstrip("/")

        if not origin:
            continue

        if origin == "*":
            raise RuntimeError(
                "CORS_ALLOWED_ORIGINS içinde '*' "
                "kullanılamaz. İzin verilen frontend "
                "adreslerini açıkça belirt."
            )

        if not origin.startswith(
            (
                "http://",
                "https://",
            )
        ):
            raise RuntimeError(
                "CORS origin değeri http:// veya "
                "https:// ile başlamalıdır: "
                f"{origin}"
            )

        if origin not in normalized_origins:
            normalized_origins.append(origin)

    if not normalized_origins:
        raise RuntimeError(
            "CORS_ALLOWED_ORIGINS en az bir "
            "geçerli adres içermelidir."
        )

    return normalized_origins


CORS_ALLOWED_ORIGINS = (
    get_cors_allowed_origins()
)


STAFF_ROLES = {
    "technician",
    "admin",
}


# =========================================================
# UYGULAMA YAŞAM DÖNGÜSÜ
# =========================================================

@asynccontextmanager
async def lifespan(
    _app: FastAPI,
):
    sla_alert_task = asyncio.create_task(
        run_sla_alert_loop(
            interval_seconds=60,
        )
    )

    try:
        yield

    finally:
        sla_alert_task.cancel()

        with suppress(
            asyncio.CancelledError
        ):
            await sla_alert_task


app = FastAPI(
    title="IntelliDesk API",
    description=(
        "Yapay zekâ destekli "
        "Service Desk sistemi"
    ),
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST BİLGİLERİ
# =========================================================

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


@app.middleware("http")
async def attach_request_metadata(
    request: Request,
    call_next,
):
    metadata_token = (
        set_request_metadata(
            ip_address=get_request_ip(
                request
            ),
            http_method=(
                request.method.upper()
            ),
            request_path=(
                request.url.path
            ),
        )
    )

    try:
        response = await call_next(
            request
        )

        record_failed_request_audit(
            request,
            response.status_code,
        )

        return response

    finally:
        reset_request_metadata(
            metadata_token
        )


# =========================================================
# TICKET YETKİ VE İŞLEM BAĞLAMI
# =========================================================

def extract_ticket_id_from_path(
    request_path: str,
) -> int | None:
    path_parts = [
        part
        for part in request_path.strip("/").split("/")
        if part
    ]

    if (
        len(path_parts) < 2
        or path_parts[0] != "tickets"
    ):
        return None

    try:
        return int(
            path_parts[1]
        )
    except ValueError:
        return None


def build_accessible_ticket_query(
    ticket_id: int,
    current_account: Account,
):
    owned_ai_session = (
        select(
            AISession.session_id
        )
        .where(
            AISession.ticket_id
            == Ticket.ticket_id,
            AISession.account_id
            == current_account.account_id,
        )
        .correlate(Ticket)
        .exists()
    )

    linked_ai_session = (
        select(
            AISession.session_id
        )
        .where(
            AISession.ticket_id
            == Ticket.ticket_id
        )
        .correlate(Ticket)
        .exists()
    )

    created_by_current_account = (
        select(
            TicketTimelineEntry.entry_id
        )
        .where(
            TicketTimelineEntry.ticket_id
            == Ticket.ticket_id,
            TicketTimelineEntry.entry_type
            == "ticket_created",
            TicketTimelineEntry.actor_account_id
            == current_account.account_id,
        )
        .correlate(Ticket)
        .exists()
    )

    created_by_known_account = (
        select(
            TicketTimelineEntry.entry_id
        )
        .where(
            TicketTimelineEntry.ticket_id
            == Ticket.ticket_id,
            TicketTimelineEntry.entry_type
            == "ticket_created",
            TicketTimelineEntry.actor_account_id.is_not(
                None
            ),
        )
        .correlate(Ticket)
        .exists()
    )

    normalized_account_name = " ".join(
        current_account.full_name
        .strip()
        .split()
    ).lower()

    legacy_requester_match = and_(
        ~linked_ai_session,
        ~created_by_known_account,
        func.lower(
            func.trim(
                Ticket.requester_name
            )
        )
        == normalized_account_name,
    )

    return select(
        Ticket.ticket_id
    ).where(
        Ticket.ticket_id == ticket_id,
        or_(
            owned_ai_session,
            created_by_current_account,
            legacy_requester_match,
        ),
    )


async def authorize_ticket_access(
    request: Request,
    current_account: Account = Depends(
        get_current_account
    ),
    db: Session = Depends(
        get_db
    ),
) -> AsyncGenerator[
    Account,
    None,
]:
    request_path = (
        request.url.path.rstrip("/")
        or "/"
    )

    ticket_id = extract_ticket_id_from_path(
        request_path
    )

    if (
        ticket_id is not None
        and current_account.role
        not in STAFF_ROLES
    ):
        accessible_ticket_id = db.scalar(
            build_accessible_ticket_query(
                ticket_id=ticket_id,
                current_account=current_account,
            )
        )

        if accessible_ticket_id is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_404_NOT_FOUND
                ),
                detail="Ticket bulunamadı.",
            )

    actor_token = set_request_actor(
        account_id=(
            current_account.account_id
        ),
        name=(
            current_account.full_name
        ),
        role=current_account.role,
    )

    try:
        yield current_account

    finally:
        reset_request_actor(
            actor_token
        )


def authorize_ticket_request(
    request: Request,
    current_account: Account = Depends(
        authorize_ticket_access
    ),
) -> Account:
    request_method = (
        request.method.upper()
    )

    request_path = (
        request.url.path.rstrip("/")
        or "/"
    )

    request_is_allowed = (
        current_account.role
        in STAFF_ROLES
        or (
            request_method == "GET"
            and request_path != "/tickets"
        )
        or (
            request_method == "POST"
            and request_path == "/tickets"
        )
    )

    if not request_is_allowed:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Bu işlem için teknisyen "
                "veya yönetici yetkisi "
                "gereklidir."
            ),
        )

    return current_account


# =========================================================
# ROUTERLAR
# =========================================================

app.include_router(
    auth.router
)


app.include_router(
    account_password.router
)


app.include_router(
    ai_router.router
)


app.include_router(
    ai_attachments_router.router
)


app.include_router(
    ticket_pagination.router,
    dependencies=[
        Depends(
            get_current_account
        ),
    ],
)


app.include_router(
    assigned_tickets.router
)


app.include_router(
    notifications.router
)


app.include_router(
    audit_logs.router
)


app.include_router(
    ticket_timeline.router,
    dependencies=[
        Depends(
            authorize_ticket_access
        ),
    ],
)


app.include_router(
    ticket_attachments.router,
    dependencies=[
        Depends(
            authorize_ticket_access
        ),
    ],
)


app.include_router(
    tickets.router,
    dependencies=[
        Depends(
            authorize_ticket_request
        ),
    ],
)


# =========================================================
# GENEL ENDPOINTLER
# =========================================================

@app.get("/")
def root():
    return {
        "message": (
            "IntelliDesk API çalışıyor."
        )
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }
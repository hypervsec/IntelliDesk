import asyncio
from collections.abc import (
    AsyncGenerator,
)
from contextlib import (
    asynccontextmanager,
    suppress,
)

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

from .audit import events as audit_events  # noqa: F401
from .notifications import events as notification_events  # noqa: F401
from .timeline import events as timeline_events  # noqa: F401
from .models import Account
from .request_context import (
    reset_request_actor,
    reset_request_metadata,
    set_request_actor,
    set_request_metadata,
)
from .routers import assigned_tickets
from .routers import audit_logs
from .routers import auth
from .routers import notifications
from .routers import ticket_pagination
from .routers import ticket_timeline
from .routers import tickets
from .routers.auth import (
    get_current_account,
)
from .sla.alerts import (
    run_sla_alert_loop,
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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

        return response
    finally:
        reset_request_metadata(
            metadata_token
        )


# =========================================================
# TICKET YETKİ VE İŞLEM BAĞLAMI
# =========================================================

async def authorize_ticket_request(
    request: Request,
    current_account: Account = Depends(
        get_current_account
    ),
) -> AsyncGenerator[
    Account,
    None,
]:
    request_method = (
        request.method.upper()
    )

    request_path = (
        request.url.path.rstrip("/")
        or "/"
    )

    request_is_allowed = (
        request_method == "GET"
        or (
            request_method == "POST"
            and request_path == "/tickets"
        )
        or current_account.role
        in STAFF_ROLES
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


# =========================================================
# ROUTERLAR
# =========================================================

app.include_router(
    auth.router
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
    ticket_timeline.router
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
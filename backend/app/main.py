import asyncio
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

from . import notification_events  # noqa: F401
from .models import Account
from .routers import assigned_tickets
from .routers import auth
from .routers import notifications
from .routers import ticket_pagination
from .routers import tickets
from .routers.auth import (
    get_current_account,
)
from .sla_alerts import (
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
# TICKET YETKİ KONTROLÜ
# =========================================================

def authorize_ticket_request(
    request: Request,
    current_account: Account = Depends(
        get_current_account
    ),
) -> Account:
    """
    Ticket endpointlerinde rol kontrolü yapar.

    Tüm giriş yapan kullanıcılar:
    - Ticketları görüntüleyebilir.
    - Yeni ticket oluşturabilir.

    Yalnızca teknisyen ve yöneticiler:
    - Ticket güncelleyebilir.
    - Benzer ticket araması yapabilir.
    - AI önerisi oluşturabilir.
    - AI önerisine geri bildirim verebilir.
    """

    request_method = (
        request.method.upper()
    )

    request_path = (
        request.url.path.rstrip("/")
        or "/"
    )

    if request_method == "GET":
        return current_account

    if (
        request_method == "POST"
        and request_path == "/tickets"
    ):
        return current_account

    if (
        current_account.role
        not in STAFF_ROLES
    ):
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
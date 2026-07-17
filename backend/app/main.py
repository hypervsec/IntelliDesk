from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    status,
)
from fastapi.middleware.cors import CORSMiddleware

from .models import Account
from .routers import auth
from .routers import ticket_pagination
from .routers import tickets
from .routers.auth import get_current_account


STAFF_ROLES = {
    "technician",
    "admin",
}


app = FastAPI(
    title="IntelliDesk API",
    description=(
        "Yapay zekâ destekli Service Desk sistemi"
    ),
    version="1.0.0",
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

    request_method = request.method.upper()

    request_path = (
        request.url.path.rstrip("/")
        or "/"
    )

    # Tüm GET işlemleri giriş yapmış
    # kullanıcılara açıktır.
    if request_method == "GET":
        return current_account

    # Yeni ticket oluşturma tüm giriş
    # yapmış kullanıcılara açıktır.
    if (
        request_method == "POST"
        and request_path == "/tickets"
    ):
        return current_account

    # Diğer yazma işlemleri yalnızca
    # teknisyen ve yönetici içindir.
    if current_account.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Bu işlem için teknisyen veya "
                "yönetici yetkisi gereklidir."
            ),
        )

    return current_account


# =========================================================
# ROUTERLAR
# =========================================================

# Register ve login işlemleri herkese açıktır.
# /auth/me kendi token kontrolünü yapar.
app.include_router(
    auth.router
)


# Sayfalama, filtre ve form seçeneklerinin
# tamamı giriş yapmış kullanıcılar içindir.
app.include_router(
    ticket_pagination.router,
    dependencies=[
        Depends(get_current_account),
    ],
)


# Ticket işlemlerinde istek türüne ve
# kullanıcı rolüne göre yetki kontrolü yapılır.
app.include_router(
    tickets.router,
    dependencies=[
        Depends(authorize_ticket_request),
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
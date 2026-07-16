from fastapi import FastAPI

from .routers import tickets
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="IntelliDesk API",
    description="Yapay zekâ destekli Service Desk sistemi",
    version="1.0.0",
)

app.include_router(tickets.router)


@app.get("/")
def root():
    return {
        "message": "IntelliDesk API çalışıyor."
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }

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

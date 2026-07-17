from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


# =========================================================
# ORTAK TİPLER
# =========================================================

PriorityType = Literal[
    "low",
    "medium",
    "high",
    "critical",
]

StatusType = Literal[
    "open",
    "assigned",
    "in_progress",
    "waiting_user",
    "resolved",
    "closed",
    "cancelled",
]

FeedbackType = Literal[
    "accepted",
    "rejected",
]

AccountRoleType = Literal[
    "admin",
    "technician",
    "user",
]


# =========================================================
# AUTH / ACCOUNT ŞEMALARI
# =========================================================

class AccountRegister(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=150,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    password_confirm: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized_value = " ".join(value.strip().split())

        if len(normalized_value) < 2:
            raise ValueError(
                "Ad soyad en az 2 karakter olmalıdır."
            )

        return normalized_value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(character.islower() for character in value):
            raise ValueError(
                "Parola en az bir küçük harf içermelidir."
            )

        if not any(character.isupper() for character in value):
            raise ValueError(
                "Parola en az bir büyük harf içermelidir."
            )

        if not any(character.isdigit() for character in value):
            raise ValueError(
                "Parola en az bir rakam içermelidir."
            )

        return value

    @model_validator(mode="after")
    def validate_password_confirmation(
        self,
    ) -> "AccountRegister":
        if self.password != self.password_confirm:
            raise ValueError(
                "Parola ve parola tekrarı eşleşmiyor."
            )

        return self


class AccountLogin(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class AccountResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    account_id: int
    full_name: str
    email: EmailStr
    role: AccountRoleType
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    account: AccountResponse


class MessageResponse(BaseModel):
    message: str


# =========================================================
# TICKET ŞEMALARI
# =========================================================

class TicketCreate(BaseModel):
    title: str = Field(
        min_length=3,
        max_length=500,
    )

    description: str = Field(
        min_length=3,
    )

    requester_name: str | None = Field(
        default=None,
        max_length=150,
    )

    department: str | None = Field(
        default=None,
        max_length=150,
    )

    category: str | None = Field(
        default=None,
        max_length=150,
    )

    subcategory: str | None = Field(
        default=None,
        max_length=150,
    )

    priority: PriorityType = "medium"


class TicketResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    ticket_id: int
    title: str
    description: str

    requester_name: str | None
    department: str | None

    category: str | None
    subcategory: str | None

    priority: PriorityType
    status: StatusType

    assigned_technician: str | None
    resolution: str | None

    ai_recommendation: str | None
    ai_confidence_score: Decimal | None

    ai_feedback: str | None
    ai_feedback_note: str | None
    ai_feedback_at: datetime | None

    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None


class TicketUpdate(BaseModel):
    status: StatusType | None = None

    assigned_technician: str | None = Field(
        default=None,
        max_length=150,
    )

    department: str | None = Field(
        default=None,
        max_length=150,
    )

    category: str | None = Field(
        default=None,
        max_length=150,
    )

    subcategory: str | None = Field(
        default=None,
        max_length=150,
    )

    priority: PriorityType | None = None

    resolution: str | None = None


class SimilarTicketResponse(BaseModel):
    request_id: str
    category: str | None
    subcategory: str | None
    subject: str | None
    description: str | None
    resolution: str | None
    similarity: float


class RecommendationResponse(BaseModel):
    ticket_id: int
    recommendation: str
    confidence_score: float
    source_request_ids: list[str]


class TicketFeedbackCreate(BaseModel):
    feedback: FeedbackType

    note: str | None = Field(
        default=None,
        max_length=1000,
    )


class TicketFeedbackResponse(BaseModel):
    ticket_id: int
    feedback: FeedbackType
    note: str | None
    feedback_at: datetime


class FeedbackStatsResponse(BaseModel):
    total_feedback: int
    accepted_count: int
    rejected_count: int
    acceptance_rate: float


# =========================================================
# DASHBOARD ŞEMALARI
# =========================================================

class DashboardSummaryResponse(BaseModel):
    total_tickets: int
    open_tickets: int
    resolved_tickets: int
    closed_tickets: int
    ai_recommendation_count: int
    average_ai_confidence: float


class CategoryStatsItem(BaseModel):
    category: str
    ticket_count: int


class StatusStatsItem(BaseModel):
    status: str
    ticket_count: int


class PriorityStatsItem(BaseModel):
    priority: str
    ticket_count: int


class DailyTicketStatsItem(BaseModel):
    date: str
    ticket_count: int


class DepartmentStatsItem(BaseModel):
    department: str
    ticket_count: int
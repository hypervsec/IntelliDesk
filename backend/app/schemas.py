from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from .sla import (
    calculate_remaining_minutes,
    calculate_sla_status,
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

SLAStatusType = Literal[
    "on_track",
    "approaching",
    "breached",
    "met",
    "not_set",
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
    def normalize_full_name(
        cls,
        value: str,
    ) -> str:
        normalized_value = " ".join(
            value.strip().split()
        )

        if len(normalized_value) < 2:
            raise ValueError(
                "Ad soyad en az 2 karakter olmalıdır."
            )

        return normalized_value

    @field_validator("email")
    @classmethod
    def normalize_email(
        cls,
        value: EmailStr,
    ) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(
        cls,
        value: str,
    ) -> str:
        if not any(
            character.islower()
            for character in value
        ):
            raise ValueError(
                "Parola en az bir küçük harf içermelidir."
            )

        if not any(
            character.isupper()
            for character in value
        ):
            raise ValueError(
                "Parola en az bir büyük harf içermelidir."
            )

        if not any(
            character.isdigit()
            for character in value
        ):
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
    def normalize_email(
        cls,
        value: EmailStr,
    ) -> str:
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


class AccountAdminUpdate(BaseModel):
    role: AccountRoleType | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_update_fields(
        self,
    ) -> "AccountAdminUpdate":
        if (
            self.role is None
            and self.is_active is None
        ):
            raise ValueError(
                "Rol veya aktiflik alanlarından "
                "en az biri gönderilmelidir."
            )

        return self


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

    sla_started_at: datetime | None
    first_response_due_at: datetime | None
    resolution_due_at: datetime | None
    first_responded_at: datetime | None

    updated_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None

    @computed_field
    @property
    def first_response_sla_status(
        self,
    ) -> SLAStatusType:
        if (
            self.sla_started_at is None
            or self.first_response_due_at is None
        ):
            return "not_set"

        return calculate_sla_status(
            started_at=self.sla_started_at,
            due_at=self.first_response_due_at,
            completed_at=self.first_responded_at,
        )

    @computed_field
    @property
    def resolution_sla_status(
        self,
    ) -> SLAStatusType:
        if (
            self.sla_started_at is None
            or self.resolution_due_at is None
        ):
            return "not_set"

        completed_at = (
            self.resolved_at
            or self.closed_at
        )

        return calculate_sla_status(
            started_at=self.sla_started_at,
            due_at=self.resolution_due_at,
            completed_at=completed_at,
        )

    @computed_field
    @property
    def first_response_remaining_minutes(
        self,
    ) -> int | None:
        if (
            self.sla_started_at is None
            or self.first_response_due_at is None
        ):
            return None

        if self.first_responded_at is not None:
            return 0

        return calculate_remaining_minutes(
            due_at=self.first_response_due_at,
        )

    @computed_field
    @property
    def resolution_remaining_minutes(
        self,
    ) -> int | None:
        if (
            self.sla_started_at is None
            or self.resolution_due_at is None
        ):
            return None

        if (
            self.resolved_at is not None
            or self.closed_at is not None
        ):
            return 0

        return calculate_remaining_minutes(
            due_at=self.resolution_due_at,
        )


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
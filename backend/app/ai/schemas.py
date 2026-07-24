from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


AIPriorityType = Literal[
    "low",
    "medium",
    "high",
    "critical",
]

AISessionStatusType = Literal[
    "pending",
    "processing",
    "completed",
    "failed",
]

AIResolutionStatusType = Literal[
    "resolved",
    "unresolved",
]

AIMessageSenderType = Literal[
    "user",
    "assistant",
    "system",
]

AIConfidenceBandType = Literal[
    "high",
    "medium",
    "low",
]


# =========================================================
# AI OTURUM ŞEMALARI
# =========================================================

class AISessionCreate(BaseModel):
    title: str = Field(
        min_length=3,
        max_length=500,
    )

    description: str = Field(
        min_length=3,
        max_length=10000,
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

    priority: AIPriorityType = "medium"


class AIMessageResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    message_id: int
    session_id: int
    sender_type: AIMessageSenderType
    content: str
    created_at: datetime


class AISessionResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    session_id: int
    account_id: int
    ticket_id: int | None

    title: str

    department: str | None
    category: str | None
    subcategory: str | None

    priority: AIPriorityType
    status: AISessionStatusType

    confidence_score: Decimal | None
    resolution_status: AIResolutionStatusType | None

    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class AISessionDetailResponse(
    AISessionResponse
):
    messages: list[AIMessageResponse] = Field(
        default_factory=list,
    )


class AIResolutionUpdate(BaseModel):
    resolution_status: AIResolutionStatusType


# =========================================================
# AI ANALYTICS ŞEMALARI
# =========================================================

class AIConfidenceBandPerformance(BaseModel):
    band: AIConfidenceBandType
    label: str

    feedback_count: int

    resolved_count: int
    unresolved_count: int

    success_rate: float | None


class AIAnalyticsSummaryResponse(BaseModel):
    total_sessions: int

    completed_sessions: int
    failed_sessions: int

    resolved_count: int
    unresolved_count: int
    awaiting_feedback_count: int

    success_rate: float | None

    average_confidence_score: float | None
    average_solution_time_seconds: float | None

    source_supported_sessions: int
    source_supported_feedback_count: int

    source_supported_resolved_count: int
    source_supported_unresolved_count: int

    source_supported_success_rate: float | None

    high_confidence_unresolved_count: int

    confidence_bands: list[
        AIConfidenceBandPerformance
    ] = Field(
        default_factory=list,
    )
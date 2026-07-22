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
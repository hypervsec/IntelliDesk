from datetime import datetime, timedelta
from typing import Literal, TypedDict


SLAStatus = Literal[
    "on_track",
    "approaching",
    "breached",
    "met",
]


class SLAPolicy(TypedDict):
    first_response_minutes: int
    resolution_minutes: int


SLA_POLICIES: dict[str, SLAPolicy] = {
    "critical": {
        "first_response_minutes": 15,
        "resolution_minutes": 240,
    },
    "high": {
        "first_response_minutes": 30,
        "resolution_minutes": 480,
    },
    "medium": {
        "first_response_minutes": 120,
        "resolution_minutes": 1440,
    },
    "low": {
        "first_response_minutes": 240,
        "resolution_minutes": 2880,
    },
}


def normalize_priority(
    priority: str | None,
) -> str:
    if priority is None:
        return "medium"

    normalized_priority = priority.strip().lower()

    if normalized_priority not in SLA_POLICIES:
        return "medium"

    return normalized_priority


def get_sla_policy(
    priority: str | None,
) -> SLAPolicy:
    normalized_priority = normalize_priority(
        priority
    )

    return SLA_POLICIES[normalized_priority]


def calculate_sla_deadlines(
    created_at: datetime,
    priority: str | None,
) -> tuple[datetime, datetime]:
    policy = get_sla_policy(priority)

    first_response_due_at = (
        created_at
        + timedelta(
            minutes=policy[
                "first_response_minutes"
            ]
        )
    )

    resolution_due_at = (
        created_at
        + timedelta(
            minutes=policy[
                "resolution_minutes"
            ]
        )
    )

    return (
        first_response_due_at,
        resolution_due_at,
    )


def calculate_sla_status(
    started_at: datetime,
    due_at: datetime,
    completed_at: datetime | None = None,
    now: datetime | None = None,
) -> SLAStatus:
    reference_time = (
        completed_at
        or now
        or datetime.now()
    )

    if completed_at is not None:
        if completed_at <= due_at:
            return "met"

        return "breached"

    if reference_time >= due_at:
        return "breached"

    total_duration = (
        due_at - started_at
    ).total_seconds()

    remaining_duration = (
        due_at - reference_time
    ).total_seconds()

    if total_duration <= 0:
        return "breached"

    remaining_ratio = (
        remaining_duration
        / total_duration
    )

    if remaining_ratio <= 0.25:
        return "approaching"

    return "on_track"


def calculate_remaining_minutes(
    due_at: datetime,
    now: datetime | None = None,
) -> int:
    reference_time = now or datetime.now()

    remaining_seconds = (
        due_at - reference_time
    ).total_seconds()

    return int(
        remaining_seconds // 60
    )
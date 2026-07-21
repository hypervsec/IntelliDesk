from contextvars import (
    ContextVar,
    Token,
)
from dataclasses import dataclass


@dataclass(
    frozen=True,
    slots=True,
)
class RequestActor:
    account_id: int
    name: str
    role: str | None


@dataclass(
    frozen=True,
    slots=True,
)
class RequestMetadata:
    ip_address: str | None
    http_method: str | None
    request_path: str | None


_current_actor: ContextVar[
    RequestActor | None
] = ContextVar(
    "intellidesk_current_actor",
    default=None,
)


_current_request_metadata: ContextVar[
    RequestMetadata | None
] = ContextVar(
    "intellidesk_request_metadata",
    default=None,
)


def set_request_actor(
    account_id: int,
    name: str,
    role: str | None,
) -> Token[RequestActor | None]:
    actor = RequestActor(
        account_id=account_id,
        name=name,
        role=role,
    )

    return _current_actor.set(actor)


def get_request_actor() -> (
    RequestActor | None
):
    return _current_actor.get()


def reset_request_actor(
    token: Token[
        RequestActor | None
    ],
) -> None:
    _current_actor.reset(token)


def set_request_metadata(
    ip_address: str | None,
    http_method: str | None,
    request_path: str | None,
) -> Token[RequestMetadata | None]:
    metadata = RequestMetadata(
        ip_address=ip_address,
        http_method=http_method,
        request_path=request_path,
    )

    return _current_request_metadata.set(
        metadata
    )


def get_request_metadata() -> (
    RequestMetadata | None
):
    return _current_request_metadata.get()


def reset_request_metadata(
    token: Token[
        RequestMetadata | None
    ],
) -> None:
    _current_request_metadata.reset(
        token
    )
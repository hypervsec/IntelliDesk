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


_current_actor: ContextVar[
    RequestActor | None
] = ContextVar(
    "intellidesk_current_actor",
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
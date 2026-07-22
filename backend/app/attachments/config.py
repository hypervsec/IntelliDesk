import os
from pathlib import Path

from dotenv import load_dotenv


ATTACHMENTS_DIR = Path(__file__).resolve().parent
APP_DIR = ATTACHMENTS_DIR.parent
BACKEND_DIR = APP_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

load_dotenv(ENV_PATH)


def get_positive_integer(
    environment_name: str,
    default_value: int,
) -> int:
    raw_value = os.getenv(
        environment_name,
        str(default_value),
    )

    try:
        parsed_value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(
            f"{environment_name} pozitif bir tam sayı olmalıdır."
        ) from error

    if parsed_value <= 0:
        raise RuntimeError(
            f"{environment_name} sıfırdan büyük olmalıdır."
        )

    return parsed_value


upload_root_value = os.getenv(
    "UPLOAD_ROOT",
    "uploads",
).strip()

if not upload_root_value:
    upload_root_value = "uploads"

configured_upload_root = Path(
    upload_root_value
).expanduser()

if configured_upload_root.is_absolute():
    UPLOAD_ROOT = configured_upload_root.resolve()
else:
    UPLOAD_ROOT = (
        BACKEND_DIR
        / configured_upload_root
    ).resolve()


MAX_ATTACHMENT_SIZE_MB = get_positive_integer(
    "MAX_ATTACHMENT_SIZE_MB",
    10,
)

MAX_ATTACHMENT_SIZE_BYTES = (
    MAX_ATTACHMENT_SIZE_MB
    * 1024
    * 1024
)

TICKET_UPLOAD_ROOT = (
    UPLOAD_ROOT
    / "tickets"
)

UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024
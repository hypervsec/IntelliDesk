import hashlib
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from ..attachments.config import (
    MAX_ATTACHMENT_SIZE_BYTES,
    MAX_ATTACHMENT_SIZE_MB,
    UPLOAD_CHUNK_SIZE_BYTES,
    UPLOAD_ROOT,
    get_positive_integer,
)
from ..attachments.storage import (
    CANONICAL_CONTENT_TYPES,
    StoredAttachment,
    normalize_original_filename,
    remove_empty_ticket_directory,
    validate_file_header,
)


AI_IMAGE_EXTENSIONS = frozenset({
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
})

AI_SESSION_UPLOAD_ROOT = (
    UPLOAD_ROOT
    / "ai_sessions"
)

MAX_AI_SESSION_ATTACHMENTS = get_positive_integer(
    "MAX_AI_SESSION_ATTACHMENTS",
    3,
)


def validate_ai_image_extension(
    raw_filename: str | None,
) -> None:
    if not raw_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dosya adı bulunamadı.",
        )

    filename_without_path = (
        raw_filename
        .replace("\\", "/")
        .rsplit("/", maxsplit=1)[-1]
    )

    file_extension = (
        Path(filename_without_path)
        .suffix
        .lower()
    )

    if file_extension in AI_IMAGE_EXTENSIONS:
        return

    allowed_extensions_text = ", ".join(
        sorted(AI_IMAGE_EXTENSIONS)
    )

    raise HTTPException(
        status_code=(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        ),
        detail=(
            "AI çözüm asistanına yalnızca görsel "
            "yüklenebilir. Desteklenen uzantılar: "
            f"{allowed_extensions_text}"
        ),
    )


async def save_ai_session_attachment(
    session_id: int,
    upload_file: UploadFile,
) -> StoredAttachment:
    absolute_path: Path | None = None
    session_directory: Path | None = None

    try:
        validate_ai_image_extension(
            upload_file.filename
        )

        (
            original_filename,
            file_extension,
        ) = normalize_original_filename(
            upload_file.filename
        )

        session_directory = (
            AI_SESSION_UPLOAD_ROOT
            / str(session_id)
        ).resolve()

        try:
            session_directory.relative_to(
                UPLOAD_ROOT
            )
        except ValueError as error:
            raise HTTPException(
                status_code=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
                detail=(
                    "AI görsel depolama yolu "
                    "oluşturulamadı."
                ),
            ) from error

        session_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        stored_filename = (
            f"{uuid4().hex}{file_extension}"
        )

        absolute_path = (
            session_directory
            / stored_filename
        ).resolve()

        total_size = 0
        sha256_hasher = hashlib.sha256()
        header = bytearray()

        with absolute_path.open("wb") as output_file:
            while True:
                chunk = await upload_file.read(
                    UPLOAD_CHUNK_SIZE_BYTES
                )

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_ATTACHMENT_SIZE_BYTES:
                    raise HTTPException(
                        status_code=(
                            status
                            .HTTP_413_REQUEST_ENTITY_TOO_LARGE
                        ),
                        detail=(
                            "Görsel boyutu en fazla "
                            f"{MAX_ATTACHMENT_SIZE_MB} "
                            "MB olabilir."
                        ),
                    )

                if len(header) < 16:
                    header.extend(
                        chunk[
                            : 16 - len(header)
                        ]
                    )

                sha256_hasher.update(chunk)
                output_file.write(chunk)

        if total_size <= 0:
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail="Boş görsel yüklenemez.",
            )

        validate_file_header(
            file_extension,
            bytes(header),
        )

        storage_path = (
            absolute_path
            .relative_to(UPLOAD_ROOT)
            .as_posix()
        )

        return StoredAttachment(
            original_filename=original_filename,
            stored_filename=stored_filename,
            storage_path=storage_path,
            content_type=(
                CANONICAL_CONTENT_TYPES[
                    file_extension
                ]
            ),
            file_extension=file_extension,
            size_bytes=total_size,
            sha256=sha256_hasher.hexdigest(),
            absolute_path=absolute_path,
        )

    except Exception:
        if absolute_path is not None:
            absolute_path.unlink(
                missing_ok=True
            )

        if session_directory is not None:
            remove_empty_ticket_directory(
                session_directory
            )

        raise

    finally:
        await upload_file.close()
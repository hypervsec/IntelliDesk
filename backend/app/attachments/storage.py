import codecs
import hashlib
import unicodedata
from dataclasses import dataclass
from pathlib import (
    Path,
    PurePosixPath,
)
from uuid import uuid4

from fastapi import (
    HTTPException,
    UploadFile,
    status,
)

from .config import (
    MAX_ATTACHMENT_SIZE_BYTES,
    MAX_ATTACHMENT_SIZE_MB,
    TICKET_UPLOAD_ROOT,
    UPLOAD_CHUNK_SIZE_BYTES,
    UPLOAD_ROOT,
)


ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pdf",
    ".txt",
    ".log",
}

CANONICAL_CONTENT_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".log": "text/plain",
}

TEXT_EXTENSIONS = {
    ".txt",
    ".log",
}


@dataclass(
    frozen=True,
    slots=True,
)
class StoredAttachment:
    original_filename: str
    stored_filename: str
    storage_path: str
    content_type: str
    file_extension: str
    size_bytes: int
    sha256: str
    absolute_path: Path


def normalize_original_filename(
    raw_filename: str | None,
) -> tuple[str, str]:
    if not raw_filename:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail="Dosya adı bulunamadı.",
        )

    filename_without_path = (
        raw_filename
        .replace("\\", "/")
        .rsplit("/", maxsplit=1)[-1]
    )

    normalized_filename = unicodedata.normalize(
        "NFKC",
        filename_without_path,
    ).strip()

    normalized_filename = "".join(
        character
        for character in normalized_filename
        if character.isprintable()
    )

    if not normalized_filename:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail="Geçerli bir dosya adı bulunamadı.",
        )

    file_extension = (
        Path(normalized_filename)
        .suffix
        .lower()
    )

    if file_extension not in ALLOWED_EXTENSIONS:
        allowed_extensions_text = ", ".join(
            sorted(ALLOWED_EXTENSIONS)
        )

        raise HTTPException(
            status_code=(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            ),
            detail=(
                "Bu dosya türüne izin verilmiyor. "
                f"Desteklenen uzantılar: "
                f"{allowed_extensions_text}"
            ),
        )

    maximum_stem_length = (
        255
        - len(file_extension)
    )

    file_stem = (
        normalized_filename[
            : -len(file_extension)
        ]
        if file_extension
        else normalized_filename
    )

    file_stem = file_stem[
        :maximum_stem_length
    ].strip()

    if not file_stem:
        file_stem = "dosya"

    safe_original_filename = (
        f"{file_stem}{file_extension}"
    )

    return (
        safe_original_filename,
        file_extension,
    )


def validate_file_header(
    file_extension: str,
    header: bytes,
) -> None:
    is_valid = False

    if file_extension == ".png":
        is_valid = header.startswith(
            b"\x89PNG\r\n\x1a\n"
        )

    elif file_extension in {
        ".jpg",
        ".jpeg",
    }:
        is_valid = header.startswith(
            b"\xff\xd8\xff"
        )

    elif file_extension == ".webp":
        is_valid = (
            len(header) >= 12
            and header[:4] == b"RIFF"
            and header[8:12] == b"WEBP"
        )

    elif file_extension == ".pdf":
        is_valid = header.startswith(
            b"%PDF-"
        )

    elif file_extension in TEXT_EXTENSIONS:
        is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            ),
            detail=(
                "Dosya içeriği ile uzantısı "
                "birbiriyle uyuşmuyor."
            ),
        )


def resolve_storage_path(
    storage_path: str,
) -> Path:
    relative_path = PurePosixPath(
        storage_path
    )

    candidate_path = (
        UPLOAD_ROOT
        / Path(*relative_path.parts)
    ).resolve()

    try:
        candidate_path.relative_to(
            UPLOAD_ROOT
        )
    except ValueError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Dosya depolama yolu geçersiz."
            ),
        ) from error

    return candidate_path


async def save_ticket_attachment(
    ticket_id: int,
    upload_file: UploadFile,
) -> StoredAttachment:
    (
        original_filename,
        file_extension,
    ) = normalize_original_filename(
        upload_file.filename
    )

    stored_filename = (
        f"{uuid4().hex}{file_extension}"
    )

    ticket_directory = (
        TICKET_UPLOAD_ROOT
        / str(ticket_id)
    )

    ticket_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    absolute_path = (
        ticket_directory
        / stored_filename
    ).resolve()

    try:
        absolute_path.relative_to(
            UPLOAD_ROOT
        )
    except ValueError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Dosya depolama yolu oluşturulamadı."
            ),
        ) from error

    total_size = 0
    sha256_hasher = hashlib.sha256()
    header = bytearray()

    text_decoder = None

    if file_extension in TEXT_EXTENSIONS:
        text_decoder = codecs.getincrementaldecoder(
            "utf-8"
        )(
            errors="strict"
        )

    try:
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
                            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                        ),
                        detail=(
                            "Dosya boyutu en fazla "
                            f"{MAX_ATTACHMENT_SIZE_MB} MB olabilir."
                        ),
                    )

                if len(header) < 16:
                    remaining_header_length = (
                        16
                        - len(header)
                    )

                    header.extend(
                        chunk[
                            :remaining_header_length
                        ]
                    )

                if text_decoder is not None:
                    if b"\x00" in chunk:
                        raise HTTPException(
                            status_code=(
                                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
                            ),
                            detail=(
                                "TXT ve LOG dosyaları "
                                "metin içeriğinde olmalıdır."
                            ),
                        )

                    try:
                        text_decoder.decode(
                            chunk,
                            final=False,
                        )
                    except UnicodeDecodeError as error:
                        raise HTTPException(
                            status_code=(
                                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
                            ),
                            detail=(
                                "TXT ve LOG dosyaları "
                                "UTF-8 biçiminde olmalıdır."
                            ),
                        ) from error

                sha256_hasher.update(
                    chunk
                )

                output_file.write(
                    chunk
                )

        if total_size <= 0:
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail="Boş dosya yüklenemez.",
            )

        if text_decoder is not None:
            try:
                text_decoder.decode(
                    b"",
                    final=True,
                )
            except UnicodeDecodeError as error:
                raise HTTPException(
                    status_code=(
                        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
                    ),
                    detail=(
                        "TXT ve LOG dosyaları "
                        "UTF-8 biçiminde olmalıdır."
                    ),
                ) from error

        validate_file_header(
            file_extension,
            bytes(header),
        )

        relative_storage_path = (
            absolute_path
            .relative_to(UPLOAD_ROOT)
            .as_posix()
        )

        return StoredAttachment(
            original_filename=(
                original_filename
            ),
            stored_filename=(
                stored_filename
            ),
            storage_path=(
                relative_storage_path
            ),
            content_type=(
                CANONICAL_CONTENT_TYPES[
                    file_extension
                ]
            ),
            file_extension=(
                file_extension
            ),
            size_bytes=total_size,
            sha256=(
                sha256_hasher.hexdigest()
            ),
            absolute_path=absolute_path,
        )

    except Exception:
        absolute_path.unlink(
            missing_ok=True
        )

        remove_empty_ticket_directory(
            ticket_directory
        )

        raise

    finally:
        await upload_file.close()


def delete_stored_file(
    storage_path: str,
) -> None:
    absolute_path = resolve_storage_path(
        storage_path
    )

    absolute_path.unlink(
        missing_ok=True
    )

    remove_empty_ticket_directory(
        absolute_path.parent
    )


def remove_empty_ticket_directory(
    directory_path: Path,
) -> None:
    try:
        directory_path.rmdir()
    except OSError:
        pass
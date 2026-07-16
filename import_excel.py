from __future__ import annotations

import os
import tempfile
import zipfile
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL


# =========================================================
# DOSYA VE ORTAM AYARLARI
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / "backend" / ".env"

load_dotenv(ENV_PATH)

EXCEL_PATH = BASE_DIR / "ServiceDeskReport.xlsx"
REPAIRED_EXCEL_PATH = BASE_DIR / "ServiceDeskReport_repaired.xlsx"

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_NAME = os.getenv("DB_NAME", "Intellidesk")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")

IMPORT_BATCH = "servicedesk_initial_import"

if not DB_PASSWORD:
    raise RuntimeError(
        "DB_PASSWORD bulunamadı. "
        f"Lütfen {ENV_PATH} dosyasını kontrol et."
    )


# =========================================================
# EXCEL DOSYASININ HATALI BOYUT BİLGİSİNİ DÜZELT
# =========================================================

def repair_excel_dimension(
    source_path: Path,
    output_path: Path,
) -> None:
    """
    Excel dosyasındaki hatalı dimension bilgisini düzeltir.

    Orijinal dosyayı değiştirmez ve düzeltilmiş yeni bir
    Excel dosyası üretir.
    """

    if not source_path.exists():
        raise FileNotFoundError(
            f"Excel dosyası bulunamadı: {source_path}"
        )

    with tempfile.TemporaryDirectory() as temp_directory:
        temp_path = Path(temp_directory)

        with zipfile.ZipFile(source_path, "r") as source_zip:
            source_zip.extractall(temp_path)

        worksheet_path = (
            temp_path
            / "xl"
            / "worksheets"
            / "sheet1.xml"
        )

        if not worksheet_path.exists():
            raise FileNotFoundError(
                "Excel içinde "
                "xl/worksheets/sheet1.xml bulunamadı."
            )

        worksheet_xml = worksheet_path.read_text(
            encoding="utf-8"
        )

        worksheet_xml = worksheet_xml.replace(
            '<dimension ref="A1"/>',
            '<dimension ref="A1:AA5008"/>',
        )

        worksheet_path.write_text(
            worksheet_xml,
            encoding="utf-8",
        )

        with zipfile.ZipFile(
            output_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
        ) as output_zip:
            for file_path in temp_path.rglob("*"):
                if not file_path.is_file():
                    continue

                archive_name = file_path.relative_to(
                    temp_path
                )

                output_zip.write(
                    file_path,
                    archive_name,
                )

    print(
        "Düzeltilmiş Excel oluşturuldu: "
        f"{output_path}"
    )


# =========================================================
# EXCEL DOSYASINI OKU
# =========================================================

repair_excel_dimension(
    EXCEL_PATH,
    REPAIRED_EXCEL_PATH,
)

# Başlıklar Excel'in 8. satırında.
# Python'da satır sayımı sıfırdan başladığı için header=7.
#
# Veriler B sütunundan Z sütununa kadar bulunuyor.
df = pd.read_excel(
    REPAIRED_EXCEL_PATH,
    sheet_name="ManageEngine Report Framework",
    header=7,
    usecols="B:Z",
    engine="openpyxl",
)

# Sütunların başındaki ve sonundaki boşlukları kaldır.
df.columns = [
    str(column).strip()
    for column in df.columns
]

print("\nExcel'den okunan sütunlar:")

for column in df.columns:
    print(f"- {column}")

print(f"\nOkunan kayıt sayısı: {len(df)}")


# =========================================================
# SÜTUN İSİMLERİNİ POSTGRESQL İSİMLERİNE ÇEVİR
# =========================================================

column_mapping = {
    "Category": "category",
    "Request ID": "request_id",
    "Requester": "requester",
    "Department": "department",
    "Request Status": "request_status",
    "Subcategory": "subcategory",
    "Item": "item",
    "Priority": "priority",
    "Approval Status": "approval_status",
    "Pending Status": "pending_status",
    "Created Time": "created_time",
    "Subject": "subject",
    "Description": "description",
    "Resolution": "resolution",
    "Completed Time": "completed_time",
    "Resolved Time": "resolved_time",
    "Emergency": "emergency",
    "Group": "support_group",
    "Request Type": "request_type",
    "Service Category": "service_category",
    "Site": "site",
    "Lokasyon": "location",
    "Technician": "technician",
    "Urgency": "urgency",
    "Service Request": "service_request",
}

missing_columns = [
    original_column
    for original_column in column_mapping
    if original_column not in df.columns
]

if missing_columns:
    raise ValueError(
        "Excel dosyasında bulunamayan sütunlar: "
        + ", ".join(missing_columns)
    )

df = df.rename(columns=column_mapping)

required_columns = list(column_mapping.values())
df = df[required_columns]


# =========================================================
# VERİ TEMİZLEME
# =========================================================

# Tamamen boş satırları kaldır.
df = df.dropna(how="all")

# Request ID olmayan satırları kaldır.
df = df.dropna(subset=["request_id"])

# Request ID değerlerini temizle.
df["request_id"] = (
    df["request_id"]
    .astype(str)
    .str.strip()
    .str.replace(r"\.0$", "", regex=True)
)

text_columns = [
    "category",
    "requester",
    "department",
    "request_status",
    "subcategory",
    "item",
    "priority",
    "approval_status",
    "pending_status",
    "subject",
    "description",
    "resolution",
    "emergency",
    "support_group",
    "request_type",
    "service_category",
    "site",
    "location",
    "technician",
    "urgency",
    "service_request",
]

for column in text_columns:
    df[column] = df[column].apply(
        lambda value: (
            value.strip()
            if isinstance(value, str)
            else value
        )
    )

# Staging tablosundaki tarihler TEXT olduğu için
# tarihleri standart metin biçimine çevir.
date_columns = [
    "created_time",
    "completed_time",
    "resolved_time",
]

for column in date_columns:
    parsed_dates = pd.to_datetime(
        df[column],
        dayfirst=True,
        errors="coerce",
    )

    df[column] = parsed_dates.dt.strftime(
        "%Y-%m-%d %H:%M:%S"
    )

# Pandas NaN değerlerini PostgreSQL NULL olacak
# şekilde None değerine çevir.
df = df.astype(object).where(
    pd.notnull(df),
    None,
)

df["import_batch"] = IMPORT_BATCH

print(
    "Temizleme sonrası kayıt sayısı: "
    f"{len(df)}"
)


# =========================================================
# POSTGRESQL BAĞLANTISI
# =========================================================

database_url = URL.create(
    drivername="postgresql+psycopg2",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
)


# =========================================================
# BAĞLANTI VE TABLO KONTROLÜ
# =========================================================

with engine.connect() as connection:
    connection.execute(text("SELECT 1"))

    table_exists = connection.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'staging_servicedesk_import'
            );
            """
        )
    ).scalar()

    if not table_exists:
        raise RuntimeError(
            "staging_servicedesk_import tablosu bulunamadı."
        )

print("PostgreSQL bağlantısı başarılı.")


# =========================================================
# AYNI BATCH DAHA ÖNCE AKTARILMIŞ MI?
# =========================================================

with engine.connect() as connection:
    existing_count = connection.execute(
        text(
            """
            SELECT COUNT(*)
            FROM staging_servicedesk_import
            WHERE import_batch = :import_batch;
            """
        ),
        {
            "import_batch": IMPORT_BATCH,
        },
    ).scalar()

if existing_count and existing_count > 0:
    raise RuntimeError(
        f"'{IMPORT_BATCH}' adıyla daha önce "
        f"{existing_count} kayıt aktarılmış. "
        "Tekrar aktarımı önlemek için işlem durduruldu."
    )


# =========================================================
# POSTGRESQL'E AKTAR
# =========================================================

df.to_sql(
    name="staging_servicedesk_import",
    con=engine,
    schema="public",
    if_exists="append",
    index=False,
    chunksize=250,
    method="multi",
)

print(
    f"\n{len(df)} kayıt PostgreSQL'e "
    "başarıyla aktarıldı."
)


# =========================================================
# SONUÇ KONTROLÜ
# =========================================================

with engine.connect() as connection:
    transferred_count = connection.execute(
        text(
            """
            SELECT COUNT(*)
            FROM staging_servicedesk_import
            WHERE import_batch = :import_batch;
            """
        ),
        {
            "import_batch": IMPORT_BATCH,
        },
    ).scalar()

print(
    "PostgreSQL'de doğrulanan kayıt sayısı: "
    f"{transferred_count}"
)
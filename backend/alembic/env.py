from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app import models  # noqa: F401
from app.ai import models as ai_models  # noqa: F401
from app.attachments import models as attachment_models  # noqa: F401
from app.database import Base, DATABASE_URL


# =========================================================
# ALEMBIC CONFIG
# =========================================================

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# =========================================================
# VERİTABANI BAĞLANTISI
# =========================================================

# Bağlantı bilgisi alembic.ini içindeki örnek URL'den değil,
# uygulamanın database.py ve .env yapılandırmasından alınır.
database_url = DATABASE_URL.render_as_string(
    hide_password=False,
)

# Alembic ConfigParser yüzde işaretlerini özel karakter
# olarak değerlendirdiği için kaçış uygulanır.
config.set_main_option(
    "sqlalchemy.url",
    database_url.replace("%", "%%"),
)


# =========================================================
# SQLALCHEMY METADATA
# =========================================================

# Model importları, tabloların Base.metadata içine
# kaydedilmesini sağlar.
target_metadata = Base.metadata


# =========================================================
# ALEMBIC TARAFINDAN YÖNETİLECEK TABLOLAR
# =========================================================

# Mevcut veritabanında uygulama modellerinde bulunmayan birçok
# eski ve içe aktarılmış tablo vardır. Bunların yanlışlıkla
# silinmesini veya değiştirilmesini önlemek için yalnızca
# uygulamanın yönettiği tablolar dikkate alınır.
MANAGED_TABLES = {
    "accounts",
    "ticket_attachments",
    "ai_sessions",
    "ai_messages",
    "ai_session_sources",
    "ai_session_attachments",
}


def include_object(
    object_,
    name,
    type_,
    reflected,
    compare_to,
):
    """
    Autogenerate sırasında yalnızca MANAGED_TABLES içindeki
    tabloları ve bu tablolara ait kolon, index ve constraint
    nesnelerini dikkate alır.
    """

    if type_ == "table":
        return name in MANAGED_TABLES

    table = getattr(
        object_,
        "table",
        None,
    )

    if table is not None:
        return table.name in MANAGED_TABLES

    return True


# =========================================================
# OFFLINE MIGRATION
# =========================================================

def run_migrations_offline() -> None:
    url = config.get_main_option(
        "sqlalchemy.url",
    )

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        include_object=include_object,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# =========================================================
# ONLINE MIGRATION
# =========================================================

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(
            config.config_ini_section,
            {},
        ),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# =========================================================
# ÇALIŞTIRMA
# =========================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
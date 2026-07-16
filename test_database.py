from sqlalchemy import text

from backend.app.database import engine


def main() -> None:
    try:
        with engine.connect() as connection:
            database_name = connection.execute(
                text("SELECT current_database();")
            ).scalar()

            version = connection.execute(
                text("SELECT version();")
            ).scalar()

        print("PostgreSQL bağlantısı başarılı.")
        print(f"Veritabanı: {database_name}")
        print(f"Sürüm: {version}")

    except Exception as error:
        print("PostgreSQL bağlantısı başarısız.")
        print(type(error).__name__)
        print(error)


if __name__ == "__main__":
    main()
from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine

# (table, column, ddl_type) — append new columns here as the schema evolves
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("candidate", "career_history", "TEXT"),
    ("candidate", "cv_filename",    "TEXT"),
]


class Database:
    def __init__(self, url: str) -> None:
        self._engine = create_engine(url, echo=False)

    def create_tables(self) -> None:
        SQLModel.metadata.create_all(self._engine)

    def run_migrations(self) -> None:
        """Add missing columns that were introduced after the initial table creation."""
        with self._engine.begin() as conn:
            for table, column, col_type in _MIGRATIONS:
                exists = conn.execute(
                    text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_name = :t AND column_name = :c"
                    ),
                    {"t": table, "c": column},
                ).first()
                if not exists:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}'))
                    print(f"Migration: added {table}.{column}")

    def get_session(self) -> Generator[Session, None, None]:
        with Session(self._engine) as session:
            yield session

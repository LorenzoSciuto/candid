import logging
from collections.abc import Generator

from sqlmodel import SQLModel, Session, create_engine

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, url: str) -> None:
        self._engine = create_engine(url, echo=False)

    def create_tables(self) -> None:
        SQLModel.metadata.create_all(self._engine)
        self._migrate()

    def _migrate(self) -> None:
        from sqlalchemy import text
        migrations = [
            "ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS updated_at VARCHAR",
        ]
        with self._engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                except Exception:
                    pass
            conn.commit()

    def get_session(self) -> Generator[Session, None, None]:
        with Session(self._engine) as session:
            yield session

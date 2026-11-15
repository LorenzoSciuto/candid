import logging
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from sqlmodel import Session, create_engine

logger = logging.getLogger(__name__)

_ALEMBIC_INI = Path(__file__).resolve().parents[3] / "alembic.ini"   # backend/alembic.ini


class Database:
    def __init__(self, url: str) -> None:
        self._url = url
        self._engine = create_engine(url, echo=False)

    def migrate(self) -> None:
        from alembic.config import Config

        from alembic import command

        cfg = Config(str(_ALEMBIC_INI))
        cfg.set_main_option("sqlalchemy.url", self._url)
        command.upgrade(cfg, "head")

    def get_session(self) -> Generator[Session, None, None]:
        with Session(self._engine) as session:
            yield session

    @contextmanager
    def get_session_direct(self) -> Generator[Session, None, None]:
        with Session(self._engine) as session:
            yield session

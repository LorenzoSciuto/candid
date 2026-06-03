import logging
from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, create_engine

logger = logging.getLogger(__name__)

_ALEMBIC_DIR = Path(__file__).parent.parent.parent / "alembic.ini"


class Database:
    def __init__(self, url: str) -> None:
        self._url = url
        self._engine = create_engine(url, echo=False)

    def migrate(self) -> None:
        from alembic import command
        from alembic.config import Config

        cfg = Config(str(_ALEMBIC_DIR))
        cfg.set_main_option("sqlalchemy.url", self._url)
        command.upgrade(cfg, "head")

    def get_session(self) -> Generator[Session, None, None]:
        with Session(self._engine) as session:
            yield session

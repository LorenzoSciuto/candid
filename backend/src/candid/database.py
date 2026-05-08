from collections.abc import Generator

from sqlmodel import SQLModel, Session, create_engine


class Database:
    def __init__(self, url: str) -> None:
        self._engine = create_engine(url, echo=False)

    def create_tables(self) -> None:
        SQLModel.metadata.create_all(self._engine)

    def get_session(self) -> Generator[Session, None, None]:
        with Session(self._engine) as session:
            yield session

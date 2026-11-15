"""Request-scoped tenant context enforced by PostgreSQL Row-Level Security.

Routers already filter every query by ``org_id``; RLS is the second line of
defence that makes a forgotten filter return nothing instead of another
organisation's data.

How it works:

* ``require_org`` calls :func:`set_org` once the user's membership is verified.
* Public/system endpoints that legitimately work across organisations
  (login, public job portal, candidate video links) declare
  :func:`rls_bypass` explicitly.
* On every transaction start, :func:`_apply_tenant_context` switches to the
  unprivileged ``candid_app`` role (so RLS applies even when the connection
  user owns the tables) and publishes the context as transaction-local
  settings read by the policies. Because it runs per transaction, the context
  survives ``session.commit()``.

The values live in ``ContextVar``s set from *async* dependencies, so they are
inherited by the sync endpoint and background tasks of the same request.
On SQLite (tests) the hook is a no-op.
"""
from contextvars import ContextVar

from fastapi import HTTPException
from sqlalchemy import event, text
from sqlalchemy.orm import Session

APP_ROLE = "candid_app"

_current_org_id: ContextVar[str] = ContextVar("current_org_id", default="")
_bypass: ContextVar[bool] = ContextVar("rls_bypass", default=False)


def set_org(org_id: str) -> None:
    _current_org_id.set(org_id)


def enable_bypass() -> None:
    _bypass.set(True)


async def rls_bypass() -> None:
    """FastAPI dependency for endpoints that must read across organisations."""
    enable_bypass()


def current_org_id() -> str:
    return _current_org_id.get()


@event.listens_for(Session, "after_begin")
def _apply_tenant_context(session, transaction, connection) -> None:
    if connection.dialect.name != "postgresql":
        return
    connection.execute(text(f"SET LOCAL ROLE {APP_ROLE}"))
    connection.execute(
        text(
            "SELECT set_config('app.current_org_id', :org, true),"
            " set_config('app.rls_bypass', :bypass, true)"
        ),
        {"org": _current_org_id.get(), "bypass": "on" if _bypass.get() else "off"},
    )


def get_in_org(session, model, obj_id: str | None, org_id: str, label: str | None = None):
    """Load ``model`` by id only if it belongs to ``org_id``; 404 otherwise.

    Use it for every id that comes from the client — including foreign keys in
    request bodies — so a guessed id from another organisation is never linked.
    """
    obj = session.get(model, obj_id) if obj_id else None
    if obj is None or obj.org_id != org_id:
        raise HTTPException(404, f"{label or model.__name__} not found")
    return obj

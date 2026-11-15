"""Import rules that keep components independent (and splittable later).

* commons  → may import only commons
* services → may import only commons (other services only for type hints)
* routers  → may import commons and services, never another router
* app.py   → composition root, the only place that wires everything together
"""
import ast
from pathlib import Path

import pytest

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "candid"


def _runtime_candid_imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text())
    type_only = {
        id(node)
        for block in ast.walk(tree)
        if isinstance(block, ast.If) and "TYPE_CHECKING" in ast.unparse(block.test)
        for node in ast.walk(block)
    }
    modules = []
    for node in ast.walk(tree):
        if id(node) in type_only:
            continue
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("candid"):
            modules.append(node.module)
        elif isinstance(node, ast.Import):
            modules += [alias.name for alias in node.names if alias.name.startswith("candid")]
    return modules


def _modules(layer: str) -> list[Path]:
    return sorted(p for p in (PACKAGE / layer).glob("*.py") if p.name != "__init__.py")


@pytest.mark.parametrize("path", _modules("commons"), ids=lambda p: p.stem)
def test_commons_should_import_only_commons(path: Path) -> None:
    offenders = [m for m in _runtime_candid_imports(path) if not m.startswith("candid.commons")]
    assert offenders == []


@pytest.mark.parametrize("path", _modules("services"), ids=lambda p: p.stem)
def test_services_should_import_only_commons(path: Path) -> None:
    offenders = [m for m in _runtime_candid_imports(path) if not m.startswith("candid.commons")]
    assert offenders == []


@pytest.mark.parametrize("path", _modules("routers"), ids=lambda p: p.stem)
def test_routers_should_never_import_other_routers(path: Path) -> None:
    allowed = ("candid.commons", "candid.services")
    offenders = [m for m in _runtime_candid_imports(path) if not m.startswith(allowed)]
    assert offenders == []


def test_backend_should_not_reference_frontend_files() -> None:
    offenders = [p.name for p in PACKAGE.rglob("*.py") if "frontend/" in p.read_text()]
    assert offenders == []

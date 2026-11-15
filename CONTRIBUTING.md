# Contributing

Thanks for your interest in Candid! Please read the [Code of Conduct](CODE_OF_CONDUCT.md); open items are listed in the [roadmap](docs/ROADMAP.md).

## Workflow

1. Create a branch from `main`.
2. Make your change with tests. Keep the layering rules in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md):
   shared code goes to `backend/src/candid/commons/`, and routers never import each other.
3. Run the checks locally:
   ```bash
   cd backend
   uv run pytest
   uv run --with ruff ruff check src tests alembic
   uv run alembic check            # with a database at head: migrations must match the models
   node ../frontend/tests/check.js
   ```
4. Open a pull request. CI runs the same checks, including the Row-Level Security tests on PostgreSQL.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), because releases are
computed from them when a change lands on `main`:

| Prefix | Example | Release |
|---|---|---|
| `feat:` | `feat: export the funnel as CSV` | minor (1.**x**.0) |
| `fix:` / `perf:` | `fix: keep tenant context after commit` | patch (1.0.**x**) |
| `feat!:` or a `BREAKING CHANGE:` footer | `feat!: drop the v1 analysis format` | major (**x**.0.0) |
| `docs:` `test:` `refactor:` `chore:` `ci:` | `docs: explain RLS bypass` | none |

## Conventions

- **Backend:** routers are classes with injected services. Every id coming from a request is
  resolved with `get_in_org()`. Test names follow `test_<method>_should_<behaviour>_when_<condition>`.
- **Frontend:** every user-visible string goes through `useT()` and must exist in EN, IT and DE.
  When you edit a file, bump its `?v=` query string in `index.html`.
- **Code, comments and documentation are written in English.**

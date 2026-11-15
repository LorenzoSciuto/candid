## What and why

## How it was tested

## Checklist
- [ ] Conventional Commit title (`feat:`, `fix:`, `docs:` …)
- [ ] `uv run pytest` and `ruff check` pass
- [ ] New or changed UI strings exist in EN, IT and DE (`node frontend/tests/check.js`)
- [ ] Every client-supplied id is resolved with `get_in_org()`; new tenant tables have an RLS policy
- [ ] Code, comments and docs are in English

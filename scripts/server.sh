#!/usr/bin/env bash
# Run the Candid FastAPI backend with hot-reload.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

cd "${BACKEND_DIR}"

echo "→  Starting Candid API on http://${HOST}:${PORT}"
echo "   Docs: http://localhost:${PORT}/docs"
echo ""

exec uv run uvicorn candid.app:app \
    --host "${HOST}" \
    --port "${PORT}" \
    --reload

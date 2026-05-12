#!/usr/bin/env bash
# Run the Candid FastAPI backend with hot-reload.
# If scripts/certs/ exists, serves over HTTPS (required for Web Speech API).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"
CERT_DIR="${SCRIPT_DIR}/certs"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

cd "${BACKEND_DIR}"

SSL_ARGS=()
SCHEME="http"
if [[ -f "${CERT_DIR}/localhost.pem" && -f "${CERT_DIR}/localhost-key.pem" ]]; then
  SSL_ARGS=(--ssl-certfile "${CERT_DIR}/localhost.pem" --ssl-keyfile "${CERT_DIR}/localhost-key.pem")
  SCHEME="https"
fi

echo "→  Starting Candid API on ${SCHEME}://${HOST}:${PORT}"
echo "   Docs: ${SCHEME}://localhost:${PORT}/docs"
[[ "${SCHEME}" == "http" ]] && echo "   Tip: run ./scripts/gen-certs.sh to enable HTTPS (needed for Web Speech API)"
echo ""

exec uv run uvicorn candid.app:app \
    --host "${HOST}" \
    --port "${PORT}" \
    --reload \
    "${SSL_ARGS[@]}"

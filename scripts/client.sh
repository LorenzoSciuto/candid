#!/usr/bin/env bash
# Serve the Candid frontend (static files, no build step).
# If scripts/certs/ exists, serves over HTTPS (required for the Web Speech API in Live Room).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"
CERT_DIR="${SCRIPT_DIR}/certs"
PORT="${PORT:-8080}"

ARGS=("${PORT}")
if [[ -f "${CERT_DIR}/localhost.pem" && -f "${CERT_DIR}/localhost-key.pem" ]]; then
  ARGS+=("${CERT_DIR}/localhost.pem" "${CERT_DIR}/localhost-key.pem")
fi

cd "${FRONTEND_DIR}"
exec python3 "${SCRIPT_DIR}/serve.py" "${ARGS[@]}"

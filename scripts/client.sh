#!/usr/bin/env bash
# Serve the Candid frontend.
# If scripts/certs/ exists, serves over HTTPS (required for Web Speech API).
# Use a real server (not file://) so drag-and-drop file upload works correctly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"
CERT_DIR="${SCRIPT_DIR}/certs"
PORT="${PORT:-8080}"

cd "${FRONTEND_DIR}"

if [[ -f "${CERT_DIR}/localhost.pem" && -f "${CERT_DIR}/localhost-key.pem" ]]; then
  echo "→  Candid frontend → https://localhost:${PORT}/index.html"
  echo "   (HTTPS mode — Web Speech API enabled)"
  echo ""
  exec python3 - "${PORT}" "${CERT_DIR}/localhost.pem" "${CERT_DIR}/localhost-key.pem" <<'PYEOF'
import ssl, sys, http.server

port = int(sys.argv[1])
cert = sys.argv[2]
key  = sys.argv[3]

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(cert, key)

server = http.server.HTTPServer(("", port), http.server.SimpleHTTPRequestHandler)
server.socket = ctx.wrap_socket(server.socket, server_side=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
PYEOF
else
  echo "→  Candid frontend → http://localhost:${PORT}/index.html"
  echo "   (Chrome recommended — Live Room requires Web Speech API)"
  echo "   Tip: run ./scripts/gen-certs.sh to enable HTTPS"
  echo ""
  python3 -m http.server "${PORT}" 2>/dev/null || true
fi

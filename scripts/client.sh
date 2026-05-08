#!/usr/bin/env bash
# Serve the Candid frontend over HTTP.
# Use a real server (not file://) so drag-and-drop file upload works correctly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"
PORT="${PORT:-8080}"

cd "${FRONTEND_DIR}"

echo "→  Candid frontend → http://localhost:${PORT}/index.html"
echo "   (Chrome recommended — Live Room requires Web Speech API)"
echo ""

exec python3 -m http.server "${PORT}"

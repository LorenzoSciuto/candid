#!/usr/bin/env bash
# Generate trusted localhost TLS certs using mkcert.
# Run once; certs land in scripts/certs/ and are used by server.sh + client.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certs"

mkdir -p "${CERT_DIR}"
cd "${CERT_DIR}"

# Install local CA if not already trusted
mkcert -install

# Generate cert valid for localhost + 127.0.0.1
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1

echo ""
echo "✓  Certs written to scripts/certs/"
echo "   Restart server.sh and client.sh to pick them up."

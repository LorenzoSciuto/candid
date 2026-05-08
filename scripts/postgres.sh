#!/usr/bin/env bash
# Start the Candid Postgres container if it is not already running.
set -euo pipefail

CONTAINER="candid-db"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-candid}"
DB_PASS="${DB_PASS:-password}"
DB_NAME="${DB_NAME:-candid}"
PG_IMAGE="postgres:16-alpine"

# ── Already running ────────────────────────────────────────────────────────────
if docker ps --filter "name=^/${CONTAINER}$" --format "{{.Names}}" 2>/dev/null \
   | grep -q "^${CONTAINER}$"; then
    echo "✓  Postgres already running (${CONTAINER})"
    exit 0
fi

# ── Container exists but is stopped ───────────────────────────────────────────
if docker ps -a --filter "name=^/${CONTAINER}$" --format "{{.Names}}" 2>/dev/null \
   | grep -q "^${CONTAINER}$"; then
    echo "→  Starting existing container ${CONTAINER}…"
    docker start "${CONTAINER}" > /dev/null
else
    echo "→  Creating container ${CONTAINER} (${PG_IMAGE})…"
    docker run -d \
        --name "${CONTAINER}" \
        -e POSTGRES_USER="${DB_USER}" \
        -e POSTGRES_PASSWORD="${DB_PASS}" \
        -e POSTGRES_DB="${DB_NAME}" \
        -p "${DB_PORT}:5432" \
        "${PG_IMAGE}" > /dev/null
fi

# ── Wait for readiness ─────────────────────────────────────────────────────────
echo -n "⏳ Waiting for Postgres to be ready"
for i in $(seq 1 30); do
    if docker exec "${CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" -q 2>/dev/null; then
        echo ""
        echo "✓  Postgres ready → postgresql://${DB_USER}:***@localhost:${DB_PORT}/${DB_NAME}"
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "✗  Postgres did not become ready within 30 s" >&2
exit 1

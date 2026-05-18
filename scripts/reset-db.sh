#!/usr/bin/env bash
# Drop and recreate all tables. WARNING: destroys all data.
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-candid}"
PGPASSWORD="${PGPASSWORD:-password}"
PGDATABASE="${PGDATABASE:-candid}"

export PGPASSWORD

echo "⚠  This will DROP and recreate all tables in $PGDATABASE."
read -p "Type 'yes' to confirm: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

CONTAINER=$(docker ps --filter "name=candid-db" --format "{{.Names}}" | head -1)
if [[ -z "$CONTAINER" ]]; then
  echo "Error: candid-db container not running."
  exit 1
fi

echo "Dropping all tables…"
docker exec -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" -c "
  DO \$\$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END \$\$;
"

echo "Running Alembic migrations…"
cd "$(dirname "$0")/../backend"
uv run alembic upgrade head

echo "Done. DB is clean and ready."

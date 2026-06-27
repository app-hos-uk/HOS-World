#!/bin/sh
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  ./docker-migrate.sh
else
  echo "=== Skipping migrations (SKIP_MIGRATIONS=true) ==="
fi

echo "=== Starting application ==="
exec node dist/main.js

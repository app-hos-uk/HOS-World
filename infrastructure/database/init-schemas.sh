#!/bin/bash
# This script is mounted into the PostgreSQL container's docker-entrypoint-initdb.d/
# It creates per-service schemas when the database is first initialized.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE SCHEMA IF NOT EXISTS auth_service;
  CREATE SCHEMA IF NOT EXISTS user_service;
  CREATE SCHEMA IF NOT EXISTS product_service;
  CREATE SCHEMA IF NOT EXISTS order_service;
  CREATE SCHEMA IF NOT EXISTS payment_service;
  CREATE SCHEMA IF NOT EXISTS notification_service;
  CREATE SCHEMA IF NOT EXISTS search_service;
  CREATE SCHEMA IF NOT EXISTS inventory_service;
  CREATE SCHEMA IF NOT EXISTS seller_service;
  CREATE SCHEMA IF NOT EXISTS influencer_service;
  CREATE SCHEMA IF NOT EXISTS content_service;
  CREATE SCHEMA IF NOT EXISTS admin_service;

  -- Grant the default user access to all schemas
  GRANT ALL ON SCHEMA auth_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA user_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA product_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA order_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA payment_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA notification_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA search_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA inventory_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA seller_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA influencer_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA content_service TO ${POSTGRES_USER};
  GRANT ALL ON SCHEMA admin_service TO ${POSTGRES_USER};
EOSQL

echo "Per-service database schemas created successfully."

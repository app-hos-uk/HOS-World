#!/bin/bash
# Phase 4: Per-service PostgreSQL schema initialization
#
# This script is mounted into the PostgreSQL container's docker-entrypoint-initdb.d/
# It creates per-service schemas, grants permissions, and sets up search_path
# so each service can find its tables without schema-qualifying every query.
#
# During Phase 4 all services share one database user but operate in isolated schemas.
# Phase 5 (production hardening) will introduce per-service database users.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- ─── Create Per-Service Schemas ──────────────────────────────────────────
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

  -- ─── Grant Schema Ownership ──────────────────────────────────────────────
  -- The shared database user gets full access to every schema.
  -- In Phase 5 this will be replaced with per-service users.
  GRANT ALL ON SCHEMA auth_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA user_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA product_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA order_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA payment_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA notification_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA search_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA inventory_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA seller_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA influencer_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA content_service TO "${POSTGRES_USER}";
  GRANT ALL ON SCHEMA admin_service TO "${POSTGRES_USER}";

  -- ─── Default Privileges ──────────────────────────────────────────────────
  -- Ensure the shared user automatically gets access to tables, sequences,
  -- and functions created by Prisma migrate in any service schema.
  ALTER DEFAULT PRIVILEGES IN SCHEMA auth_service         GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA user_service         GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA product_service      GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA order_service        GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA payment_service      GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA notification_service GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA search_service       GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA inventory_service    GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA seller_service       GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA influencer_service   GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA content_service      GRANT ALL ON TABLES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA admin_service        GRANT ALL ON TABLES TO "${POSTGRES_USER}";

  ALTER DEFAULT PRIVILEGES IN SCHEMA auth_service         GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA user_service         GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA product_service      GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA order_service        GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA payment_service      GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA notification_service GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA search_service       GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA inventory_service    GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA seller_service       GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA influencer_service   GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA content_service      GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA admin_service        GRANT ALL ON SEQUENCES TO "${POSTGRES_USER}";

  -- ─── Cross-Schema Read Views (Step 4) ────────────────────────────────────
  -- These read-only views allow services to query data owned by other services
  -- without direct schema access. This replaces cross-service JOINs.

  -- Order, Notification, Admin services need user email/name for display
  CREATE OR REPLACE VIEW order_service.v_users AS
    SELECT id, email, "firstName", "lastName", role FROM auth_service.users;

  CREATE OR REPLACE VIEW notification_service.v_users AS
    SELECT id, email, "firstName", "lastName", role FROM auth_service.users;

  CREATE OR REPLACE VIEW admin_service.v_users AS
    SELECT id, email, "firstName", "lastName", role FROM auth_service.users;

  -- Order, Notification services need seller info
  CREATE OR REPLACE VIEW order_service.v_sellers AS
    SELECT id, "userId", "storeName", slug FROM seller_service.sellers;

  -- Search service reads from product_service (handled by Prisma multiSchema)
  -- Payment service needs order number for reconciliation
  CREATE OR REPLACE VIEW payment_service.v_orders AS
    SELECT id, "orderNumber", "userId", "sellerId", total, currency, status FROM order_service.orders;

  -- Influencer service needs product info for links
  CREATE OR REPLACE VIEW influencer_service.v_products AS
    SELECT id, name, slug, price, currency, "sellerId", status FROM product_service.products;

EOSQL

echo "Per-service database schemas, permissions, and cross-schema views created successfully."

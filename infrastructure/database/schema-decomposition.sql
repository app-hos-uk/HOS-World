-- ──────────────────────────────────────────────────────────────────────────────
-- Phase 4: Database Schema Decomposition
-- ──────────────────────────────────────────────────────────────────────────────
--
-- This script creates per-service PostgreSQL schemas for the HOS Marketplace
-- microservices. Each service gets its own schema within the same database.
--
-- Strategy:
--   1. Create a dedicated schema for each microservice.
--   2. Move relevant tables from the 'public' schema to the service schema.
--   3. Update each microservice's DATABASE_URL to include ?schema=<service_schema>
--   4. Create cross-schema views where services need to read from other schemas.
--
-- Run order:
--   Step 1: Create schemas (this file)
--   Step 2: Update service Prisma schemas to use the service schema
--   Step 3: Migrate tables progressively using Prisma migrate
--
-- IMPORTANT: This is a GRADUAL migration. All services initially share the
-- 'public' schema. Tables are moved one service at a time.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── Create Service Schemas ──────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS auth_service;
COMMENT ON SCHEMA auth_service IS 'Auth Service: users, refresh_tokens, oauth_accounts, permission_roles';

CREATE SCHEMA IF NOT EXISTS user_service;
COMMENT ON SCHEMA user_service IS 'User Service: customers, addresses, customer_groups, wishlist';

CREATE SCHEMA IF NOT EXISTS product_service;
COMMENT ON SCHEMA product_service IS 'Product Service: products, categories, attributes, tags, collections';

CREATE SCHEMA IF NOT EXISTS order_service;
COMMENT ON SCHEMA order_service IS 'Order Service: orders, order_items, carts, returns, gift_cards';

CREATE SCHEMA IF NOT EXISTS payment_service;
COMMENT ON SCHEMA payment_service IS 'Payment Service: payments, transactions, settlements, currency';

CREATE SCHEMA IF NOT EXISTS notification_service;
COMMENT ON SCHEMA notification_service IS 'Notification Service: notifications, whatsapp_*, newsletter';

CREATE SCHEMA IF NOT EXISTS search_service;
COMMENT ON SCHEMA search_service IS 'Search Service: search indexes, catalog entries';

CREATE SCHEMA IF NOT EXISTS inventory_service;
COMMENT ON SCHEMA inventory_service IS 'Inventory Service: warehouses, inventory_locations, stock_*, shipping, fulfillment, logistics, tax';

CREATE SCHEMA IF NOT EXISTS seller_service;
COMMENT ON SCHEMA seller_service IS 'Seller Service: sellers, product_submissions, seller_invitations, reviews, themes';

CREATE SCHEMA IF NOT EXISTS influencer_service;
COMMENT ON SCHEMA influencer_service IS 'Influencer Service: influencers, storefronts, campaigns, commissions, payouts, referrals';

CREATE SCHEMA IF NOT EXISTS content_service;
COMMENT ON SCHEMA content_service IS 'Content Service: promotions, coupons, badges, quests, collections, shared_items, fandoms, characters, marketing';

CREATE SCHEMA IF NOT EXISTS admin_service;
COMMENT ON SCHEMA admin_service IS 'Admin Service: activity_logs, gdpr, support_tickets, webhooks, integrations, ai_chats';


-- ─── Table-to-Schema Mapping ─────────────────────────────────────────────────
-- This mapping documents which tables belong to which service schema.
-- The actual table moves happen via ALTER TABLE ... SET SCHEMA or Prisma migrate.
--
-- auth_service:
--   users, permission_roles, refresh_tokens, oauth_accounts, tenants, tenant_users, stores, configs
--
-- user_service:
--   customers, addresses, customer_groups, wishlist_items
--
-- product_service:
--   products, product_images, product_variations, product_bundle_items, volume_pricings,
--   categories, attributes, attribute_values, product_attributes, tags, product_tags,
--   collections, catalog_entries, duplicate_products, product_pricings
--
-- order_service:
--   orders, order_items, order_notes, carts, cart_items,
--   return_policies, return_requests, return_items, gift_cards, gift_card_transactions
--
-- payment_service:
--   payments, transactions, settlements, order_settlements,
--   currency_exchange_rates, discrepancies
--
-- notification_service:
--   notifications, whatsapp_conversations, whatsapp_messages, whatsapp_templates
--
-- search_service:
--   (uses Elasticsearch/Meilisearch; minimal PG tables)
--
-- inventory_service:
--   warehouses, inventory_locations, stock_reservations, stock_transfers, stock_movements,
--   shipping_methods, shipping_rules, fulfillment_centers, shipments, logistics_partners,
--   tax_zones, tax_classes, tax_rates
--
-- seller_service:
--   sellers, product_submissions, seller_invitations, product_reviews,
--   themes, seller_theme_settings
--
-- influencer_service:
--   influencers, influencer_storefronts, influencer_product_links,
--   influencer_campaigns, referrals, influencer_commissions, influencer_payouts,
--   influencer_invitations
--
-- content_service:
--   promotions, coupons, coupon_usages, badges, user_badges, quests, user_quests,
--   collections (user), shared_items, fandoms, characters, marketing_materials
--
-- admin_service:
--   activity_logs, gdpr_consent_logs, support_tickets, ticket_messages,
--   knowledge_base_articles, webhooks, webhook_deliveries,
--   integration_configs, integration_logs, ai_chats


-- ─── Cross-Schema Read Views ─────────────────────────────────────────────────
-- These views allow services to read data from other schemas without direct access.
-- They are read-only projections used for queries like "get user email for order".

-- Example: Order service needs to read user email for order confirmation
-- CREATE VIEW order_service.user_emails AS
--   SELECT id, email, "firstName", "lastName" FROM auth_service.users;

-- Example: Notification service needs user email for sending emails
-- CREATE VIEW notification_service.user_emails AS
--   SELECT id, email, "firstName", "lastName" FROM auth_service.users;

-- NOTE: Implement cross-schema views only as needed, when services actually
-- require data from other schemas. Start with the simplest possible setup
-- and add views as cross-service queries are identified.


-- ─── Grant Permissions ───────────────────────────────────────────────────────
-- Each service's database user should only have access to its own schema.
-- During Phase 4, we use a single database user with access to all schemas.
-- In Phase 5 (production hardening), create per-service database users.

-- Example (to be applied in Phase 5):
-- CREATE USER auth_svc_user WITH PASSWORD 'xxx';
-- GRANT USAGE ON SCHEMA auth_service TO auth_svc_user;
-- GRANT ALL ON ALL TABLES IN SCHEMA auth_service TO auth_svc_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO auth_svc_user; -- read-only fallback

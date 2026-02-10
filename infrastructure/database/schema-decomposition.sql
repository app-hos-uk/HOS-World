-- ──────────────────────────────────────────────────────────────────────────────
-- Phase 4: Database Schema Decomposition (REFERENCE DOCUMENT)
-- ──────────────────────────────────────────────────────────────────────────────
--
-- This file documents the per-service PostgreSQL schema layout for HOS Marketplace.
-- The actual schema creation is handled by init-schemas.sh (mounted into the
-- PostgreSQL container's docker-entrypoint-initdb.d/).
--
-- Architecture:
--   - Single PostgreSQL database, 12 service schemas + public (monolith).
--   - Each microservice's Prisma schema uses @@schema("service_name") to target
--     its own PostgreSQL schema via the multiSchema preview feature.
--   - Cross-service reads use SQL views (created in init-schemas.sh).
--   - Cross-service writes are forbidden; use Redis events instead.
--
-- Migration path:
--   Step 1 (DONE): Prisma schemas annotated with @@schema + multiSchema enabled
--   Step 2 (DONE): docker-compose DATABASE_URLs include ?schema=<service_schema>
--   Step 3 (DONE): init-schemas.sh creates schemas, grants, default privileges,
--                   and cross-schema read views
--   Step 4 (FUTURE): Move to separate database instances per service
-- ──────────────────────────────────────────────────────────────────────────────


-- ─── Schema → Service → Tables Mapping ──────────────────────────────────────

-- auth_service (port 3005):
--   users, permission_roles, refresh_tokens, oauth_accounts,
--   gdpr_consent_logs, tenants, tenant_users,
--   customers (registration only), sellers (registration only),
--   seller_invitations, characters, badges, user_badges

-- user_service (port 3006):
--   users (profile view), customers, addresses, customer_groups,
--   badges, user_badges, user_quests, collections

-- product_service (port 3007):
--   products, product_images, product_variations, product_bundle_items,
--   volume_pricings, product_attributes, attributes, attribute_values,
--   sellers (read-only ref), categories, tags, fandoms, characters

-- order_service (port 3008):
--   orders, order_items, carts, cart_items,
--   return_requests, return_policies, gift_cards

-- payment_service (port 3009):
--   transactions, settlements, currencies, payout_accounts

-- notification_service (port 3003):
--   notifications, whatsapp_conversations, whatsapp_messages, whatsapp_templates

-- search_service (port 3004):
--   (reads from product_service schema via Prisma multiSchema)

-- inventory_service (port 3010):
--   warehouses, inventory_locations, stock_reservations, stock_transfers,
--   stock_movements, shipping_methods, shipping_rules, fulfillment_centers,
--   shipments, logistics_partners, tax_zones, tax_classes, tax_rates

-- seller_service (port 3011):
--   sellers, product_submissions, seller_invitations, product_reviews,
--   themes, seller_theme_settings

-- influencer_service (port 3012):
--   influencers, influencer_storefronts, influencer_product_links,
--   influencer_campaigns, referrals, influencer_commissions,
--   influencer_payouts, influencer_invitations

-- content_service (port 3013):
--   promotions, coupons, coupon_usages, badges, user_badges,
--   quests, user_quests, collections, shared_items, fandoms,
--   characters, marketing_materials

-- admin_service (port 3014):
--   activity_logs, gdpr_consent_logs, support_tickets, ticket_messages,
--   knowledge_base_articles, webhooks, webhook_deliveries,
--   integration_configs, integration_logs, ai_chats


-- ─── Cross-Schema Read Views ────────────────────────────────────────────────
-- Created by init-schemas.sh. These allow read-only access to data
-- owned by other services without direct schema coupling.

-- order_service.v_users      → reads auth_service.users (id, email, name, role)
-- order_service.v_sellers    → reads seller_service.sellers (id, userId, storeName, slug)
-- notification_service.v_users → reads auth_service.users
-- admin_service.v_users      → reads auth_service.users
-- payment_service.v_orders   → reads order_service.orders (id, orderNumber, userId, total)
-- influencer_service.v_products → reads product_service.products (id, name, slug, price)


-- ─── Future: Per-Service Database Users (Phase 5) ───────────────────────────
-- In production, each service should have its own database user with access
-- restricted to its own schema + read-only views in other schemas.
--
-- CREATE USER auth_svc WITH PASSWORD 'xxx';
-- GRANT USAGE ON SCHEMA auth_service TO auth_svc;
-- GRANT ALL ON ALL TABLES IN SCHEMA auth_service TO auth_svc;
-- GRANT SELECT ON order_service.v_users TO auth_svc;  -- if needed
--
-- CREATE USER order_svc WITH PASSWORD 'xxx';
-- GRANT USAGE ON SCHEMA order_service TO order_svc;
-- GRANT ALL ON ALL TABLES IN SCHEMA order_service TO order_svc;
-- GRANT SELECT ON order_service.v_users TO order_svc;
-- GRANT SELECT ON order_service.v_sellers TO order_svc;

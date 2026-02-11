-- Cross-Schema Read Views (run after Prisma migrations have created tables)
--
-- Run once after the first successful docker compose up (or after all
-- microservices have run their migrations). Example:
--
--   cat infrastructure/database/create-cross-schema-views.sql | docker compose exec -T postgres psql -U hos_user -d hos_marketplace
--
-- Or from host: psql "$DATABASE_URL" -f infrastructure/database/create-cross-schema-views.sql
--
-- These views reference auth_service.users, seller_service.sellers, order_service.orders,
-- and product_service.products, which exist only after Prisma migrations have run.

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

-- Payment service needs order number for reconciliation
CREATE OR REPLACE VIEW payment_service.v_orders AS
  SELECT id, "orderNumber", "userId", "sellerId", total, currency, status FROM order_service.orders;

-- Influencer service needs product info for links
CREATE OR REPLACE VIEW influencer_service.v_products AS
  SELECT id, name, slug, price, currency, "sellerId", status FROM product_service.products;

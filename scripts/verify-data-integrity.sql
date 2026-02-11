-- Data integrity checks for multi-schema PostgreSQL
--
-- Run after migrations and cross-schema views are in place. Example:
--
--   psql "$DATABASE_URL" -f scripts/verify-data-integrity.sql
--
-- Or: cat scripts/verify-data-integrity.sql | docker compose exec -T postgres psql -U hos_user -d hos_marketplace
--
-- Expect: no rows for "orphan" queries (orphans = referential inconsistency).
-- Counts and schema existence are informational.

\echo '=== Schema existence ==='
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN (
  'auth_service', 'user_service', 'order_service', 'payment_service',
  'product_service', 'seller_service', 'notification_service', 'admin_service', 'influencer_service'
)
ORDER BY 1;

\echo ''
\echo '=== Table counts (key tables) ==='
SELECT 'auth_service.users' AS rel, COUNT(*) AS cnt FROM auth_service.users
UNION ALL SELECT 'seller_service.sellers', COUNT(*) FROM seller_service.sellers
UNION ALL SELECT 'order_service.orders', COUNT(*) FROM order_service.orders
UNION ALL SELECT 'product_service.products', COUNT(*) FROM product_service.products;

\echo ''
\echo '=== Orphan check: orders with userId not in auth_service.users ==='
SELECT o.id AS order_id, o."userId", o."orderNumber"
FROM order_service.orders o
LEFT JOIN auth_service.users u ON u.id = o."userId"
WHERE u.id IS NULL
LIMIT 20;

\echo ''
\echo '=== Orphan check: orders with sellerId not in seller_service.sellers ==='
SELECT o.id AS order_id, o."sellerId", o."orderNumber"
FROM order_service.orders o
LEFT JOIN seller_service.sellers s ON s.id = o."sellerId"
WHERE s.id IS NULL
LIMIT 20;

\echo ''
\echo '=== Cross-schema view sanity (row counts) ==='
SELECT 'order_service.v_users' AS view_name, COUNT(*) AS cnt FROM order_service.v_users
UNION ALL SELECT 'order_service.v_sellers', COUNT(*) FROM order_service.v_sellers
UNION ALL SELECT 'payment_service.v_orders', COUNT(*) FROM payment_service.v_orders
UNION ALL SELECT 'influencer_service.v_products', COUNT(*) FROM influencer_service.v_products;

\echo ''
\echo '=== Done ==='

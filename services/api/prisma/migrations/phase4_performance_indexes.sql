-- Phase 4: Performance Optimization - Database Indexes
-- These indexes improve query performance for common operations

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_seller_active ON products(seller_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_fandom ON products(fandom) WHERE fandom IS NOT NULL;

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Cart indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Product reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON product_reviews(user_id);

-- Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist_items(product_id);

-- Address indexes
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON addresses(user_id, is_default) WHERE is_default = true;

-- Seller indexes
CREATE INDEX IF NOT EXISTS idx_sellers_verified ON sellers(verified) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_sellers_slug ON sellers(slug);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Composite index for product search
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Note: GIN index requires pg_trgm extension for full-text search
-- Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;


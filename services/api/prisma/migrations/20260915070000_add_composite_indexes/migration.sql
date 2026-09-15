-- Composite indexes for common query patterns (idempotent)
CREATE INDEX IF NOT EXISTS "users_email_deletedAt_idx" ON "users"("email", "deletedAt");
CREATE INDEX IF NOT EXISTS "users_role_deletedAt_idx" ON "users"("role", "deletedAt");
CREATE INDEX IF NOT EXISTS "products_categoryId_status_idx" ON "products"("categoryId", "status");
CREATE INDEX IF NOT EXISTS "orders_sellerId_status_idx" ON "orders"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "orders_userId_status_idx" ON "orders"("userId", "status");
CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_customerId_createdAt_idx" ON "Transaction"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_type_createdAt_idx" ON "Transaction"("type", "createdAt");

-- Seed per-market PermissionRole templates for multi-country expansion.
-- These complement the existing system ADMIN role (pr-admin) with
-- market-scoped role templates that can be assigned with scopeType=MARKET.

INSERT INTO "permission_roles" ("id", "name", "permissions", "scopeKind", "isSystem", "createdAt", "updatedAt")
VALUES
  ('pr-market-admin', 'Market Admin', '["products.manage","orders.manage","orders.view","users.view","users.manage","shipping.manage","loyalty.manage","loyalty.view","marketing.manage","founding_members.manage","analytics.view","settings.view"]'::jsonb, 'MARKET', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pr-market-finance', 'Market Finance', '["orders.view","orders.manage","analytics.view","settings.view","payments.view"]'::jsonb, 'MARKET', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pr-market-marketing', 'Market Marketing', '["marketing.manage","founding_members.manage","founding_members.view","loyalty.view","analytics.view"]'::jsonb, 'MARKET', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pr-market-catalog', 'Market Catalog', '["products.manage","products.view"]'::jsonb, 'MARKET', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pr-market-support', 'Market Support', '["orders.view","users.view","loyalty.view","shipping.view"]'::jsonb, 'MARKET', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "permissions" = EXCLUDED."permissions",
  "scopeKind" = EXCLUDED."scopeKind",
  "isSystem" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

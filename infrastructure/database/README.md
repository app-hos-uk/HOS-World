# Database Schema Decomposition (Phase 4)

## Overview

Phase 4 introduces per-service PostgreSQL schemas to enforce data ownership
boundaries between microservices. All services still share a single PostgreSQL
instance (same database), but each service's tables live in a dedicated schema.

## Current State

| Service      | Schema               | Port | Prisma multiSchema | Cross-Schema Views |
|--------------|---------------------|------|--------------------|--------------------|
| Monolith API | public              | 3001 | No                 | N/A                |
| Auth         | auth_service        | 3005 | Yes                | -                  |
| User         | user_service        | 3006 | Yes                | -                  |
| Product      | product_service     | 3007 | Yes                | -                  |
| Order        | order_service       | 3008 | Yes                | v_users, v_sellers |
| Payment      | payment_service     | 3009 | Yes                | v_orders           |
| Notification | notification_service| 3003 | Yes                | v_users            |
| Search       | search_service + product_service (read) | 3004 | Yes | - |
| Inventory    | inventory_service   | 3010 | Yes                | -                  |
| Seller       | seller_service      | 3011 | Yes                | -                  |
| Influencer   | influencer_service  | 3012 | Yes                | v_products         |
| Content      | content_service     | 3013 | Yes                | -                  |
| Admin        | admin_service       | 3014 | Yes                | v_users            |

## How It Works

### Prisma multiSchema

Each microservice's `prisma/schema.prisma` uses the `multiSchema` preview feature:

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../node_modules/.prisma/<service>-client"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["<service>_service"]
}

model MyModel {
  id String @id @default(uuid())
  // ...
  @@map("my_table")
  @@schema("<service>_service")
}
```

### DATABASE_URL

Each service's `DATABASE_URL` in docker-compose.yml includes `?schema=<service>_service`:

```
DATABASE_URL=postgresql://user:pass@postgres:5432/hos_marketplace?schema=auth_service
```

### Cross-Schema Views

When a service needs to read data owned by another service, a read-only SQL view
is created in the consuming service's schema. Views are defined in `init-schemas.sh`:

- `order_service.v_users` -- user email/name from auth_service
- `order_service.v_sellers` -- seller info from seller_service
- `notification_service.v_users` -- user email for sending notifications
- `admin_service.v_users` -- user info for activity/support dashboards
- `payment_service.v_orders` -- order info for payment reconciliation
- `influencer_service.v_products` -- product info for influencer links

### Cross-Service Writes

Cross-service writes are **forbidden**. Use the Redis event bus instead:
- Order service emits `order.order.created` -- notification service reacts
- Product service emits `product.product.updated` -- search service re-indexes
- Auth service emits `auth.user.registered` -- user service creates profile

## Files

| File | Purpose |
|------|---------|
| `init-schemas.sh` | Mounted into PostgreSQL container; creates schemas, grants, views |
| `schema-decomposition.sql` | Reference document with schema mapping |
| `README.md` | This file |

## Migration Steps (already completed)

1. Added `previewFeatures = ["multiSchema"]` and `schemas = [...]` to all 12 service Prisma schemas
2. Added `@@schema("<service>_service")` to every model and enum in each service
3. Updated `DATABASE_URL` in docker-compose.yml with `?schema=<service>_service`
4. Updated `init-schemas.sh` with schema creation, grants, default privileges, and cross-schema views

## Next Steps (Phase 5)

- Create per-service PostgreSQL users with restricted schema access
- Move high-traffic schemas to separate database instances
- Replace remaining cross-schema SQL views with event-driven data replication

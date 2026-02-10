# Database Schema Decomposition (Phase 4)

## Overview

Phase 4 introduces per-service PostgreSQL schemas to enforce data ownership
boundaries between microservices. All services still share a single PostgreSQL
instance (same database), but each service's tables live in a dedicated schema.

## Migration Strategy

### Step 1: Create Schemas
Run `schema-decomposition.sql` against your PostgreSQL database:

```bash
psql $DATABASE_URL -f infrastructure/database/schema-decomposition.sql
```

### Step 2: Update Service DATABASE_URL
Append `?schema=<service_schema>` to each service's `DATABASE_URL`:

```
# Example for auth-service:
DATABASE_URL=postgresql://user:pass@host:5432/hos_marketplace?schema=auth_service
```

### Step 3: Migrate Tables Gradually
For each service, update the Prisma schema to use the new schema and run:

```bash
cd services/<service>
npx prisma migrate dev --name move-to-own-schema
```

### Step 4: Cross-Schema Views (Optional)
If a service needs to read data from another service's schema, create a
read-only SQL view. See examples in `schema-decomposition.sql`.

## Schema Mapping

| Service     | Schema             | Port | Tables                                          |
|-------------|-------------------|------|------------------------------------------------|
| Auth        | auth_service      | 3005 | users, refresh_tokens, oauth_accounts, ...      |
| User        | user_service      | 3006 | customers, addresses, customer_groups, ...      |
| Product     | product_service   | 3007 | products, categories, attributes, tags, ...     |
| Order       | order_service     | 3008 | orders, carts, returns, gift_cards, ...         |
| Payment     | payment_service   | 3009 | payments, transactions, settlements, ...        |
| Notification| notification_service | 3003 | notifications, whatsapp_*, ...               |
| Search      | search_service    | 3004 | (mostly Elasticsearch/Meilisearch)              |
| Inventory   | inventory_service | 3010 | warehouses, inventory, shipping, fulfillment, ...|
| Seller      | seller_service    | 3011 | sellers, submissions, reviews, themes, ...      |
| Influencer  | influencer_service| 3012 | influencers, storefronts, campaigns, ...         |
| Content     | content_service   | 3013 | promotions, badges, quests, fandoms, ...        |
| Admin       | admin_service     | 3014 | activity_logs, support_tickets, webhooks, ...   |

## Important Notes

- **This is a gradual migration.** Services continue to work against the
  `public` schema until explicitly migrated.
- **Cross-service writes are forbidden.** Use events (Redis) for inter-service
  communication.
- **Cross-service reads** should go through the API Gateway or event-driven
  data replication, not direct database queries.
- **Phase 5** will introduce per-service database users for security hardening.

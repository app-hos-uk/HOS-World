# Phase 2 — POS Integration: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-2-pos`  
**Base:** `feature/loyalty-phase-1` (all Phase 1 work merged)  
**Estimated:** 5–6 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [POS Adapter Interface & Types](#3-pos-adapter-interface--types)
4. [POS Adapter Factory](#4-pos-adapter-factory)
5. [Lightspeed X-Series Adapter](#5-lightspeed-x-series-adapter)
6. [Sync Services](#6-sync-services)
7. [Webhook Controller](#7-webhook-controller)
8. [In-Store Loyalty Flow](#8-in-store-loyalty-flow)
9. [BullMQ Jobs & Scheduling](#9-bullmq-jobs--scheduling)
10. [Admin API Endpoints](#10-admin-api-endpoints)
11. [Admin UI Pages](#11-admin-ui-pages)
12. [API Client Extensions](#12-api-client-extensions)
13. [Environment Variables](#13-environment-variables)
14. [Testing Strategy](#14-testing-strategy)
15. [Migration & Seed Script](#15-migration--seed-script)
16. [Acceptance Criteria](#16-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 2, confirm:

- [ ] Phase 1 code compiles with zero TypeScript errors (`npx tsc --noEmit`)
- [ ] All 14+ Phase 1 loyalty tests pass (`npx jest --testPathPattern=loyalty`)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1 models exist and are functional:
  - `Store` (with `code`, `sellerId`, `posConnection` relation)
  - `POSConnection` (provider, credentials, externalOutletId, syncStatus)
  - `ExternalEntityMapping` (provider, entityType, internalId, externalId, storeId)
  - `ProductChannel` (channelType, storeId, sellingPrice)
  - `LoyaltyMembership` (cardNumber, currentBalance, tier)
- [ ] `ChannelsService` is operational (assign/remove product channels, resolve price)
- [ ] `InventoryService` exists with `reserveStock`, `recordStockMovement`, `upsertInventoryLocation`
- [ ] `DiscrepanciesService` exists for logging stock discrepancies
- [ ] `EncryptionService` exists at `services/api/src/integrations/encryption.service.ts`

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

No new models needed — Phase 1 already created `POSConnection`, `ExternalEntityMapping`, and `Store`. Phase 2 uses these as-is.

### 2.2 Model Additions

Add to `POSConnection`:

```prisma
model POSConnection {
  // ... existing fields ...
  webhookSecret    String?          // HMAC secret for validating inbound webhooks
  autoSyncProducts Boolean @default(true)
  autoSyncInventory Boolean @default(true)
  syncIntervalMinutes Int  @default(60)
}
```

Add to `Store`:

```prisma
model Store {
  // ... existing fields ...
  externalStoreId  String?          // external POS store/outlet reference
}
```

Add a `POSSale` model for imported in-store sales:

```prisma
model POSSale {
  id              String    @id @default(uuid())
  storeId         String
  store           Store     @relation(fields: [storeId], references: [id])
  externalSaleId  String
  externalInvoice String?
  provider        String
  saleDate        DateTime
  customerId      String?   // HOS userId if matched
  customerEmail   String?
  totalAmount     Decimal   @db.Decimal(10, 2)
  currency        String    @default("GBP")
  taxAmount       Decimal   @default(0) @db.Decimal(10, 2)
  discountAmount  Decimal   @default(0) @db.Decimal(10, 2)
  loyaltyPointsEarned   Int @default(0)
  loyaltyPointsRedeemed Int @default(0)
  items           POSSaleItem[]
  status          String    @default("IMPORTED")  // IMPORTED, PROCESSED, CANCELLED
  rawPayload      Json?
  importedAt      DateTime  @default(now())
  processedAt     DateTime?

  @@unique([provider, externalSaleId])
  @@index([storeId])
  @@index([customerId])
  @@index([saleDate])
  @@map("pos_sales")
}

model POSSaleItem {
  id              String   @id @default(uuid())
  saleId          String
  sale            POSSale  @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId       String?  // HOS product ID if matched
  externalProductId String?
  sku             String?
  name            String
  quantity        Int
  unitPrice       Decimal  @db.Decimal(10, 2)
  totalPrice      Decimal  @db.Decimal(10, 2)
  taxAmount       Decimal  @default(0) @db.Decimal(10, 2)

  @@index([saleId])
  @@index([productId])
  @@map("pos_sale_items")
}
```

### 2.3 Migration

Create `services/api/prisma/migrations/20260425120000_pos_integration_phase2/migration.sql`:

- Idempotent `ALTER TABLE` for `POSConnection` new columns
- Idempotent `ALTER TABLE` for `Store.externalStoreId`
- `CREATE TABLE IF NOT EXISTS` for `pos_sales` and `pos_sale_items`
- Indexes and foreign key constraints
- Same pattern as Phase 1 migration (use `DO $$ ... IF NOT EXISTS ... END $$`)

---

## 3. POS ADAPTER INTERFACE & TYPES

### 3.1 File: `services/api/src/pos/interfaces/pos-types.ts`

Define all shared POS types:

```typescript
export interface POSOutlet {
  externalId: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  isActive: boolean;
}

export interface POSProductPayload {
  internalId: string;
  sku: string;
  name: string;
  description?: string;
  retailPrice: number;
  costPrice?: number;
  taxRate?: number;
  imageUrl?: string;
  categoryName?: string;
  tags?: string[];
  variants?: POSVariantPayload[];
}

export interface POSVariantPayload {
  sku: string;
  name: string;
  retailPrice: number;
  costPrice?: number;
}

export interface POSCustomerPayload {
  internalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  loyaltyCardNumber?: string;
}

export interface POSCustomer {
  externalId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface POSSale {
  externalId: string;
  invoiceNumber?: string;
  saleDate: Date;
  outletId: string;
  customer?: { email?: string; phone?: string; externalId?: string };
  items: POSSaleItem[];
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  currency: string;
  rawPayload?: any;
}

export interface POSSaleItem {
  externalProductId: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
}
```

### 3.2 File: `services/api/src/pos/interfaces/pos-adapter.interface.ts`

```typescript
import {
  POSOutlet,
  POSProductPayload,
  POSCustomerPayload,
  POSCustomer,
  POSSale,
} from './pos-types';

export interface POSAdapter {
  readonly providerName: string;

  // Authentication
  authenticate(credentials: Record<string, any>): Promise<void>;
  refreshAuth(): Promise<void>;

  // Outlets
  getOutlets(): Promise<POSOutlet[]>;

  // Products
  syncProduct(product: POSProductPayload, outletId: string): Promise<string>;
  removeProduct(externalId: string, outletId: string): Promise<void>;

  // Inventory
  getInventory(externalProductId: string, outletId: string): Promise<number>;
  updateInventory(
    externalProductId: string,
    outletId: string,
    quantity: number,
  ): Promise<void>;

  // Customers
  syncCustomer(customer: POSCustomerPayload): Promise<string>;
  lookupCustomer(identifier: string): Promise<POSCustomer | null>;

  // Sales
  getSales(since: Date, outletId?: string): Promise<POSSale[]>;

  // Webhooks
  validateWebhook(payload: any, signature: string, secret: string): boolean;
  parseWebhookSale(payload: any): POSSale;
}
```

---

## 4. POS ADAPTER FACTORY

### File: `services/api/src/pos/pos-adapter.factory.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { POSAdapter } from './interfaces/pos-adapter.interface';
import { LightspeedAdapter } from './adapters/lightspeed/lightspeed.adapter';
import { EncryptionService } from '../integrations/encryption.service';

@Injectable()
export class POSAdapterFactory {
  constructor(private encryption: EncryptionService) {}

  create(provider: string, encryptedCredentials: string): POSAdapter {
    const credentials = JSON.parse(
      this.encryption.decrypt(encryptedCredentials),
    );

    switch (provider.toLowerCase()) {
      case 'lightspeed':
        return new LightspeedAdapter(credentials);
      // Future: case 'square': return new SquareAdapter(credentials);
      // Future: case 'shopify': return new ShopifyPOSAdapter(credentials);
      default:
        throw new BadRequestException(
          `POS provider "${provider}" is not supported. Supported: lightspeed`,
        );
    }
  }
}
```

---

## 5. LIGHTSPEED X-SERIES ADAPTER

### 5.1 Directory: `services/api/src/pos/adapters/lightspeed/`

Create four files:

#### `lightspeed-api.client.ts`
- HTTP client wrapping Lightspeed X-Series (Vend) REST API v2
- Base URL: `https://{domain_prefix}.vendhq.com/api/2.0/`
- Rate limiting: respect `retry-after` header (bucket-based); implement token bucket with default 40 req/min
- Retry: exponential backoff with jitter (3 attempts, base delay 1s)
- Methods: `get<T>(path)`, `post<T>(path, body)`, `put<T>(path, body)`, `delete(path)`
- All methods include `Authorization: Bearer {token}` header
- Log all 4xx/5xx responses at WARN level

#### `lightspeed-auth.service.ts`
- OAuth2 token management for Lightspeed
- `authenticate(credentials)` — exchanges `client_id`, `client_secret`, `code` for access + refresh tokens via `POST /api/1.0/token`
- `refreshAuth()` — uses stored refresh token to get new access token
- Token auto-refresh: if access token expires within 5 minutes, pre-emptively refresh
- Store tokens in memory (per-adapter instance, not in DB — credentials field holds the refresh token)

#### `lightspeed.mapper.ts`
Bidirectional data transformation:

| Direction | HOS Field | Lightspeed Field |
|-----------|-----------|------------------|
| HOS → LS | `product.name` | `name` |
| HOS → LS | `product.sku` | `sku` |
| HOS → LS | channel `sellingPrice` | `retail_price` |
| HOS → LS | `costPrice` | `supply_price` |
| HOS → LS | first product image URL | `image_url` |
| HOS → LS | fandom/category | `product_type` or `tag` |
| LS → HOS | `register_sale` | `POSSale` |
| LS → HOS | `register_sale_product` | `POSSaleItem` |
| LS → HOS | `customer` | `POSCustomer` |
| LS → HOS | `outlet` | `POSOutlet` |

#### `lightspeed.adapter.ts`
- Implements `POSAdapter`
- `providerName = 'lightspeed'`
- Composes `LightspeedApiClient`, `LightspeedAuthService`, `LightspeedMapper`
- Each method maps HOS types ↔ Lightspeed types using the mapper
- `syncProduct`: `POST /products` (create) or `PUT /products/{id}` (update if mapping exists)
- `removeProduct`: `DELETE /products/{id}`
- `getInventory`: `GET /products/{id}/inventory` → return outlet-specific quantity
- `updateInventory`: `POST /consignments` (stock adjustment consignment)
- `syncCustomer`: `POST /customers` or `PUT /customers/{id}`
- `lookupCustomer`: `GET /customers?email={email}` or `GET /customers?phone={phone}`
- `getSales`: `GET /register_sales?date_from={ISO}&outlet_id={id}&page_size=200` with pagination
- `validateWebhook`: HMAC-SHA256 signature check against webhook secret
- `parseWebhookSale`: map the Lightspeed webhook payload to `POSSale`

---

## 6. SYNC SERVICES

### Directory: `services/api/src/pos/sync/`

### 6.1 `product-sync.service.ts`

**Core logic:**
1. On product update/publish → get all `ProductChannel` records where `channelType = 'STORE'`
2. For each channel → find the `Store` → find its active `POSConnection`
3. If `posConnection.autoSyncProducts === false`, skip
4. Get adapter from factory
5. Build `POSProductPayload` using channel-specific price (`ProductChannel.sellingPrice`)
6. Check `ExternalEntityMapping` for existing mapping
   - If mapping exists → call `adapter.syncProduct(...)` (update)
   - If no mapping → call `adapter.syncProduct(...)` (create) → save returned external ID to `ExternalEntityMapping`
7. Update `ExternalEntityMapping.lastSyncedAt` and `syncStatus = 'SYNCED'`
8. On error → set `syncStatus = 'FAILED'`, `syncError = message`

**Product NEVER synced if:** no `ProductChannel` assignment for that store.

**Trigger points:**
- Product published (after submission pipeline completes)
- Product updated (price, name, images, stock)
- Channel assignment created/removed
- Manual sync from admin UI

### 6.2 `inventory-sync.service.ts`

**Online sale → POS stock decrement:**
1. After order confirmation, for each order item:
   - Find `ExternalEntityMapping` for the product + store
   - If mapping exists → get POS adapter → `adapter.updateInventory(externalId, outletId, -quantity)`
   - Log stock movement via `InventoryService.recordStockMovement` with `movementType = 'POS_SYNC_OUT'`

**POS sale → HOS stock decrement:**
1. When POS sale is imported (via webhook or polling):
   - For each sale item, resolve HOS `productId` via `ExternalEntityMapping` (entityType = 'PRODUCT', externalId = sale item's product ID)
   - Call `InventoryService.recordStockMovement` with `movementType = 'POS_SALE'`, quantity = -saleItem.quantity
   - If product not mapped, log warning but don't fail

**Nightly reconciliation job:**
1. For each store with active POS connection:
   - For each mapped product → call `adapter.getInventory(externalId, outletId)`
   - Compare POS quantity with HOS `InventoryLocation` quantity for that store's warehouse
   - If discrepancy > threshold (configurable, default 0) → log via `DiscrepanciesService`
   - Generate reconciliation report in `POSConnection.settings.lastReconciliation`

### 6.3 `customer-sync.service.ts`

**Push on enrollment:**
1. When a customer enrolls in The Enchanted Circle → for each HOS store with active POS:
   - Build `POSCustomerPayload` (name, email, phone, loyaltyCardNumber)
   - Call `adapter.syncCustomer(...)` → save mapping to `ExternalEntityMapping` (entityType = 'CUSTOMER')
2. Lightweight — only name, email, phone, card number. Full profile stays in HOS.

**Lookup for POS checkout:**
1. POS calls `POST /api/v1/loyalty/lookup` (already exists from Phase 1)
2. Returns membership data for display at register

### 6.4 `sales-import.service.ts`

**Import logic:**
1. Receive `POSSale` (from webhook or polling)
2. Deduplicate: check `POSSale` table by `(provider, externalSaleId)` — if exists, skip
3. Resolve customer: match by email/phone → set `customerId`
4. Resolve products: for each item, lookup `ExternalEntityMapping` → set `productId`
5. Create `POSSale` + `POSSaleItem` records
6. **Trigger loyalty earn**: if customer matched and has membership → call `loyaltyService.processInStoreSaleEarn(saleId)` (new method, see §8)
7. **Trigger inventory sync**: decrement HOS stock per item
8. Set `status = 'PROCESSED'`, `processedAt = now()`

---

## 7. WEBHOOK CONTROLLER

### File: `services/api/src/pos/webhooks/pos-webhook.controller.ts`

```
POST /api/v1/pos/webhooks/:provider/:storeCode
```

**Flow:**
1. Find `Store` by `code` param
2. Find `POSConnection` by `storeId` + `provider` param
3. Get adapter from factory
4. Validate webhook signature: `adapter.validateWebhook(body, headers['x-webhook-signature'], connection.webhookSecret)`
5. If invalid → 401
6. Parse sale: `adapter.parseWebhookSale(body)`
7. Enqueue processing via BullMQ job (`POS_SALE_IMPORT`) for async handling
8. Return `200 OK` immediately (webhook response must be fast)

**Idempotency:** The `sales-import.service.ts` deduplicates by `(provider, externalSaleId)`.

**Webhook registration:** Manual or via admin API — store the webhook URL in Lightspeed dashboard: `https://{api-domain}/api/v1/pos/webhooks/lightspeed/{storeCode}`

---

## 8. IN-STORE LOYALTY FLOW

### 8.1 POS Checkout Integration (API endpoints already exist from Phase 1)

The POS system calls HOS APIs during checkout:

| Step | POS Action | HOS API Call |
|------|-----------|-------------|
| 1 | Staff scans QR / enters phone/email | `POST /api/v1/loyalty/lookup` → returns membership + tier + balance |
| 2 | Customer wants to redeem | `POST /api/v1/loyalty/redeem` with `channel: 'HOS_OUTLET_POS'`, `storeId` |
| 3 | Sale completes | POS sends webhook → `sales-import` → loyalty earn |

### 8.2 New Method: `LoyaltyService.processInStoreSaleEarn`

Add to `services/api/src/loyalty/loyalty.service.ts`:

```typescript
async processInStoreSaleEarn(posSaleId: string): Promise<void> {
  // 1. Fetch POSSale with items
  // 2. If no customerId or no membership → skip
  // 3. For each item with a resolved productId → find product's seller
  // 4. Calculate base points (same logic as earn engine, but source = 'POS_PURCHASE')
  // 5. Apply campaigns (channel = store's channel code)
  // 6. Apply tier multiplier
  // 7. Wallet credit + LoyaltyTransaction + POSSale.loyaltyPointsEarned update
  // 8. Recalculate tier
}
```

This mirrors `EarnEngine.processOrderComplete` but operates on `POSSale` instead of `Order`.

---

## 9. BULLMQ JOBS & SCHEDULING

### 9.1 New Job Types

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
export enum JobType {
  // ... existing ...
  POS_PRODUCT_SYNC    = 'pos:product-sync',
  POS_INVENTORY_SYNC  = 'pos:inventory-sync',
  POS_SALE_IMPORT     = 'pos:sale-import',
  POS_NIGHTLY_RECON   = 'pos:nightly-reconciliation',
  POS_CUSTOMER_SYNC   = 'pos:customer-sync',
  POS_SALES_POLL      = 'pos:sales-poll',
}
```

### 9.2 Job Processors

Create `services/api/src/pos/jobs/pos.jobs.ts`:

| Job | Trigger | Processor Logic |
|-----|---------|-----------------|
| `POS_PRODUCT_SYNC` | Product update, channel assignment, manual | Calls `productSyncService.syncProduct(productId, storeId)` |
| `POS_INVENTORY_SYNC` | Order confirmed, POS sale imported | Calls `inventorySyncService.syncInventory(productId, storeId, delta)` |
| `POS_SALE_IMPORT` | Webhook received, polling | Calls `salesImportService.importSale(posSale, storeId)` |
| `POS_NIGHTLY_RECON` | Cron `0 2 * * *` | Calls `inventorySyncService.nightlyReconciliation()` |
| `POS_CUSTOMER_SYNC` | Loyalty enrollment | Calls `customerSyncService.syncToAllStores(userId)` |
| `POS_SALES_POLL` | Cron `*/15 * * * *` | Calls `salesImportService.pollAllStores()` — fallback for stores without webhooks |

### 9.3 Cron Registration

In `pos.jobs.ts` `onModuleInit`:
- Register all processors
- Schedule `POS_NIGHTLY_RECON` at `0 2 * * *` (2 AM daily)
- Schedule `POS_SALES_POLL` at `*/15 * * * *` (every 15 min) — configurable via `POS_SALES_POLL_CRON`

---

## 10. ADMIN API ENDPOINTS

### Controller: `services/api/src/pos/pos-admin.controller.ts`

All endpoints require `@Roles('ADMIN')` + JWT auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/pos/connections` | List all POS connections with store/seller info |
| `POST` | `/admin/pos/connections` | Create POS connection (encrypt credentials) |
| `PUT` | `/admin/pos/connections/:id` | Update connection settings |
| `DELETE` | `/admin/pos/connections/:id` | Deactivate/remove connection |
| `POST` | `/admin/pos/connections/:id/test` | Test connection (authenticate + getOutlets) |
| `GET` | `/admin/pos/connections/:id/outlets` | Fetch outlets from POS |
| `POST` | `/admin/pos/connections/:id/sync/products` | Trigger full product sync for store |
| `POST` | `/admin/pos/connections/:id/sync/inventory` | Trigger inventory reconciliation |
| `POST` | `/admin/pos/connections/:id/sync/customers` | Trigger customer sync |
| `GET` | `/admin/pos/sales` | List imported POS sales (filterable by store, date) |
| `GET` | `/admin/pos/sales/:id` | Single POS sale detail with items |
| `GET` | `/admin/pos/sync-log` | Recent sync operations with status |
| `GET` | `/admin/pos/discrepancies` | Stock discrepancy report |

### DTOs

Create at `services/api/src/pos/dto/`:

- `create-pos-connection.dto.ts` — `storeId`, `provider`, `credentials` (JSON), `externalOutletId?`, `webhookSecret?`
- `update-pos-connection.dto.ts` — partial of above + `autoSyncProducts`, `autoSyncInventory`, `syncIntervalMinutes`
- `pos-sales-filter.dto.ts` — `storeId?`, `dateFrom?`, `dateTo?`, `status?`, `page`, `limit`

---

## 11. ADMIN UI PAGES

### 11.1 `apps/web/src/app/admin/pos/page.tsx` — POS Dashboard

- **Header:** "POS Integration" with connection count badge
- **Summary cards:** Total connections, Active connections, Products synced, Sales imported (today), Last reconciliation date
- **Quick actions:** "Add Connection", "Run Reconciliation", "Poll Sales Now"

### 11.2 `apps/web/src/app/admin/pos/connections/page.tsx` — Connection Management

- **Table:** Store name, Provider, Status (Active/Inactive/Error), Last sync, Sync status (pill badge)
- **Row actions:** Test, Edit, Sync Products, Sync Inventory, Deactivate
- **Add Connection modal:**
  - Select store (dropdown of stores without POS connections)
  - Select provider (Lightspeed)
  - Credentials form (client_id, client_secret, domain_prefix)
  - OAuth flow initiation button
  - Test connection button

### 11.3 `apps/web/src/app/admin/pos/sync/page.tsx` — Sync Status

- **Sync log table:** Timestamp, Store, Type (Product/Inventory/Customer/Sale), Direction, Status, Details
- **Filters:** Store, type, status, date range
- **Manual trigger buttons per store**

### 11.4 `apps/web/src/app/admin/pos/stores/page.tsx` — Outlet Management

- **Table:** Store name, Code, City, Country, POS Provider, External Outlet ID, Products assigned, Is active
- **Row action:** "Fetch Outlets from POS" → list POS outlets → link to HOS store

### Design Notes

- Use existing admin layout and Tailwind component patterns
- All tables should use the existing `DataTable` or similar pattern from the admin area
- Status pills: green = SYNCED, yellow = SYNCING, red = FAILED, grey = NEVER_SYNCED
- Loading states and error boundaries per page

---

## 12. API CLIENT EXTENSIONS

### Add to `packages/api-client/src/client.ts`:

```typescript
// POS Admin
getPosConnections(): Promise<POSConnection[]>
createPosConnection(data: CreatePosConnectionDto): Promise<POSConnection>
updatePosConnection(id: string, data: UpdatePosConnectionDto): Promise<POSConnection>
deletePosConnection(id: string): Promise<void>
testPosConnection(id: string): Promise<{ success: boolean; outlets: POSOutlet[]; error?: string }>
getPosOutlets(connectionId: string): Promise<POSOutlet[]>
triggerProductSync(connectionId: string): Promise<{ jobId: string }>
triggerInventorySync(connectionId: string): Promise<{ jobId: string }>
triggerCustomerSync(connectionId: string): Promise<{ jobId: string }>
getPosSales(filters: PosSalesFilter): Promise<PaginatedResult<POSSale>>
getPosSale(id: string): Promise<POSSaleDetail>
getPosSyncLog(filters?: SyncLogFilter): Promise<SyncLogEntry[]>
getPosDiscrepancies(filters?: DiscrepancyFilter): Promise<StockDiscrepancy[]>
```

---

## 13. ENVIRONMENT VARIABLES

Add to `.env.example` and `services/api/src/config/env.validation.ts`:

```bash
# POS Integration
POS_ENABLED=false                        # Master toggle
POS_WEBHOOK_BASE_URL=                    # e.g. https://api.hosmarketplace.com

# Lightspeed
LIGHTSPEED_CLIENT_ID=
LIGHTSPEED_CLIENT_SECRET=
LIGHTSPEED_REDIRECT_URI=                 # OAuth callback URL

# Sync Configuration
POS_NIGHTLY_RECON_CRON=0 2 * * *
POS_SALES_POLL_CRON=*/15 * * * *
POS_INVENTORY_DISCREPANCY_THRESHOLD=0    # 0 = log all differences
POS_SYNC_BATCH_SIZE=50                   # products per sync batch
```

Add to `EnvSchema` interface and validation function:

```typescript
POS_ENABLED?: string;
POS_WEBHOOK_BASE_URL?: string;
LIGHTSPEED_CLIENT_ID?: string;
LIGHTSPEED_CLIENT_SECRET?: string;
```

Validation warning: if `POS_ENABLED=true` and `LIGHTSPEED_CLIENT_ID` is empty, warn.

---

## 14. TESTING STRATEGY

### 14.1 Unit Tests (Required)

| Test File | What It Tests |
|-----------|---------------|
| `pos/adapters/lightspeed/lightspeed.mapper.spec.ts` | Bidirectional mapping HOS ↔ Lightspeed (products, sales, customers) |
| `pos/adapters/lightspeed/lightspeed-api.client.spec.ts` | Rate limiting, retry logic, error handling (mock HTTP) |
| `pos/pos-adapter.factory.spec.ts` | Factory returns correct adapter, throws on unknown provider |
| `pos/sync/product-sync.service.spec.ts` | Product sync creates/updates mapping, skips unassigned stores, handles errors |
| `pos/sync/inventory-sync.service.spec.ts` | Stock adjustments in both directions, reconciliation discrepancy detection |
| `pos/sync/sales-import.service.spec.ts` | Deduplication, customer matching, product resolution, loyalty trigger |
| `pos/webhooks/pos-webhook.controller.spec.ts` | Signature validation, request routing, idempotency |

### 14.2 Integration Tests (Recommended)

| Scenario | Description |
|----------|-------------|
| Full product sync round-trip | Create product → assign channel → trigger sync → verify mapping created |
| Online sale → POS stock | Create order → confirm → verify POS inventory job enqueued |
| POS webhook → HOS stock + loyalty | Simulate webhook → verify sale imported + stock decremented + points earned |
| Nightly reconciliation | Seed discrepancy → run job → verify discrepancy logged |
| Customer enrollment → POS push | Enroll customer → verify customer sync job enqueued |

### 14.3 Mock Strategy

- Mock the Lightspeed HTTP client for all unit tests (never call real API)
- Use `jest.fn()` for `PrismaService` delegates
- Use `jest.fn()` for `InventoryService`, `DiscrepanciesService`, `LoyaltyService`
- For integration tests, use a test database with seeded stores and POS connections

---

## 15. MIGRATION & SEED SCRIPT

### 15.1 Migration File

`services/api/prisma/migrations/20260425120000_pos_integration_phase2/migration.sql`

Use the same idempotent pattern as Phase 1:

```sql
-- New columns on pos_connections
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "autoSyncProducts" BOOLEAN DEFAULT true;
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "autoSyncInventory" BOOLEAN DEFAULT true;
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "syncIntervalMinutes" INTEGER DEFAULT 60;

-- New column on stores
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "externalStoreId" TEXT;

-- POSSale table
CREATE TABLE IF NOT EXISTS "pos_sales" ( ... );
CREATE TABLE IF NOT EXISTS "pos_sale_items" ( ... );

-- Indexes and foreign keys ...
```

### 15.2 Seed Script

`services/api/prisma/seeds/pos-seed.ts` (for dev/staging only):

1. Create sample POS connection for the HOS London Soho store (provider = 'lightspeed', dummy credentials)
2. Create sample `ExternalEntityMapping` entries for 5 products
3. Create 3 sample `POSSale` records with items
4. Print summary

Add script: `"db:seed-pos": "ts-node prisma/seeds/pos-seed.ts"` to `services/api/package.json`.

---

## 16. ACCEPTANCE CRITERIA

Phase 2 is complete when:

- [ ] `POSAdapter` interface exists with all methods defined
- [ ] `LightspeedAdapter` implements the full interface (even if Lightspeed account not yet live)
- [ ] `POSAdapterFactory` creates correct adapter and throws on unknown providers
- [ ] Product sync creates/updates products in POS when channel assignments change
- [ ] Inventory sync decrements POS stock on online sales and HOS stock on POS sales
- [ ] Nightly reconciliation runs and logs discrepancies via `DiscrepanciesService`
- [ ] Webhook endpoint validates signatures and imports POS sales idempotently
- [ ] In-store loyalty lookup works at `POST /loyalty/lookup` (from Phase 1)
- [ ] In-store loyalty redemption works at `POST /loyalty/redeem` with `channel: 'HOS_OUTLET_POS'`
- [ ] POS sales trigger loyalty point earning for identified customers
- [ ] Customer sync pushes lightweight profile to POS on enrollment
- [ ] All admin CRUD endpoints work for POS connections
- [ ] Admin UI shows connections, sync status, imported sales, discrepancies
- [ ] All BullMQ jobs register and can be triggered manually or by cron
- [ ] All unit tests pass (≥ 7 test files, ≥ 25 tests)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Prisma migration applies cleanly via `prisma migrate deploy`

---

## FILE TREE (New & Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED
│   ├── migrations/
│   │   └── 20260425120000_pos_integration_phase2/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── pos-seed.ts                                  # NEW
├── src/
│   ├── pos/
│   │   ├── pos.module.ts                                # NEW
│   │   ├── pos-adapter.factory.ts                       # NEW
│   │   ├── interfaces/
│   │   │   ├── pos-adapter.interface.ts                 # NEW
│   │   │   └── pos-types.ts                             # NEW
│   │   ├── adapters/
│   │   │   └── lightspeed/
│   │   │       ├── lightspeed.adapter.ts                # NEW
│   │   │       ├── lightspeed-auth.service.ts           # NEW
│   │   │       ├── lightspeed-api.client.ts             # NEW
│   │   │       ├── lightspeed.mapper.ts                 # NEW
│   │   │       └── lightspeed.mapper.spec.ts            # NEW
│   │   ├── sync/
│   │   │   ├── product-sync.service.ts                  # NEW
│   │   │   ├── product-sync.service.spec.ts             # NEW
│   │   │   ├── inventory-sync.service.ts                # NEW
│   │   │   ├── inventory-sync.service.spec.ts           # NEW
│   │   │   ├── customer-sync.service.ts                 # NEW
│   │   │   └── sales-import.service.ts                  # NEW
│   │   │   └── sales-import.service.spec.ts             # NEW
│   │   ├── webhooks/
│   │   │   ├── pos-webhook.controller.ts                # NEW
│   │   │   └── pos-webhook.controller.spec.ts           # NEW
│   │   ├── jobs/
│   │   │   └── pos.jobs.ts                              # NEW
│   │   ├── dto/
│   │   │   ├── create-pos-connection.dto.ts             # NEW
│   │   │   ├── update-pos-connection.dto.ts             # NEW
│   │   │   └── pos-sales-filter.dto.ts                  # NEW
│   │   └── pos-admin.controller.ts                      # NEW
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (new job types)
│   ├── loyalty/
│   │   └── loyalty.service.ts                           # MODIFIED (processInStoreSaleEarn)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (POS env vars)
│   └── app.module.ts                                    # MODIFIED (import POSModule)
├── package.json                                         # MODIFIED (seed script)
packages/
├── api-client/
│   └── src/client.ts                                    # MODIFIED (POS methods)
apps/web/
├── src/app/admin/pos/
│   ├── page.tsx                                         # NEW
│   ├── connections/page.tsx                              # NEW
│   ├── sync/page.tsx                                    # NEW
│   └── stores/page.tsx                                  # NEW
```

---

## BUILD ORDER

Execute in this sequence. After each step, run `npx tsc --noEmit` to verify.

1. **Schema + Migration** — Prisma model changes, generate client
2. **Types + Interface** — `pos-types.ts`, `pos-adapter.interface.ts`
3. **Factory** — `pos-adapter.factory.ts`
4. **Lightspeed Adapter** — all 4 files in `adapters/lightspeed/`
5. **Sync Services** — product, inventory, customer, sales-import
6. **Webhook Controller** — `pos-webhook.controller.ts`
7. **BullMQ Jobs** — job types + `pos.jobs.ts` with cron scheduling
8. **In-Store Loyalty** — `processInStoreSaleEarn` in loyalty service
9. **Admin Controller + DTOs** — `pos-admin.controller.ts` + DTOs
10. **POS Module** — wire everything in `pos.module.ts`, import in `app.module.ts`
11. **Env Validation** — add POS variables
12. **API Client** — add POS methods
13. **Admin UI** — 4 pages
14. **Seed Script** — dev data
15. **Tests** — unit + integration
16. **Final Build** — `tsc --noEmit` + `jest --testPathPattern=pos` + review

---

*Build each step in order. Commit after each logical unit. Ensure all tests pass before proceeding to the next step.*

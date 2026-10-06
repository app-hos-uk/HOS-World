# Phase 0 Audit C — POS (Lightspeed) Integration

**Scope:** House of Spells marketplace, `services/api/src/pos/**`.  
**Date:** 2026-10-06.  
**Intent of the planned change:** stop writing products from HOS into Lightspeed, add a read-only product pull that pre-fills submission forms, and leave sales import, loyalty earn, customer sync, and inventory reconciliation working.

This audit reads the live code paths. It does not change them.

---

## 1. Integration dependency map

Lightspeed is the only adapter (`POSAdapterFactory.create`, `services/api/src/pos/pos-adapter.factory.ts` lines 29–46). Runtime is gated by `POS_ENABLED` **and** `FeatureFlag.POS_INTEGRATION` (`services/api/src/pos/pos-enabled.ts` lines 9–16). Jobs and webhooks no-op when that gate is off (`pos.jobs.ts` lines 37–42, `pos-webhook.controller.ts` lines 44–46).

### 1.1 Flows and what they depend on

| Flow | Direction | Trigger | Depends on product push? | Depends on `ExternalEntityMapping` PRODUCT? | Depends on `ProductChannel`? |
|---|---|---|---|---|---|
| Product push | HOS → Lightspeed | Manual admin job only | — | Writes it | Yes: only active `STORE` channels |
| Sales poll | Lightspeed → HOS | Cron `*/15 * * * *` | No hard dependency | Used first to resolve line `productId` | No |
| Sale webhook | Lightspeed → HOS | `POST /pos/webhooks/:provider/:storeCode` | No | Same resolver as poll | No |
| Loyalty earn on POS sale | Inside sales import | `LoyaltyEarnEngine.processPosSale` | No | Indirect: product-level campaigns need a resolved `productId`. Base earn has a sale-total fallback | No |
| Inventory decrement on POS sale | Lightspeed → HOS | `applyPosSaleToInventory` after first import | No | Yes, via `POSSaleItem.productId`. Unmapped lines are skipped | No |
| Nightly stock reconciliation | Lightspeed read vs HOS | Cron `0 2 * * *` and admin “Sync inventory” | Mappings must already exist | Yes. Only rows with `syncStatus: 'SYNCED'` | No |
| Online order → POS stock | HOS → Lightspeed **write** | After payment in `payments.service.ts` | Mappings must already exist | Yes | Yes: active `STORE` channels |
| Customer push | HOS → Lightspeed | Job `POS_CUSTOMER_SYNC` | No | No (uses `CUSTOMER` mappings) | No |
| Customer import | Lightspeed → HOS (+ stamp write-back) | Admin + daily cron (cron is dry-run; see bugs) | No | No | No |
| Customer identity backfill | Lightspeed → HOS | Admin / job | No | No | No |
| Sale customer-link backfill | Local DB | Admin / job | No | No (`CUSTOMER` only) | No |
| Gift card recon | Lightspeed ↔ HOS | Cron `0 */6 * * *` | No | No | No |
| Ship-from-store sale lookup | Lightspeed read, then `importParsedSale` | Customer claim flow | No | Same product resolver. This path **does** hydrate SKUs | No |

Product push is **not** on the cron schedule. `scheduleCrons` (`pos.jobs.ts` lines 171–189) registers only:

- `POS_NIGHTLY_RECON` — default `0 2 * * *`
- `POS_SALES_POLL` — default `*/15 * * * *`
- `POS_GIFT_CARD_RECON` — default `0 */6 * * *`
- `POS_CUSTOMER_IMPORT` — hardcoded `0 3 * * *`

`POSConnection.syncIntervalMinutes` is stored and editable. Nothing in `pos.jobs.ts` reads it.

### 1.2 How a till sale becomes loyalty and stock

```
Lightspeed sale
  ├─ webhook  → queue POS_SALE_IMPORT
  └─ poll     → pollStoreSales (cursor settings.lastSaleVersion)
        └─ importParsedSale
              ├─ void  → reversePosSaleEarn (if already earned)
              ├─ return → persist RETURN, loyaltyReversal.onPosReturnCompleted
              └─ closed sale (new)
                    ├─ resolveCustomerId (CUSTOMER mapping / customer_code / card / email / phone)
                    ├─ buildSaleItemCreates (PRODUCT mapping, then SKU)
                    ├─ POSSale + POSSaleItem
                    ├─ applyPosSaleToInventory (only lines with productId)
                    └─ earnEngine.processPosSale
```

Sales import never calls `PosProductSyncService`. Customer sync never reads product mappings. The only shared table is `ExternalEntityMapping`, partitioned by `entityType` (`PRODUCT` vs `CUSTOMER`).

### 1.3 Callers outside `pos/`

| Caller | What it uses | Breaks if product push is disabled? |
|---|---|---|
| `payments.service.ts` lines 583–591 | `syncOnlineOrderToPos` after payment when `POS_ENABLED=true` | Still runs for products that already have a PRODUCT mapping. New products with no mapping are skipped (`inventory-sync.service.ts` lines 115–123) |
| `store-shipment.service.ts` lines 812–841 | `getSaleById` / `getSaleByInvoice`, then `importParsedSale({ refreshItems: true })` | Unaffected. This path hydrates SKUs via `GET /products/{id}` |
| `loyalty` module | `processPosSale` / `reversePosSaleEarn` | Unaffected at the call site. Earn quality depends on whether lines have `productId` (section 3) |

`PosProductSyncService` is constructed by the admin controller and the jobs service. The controller never calls it; the sync-products endpoint only enqueues `POS_PRODUCT_SYNC` (`pos-admin.controller.ts` lines 227–233, `pos.jobs.ts` lines 45–50). No other module calls `syncProductToStore`.

---

## 2. C1 — Product sync (HOS → Lightspeed), to disable

**File:** `services/api/src/pos/sync/product-sync.service.ts`

### 2.1 `syncProductToStore` (lines 17–124)

1. Load the active `POSConnection` for the store. Return immediately when missing or when `autoSyncProducts` is false (lines 18–22).
2. Require an active `ProductChannel` with `channelType: 'STORE'` for that product and store (lines 24–35). No channel → skip. This is the only reason product sync touches `ProductChannel`.
3. Load `Product` with the first image and `categoryRelation` (lines 37–44). No status filter: drafts with a STORE channel are pushed.
4. Outlet id is `connection.externalOutletId` or `store.externalStoreId` (lines 46–50). Missing outlet → skip.
5. Look up `ExternalEntityMapping` where `provider`, `entityType: 'PRODUCT'`, `internalId = productId`, `storeId` (lines 52–59).
6. Decrypt credentials, `adapter.authenticate`, build `POSProductPayload` (lines 61–76):

| Payload field | Source |
|---|---|
| `internalId` | `product.id` |
| `existingExternalId` | mapping `externalId`, if any |
| `sku` | `product.sku`, or `product.id.slice(0, 12)` when SKU is empty (line 68) |
| `name` | `product.name` |
| `description` | `product.description` |
| `retailPrice` | `Number(channel.sellingPrice)` |
| `costPrice` | `channel.costPrice` |
| `imageUrl` | first image URL |
| `categoryName` | category name, else `product.fandom` |
| `tags` | `product.tags` |

`POSProductPayload.variants` exists on the type (`pos-types.ts` lines 11–32) and is never set. `mapProductToVendPayload` ignores variants, tax, and barcode (`lightspeed.mapper.ts` lines 31–41).

7. `adapter.syncProduct(payload, outletId)` (line 79).
8. Upsert the PRODUCT mapping to `syncStatus: 'SYNCED'` (lines 80–102) and stamp the connection `lastSyncedAt` / `syncStatus: 'SYNCED'` (lines 103–106).
9. On error: log, `updateMany` any existing PRODUCT mapping to `FAILED` (lines 110–118), set connection `syncStatus: 'FAILED'` (lines 119–122). A first-time failure does not insert a mapping row, because `updateMany` matches zero rows.

### 2.2 Lightspeed API called by product push

`LightspeedAdapter.syncProduct` (`lightspeed.adapter.ts` lines 81–106):

- Existing mapping → `PUT /products/{existingExternalId}` with the Vend body plus `outlet_id`.
- No mapping → `POST /products`.
- If the response has no `id`, the method returns `product.internalId` (line 101). That HOS uuid is then stored as `externalId`. Later sales will not match it, and the next push will `PUT` a non-existent Lightspeed id.

`removeProduct` (`DELETE /products/{id}`, lines 104–106) is on the adapter interface and is **never called** by product sync, jobs, or the admin controller.

Base URL for these calls is `https://{domainPrefix}.vendhq.com/api/2.0` (`lightspeed-api.client.ts` lines 75–80).

Body written (`lightspeed.mapper.ts` lines 31–41): `name`, `sku`, `description`, `supply_price`, `retail_price`, `image_url`, `product_type`.

### 2.3 `syncAllProductsForStore` (lines 126–134)

Loads every active STORE `ProductChannel` for the store and calls `syncProductToStore` sequentially. There is no batching, progress, or dedupe. A product with two active STORE channels (the unique key includes `currency` and `effectiveFrom`, `schema.prisma` lines 4345) is synced twice. Inside `syncProductToStore`, `productChannel.findFirst` has no `orderBy` (lines 24–31), so the price sent is whichever row Prisma returns first.

Each call is also subject to the client throttle of 1.5s (`lightspeed-api.client.ts` line 4). A large catalog holds the BullMQ worker for `N * 1.5s` plus Lightspeed latency. Per-product errors are swallowed inside `syncProductToStore`, so the bulk job still completes. The connection’s `syncStatus` is whatever the **last** product wrote.

The `autoSyncProducts` check lives inside `syncProductToStore`, not in the job. Queuing “Sync products” while the flag is false still runs the job, and every product returns immediately. The admin UI still toasts “Product sync queued” (`apps/web/src/app/admin/pos/connections/page.tsx` lines 265–269).

### 2.4 What triggers sync

**Manual only.**

- Admin `POST /admin/pos/connections/:id/sync/products` enqueues `JobType.POS_PRODUCT_SYNC` (`pos-admin.controller.ts` lines 227–233).
- The processor calls `syncAllProductsForStore(conn.storeId)` (`pos.jobs.ts` lines 45–50).
- UI button “Sync products” calls `apiClient.triggerPosProductSync` (`connections/page.tsx` lines 696–701, `packages/api-client/src/client.ts` lines 4869–4873).

There is no hook from product publish, channel assignment, or `channels.service.ts`. Assigning a STORE channel does not push.

`autoSyncProducts` defaults:

- Admin create: `dto.autoSyncProducts ?? true` (`pos-admin.controller.ts` line 109). Schema default is also `true` (`schema.prisma` line 4364).
- Store onboarding explicitly sets `false` (`services/api/src/stores/store-onboarding.service.ts` line 141).

The flag is a gate on the manual job. It is not a scheduler.

### 2.5 Does sales import require a prior product sync?

**No, as a precondition.** `importParsedSale` never checks that products were synced. It still **uses** PRODUCT mappings when they exist (section 3).

Practical consequence of disabling push:

- Products already pushed keep their mapping rows. Till lines for those Lightspeed ids still resolve.
- Products that were never pushed resolve only when the sale line carries a real SKU that matches `Product.sku`.
- Poll and webhook do **not** call `GET /products/{id}` to fill missing SKUs. List/webhook lines that only have `product.id` are stored as `sku: "ls:{id}"` (`lightspeed.mapper.ts` lines 134–142). Those lines do not SKU-match (`sales-import.service.ts` lines 856–862). They need a PRODUCT mapping.
- Ship-from-store does hydrate SKUs (`lightspeed.adapter.ts` lines 407–444, used by `getSaleById` lines 506–507) and can then SKU-match without a mapping.

So disabling push does not stop sales import. It stops **new** till-only products from getting a `productId` on the poll/webhook path until a pull (or a SKU match) creates the link.

### 2.6 `ProductChannel`

Needed for product push and for `syncOnlineOrderToPos` (which STORE to push online stock into). **Not** read by sales import, loyalty earn, customer sync, webhooks, or nightly reconciliation.

Do not drop the model or the STORE channel rows when disabling push. Online pricing and the online-order stock path still read them.

### 2.7 `ExternalEntityMapping` `entityType: 'PRODUCT'`

Schema (`schema.prisma` lines 4648–4670):

- Unique `(provider, entityType, internalId, storeId)`
- Unique `(provider, entityType, externalId, storeId)`
- `storeId` defaults to `""` (account-level sentinel). Product push writes the **HOS store id**, not `""`. Customer mappings use `""`.

Readers of PRODUCT mappings:

| Reader | Lookup key | File |
|---|---|---|
| Product push | `internalId + storeId` | `product-sync.service.ts` 52–59 |
| Sales import | `externalId + storeId` | `sales-import.service.ts` 846–854 |
| Nightly recon | all `SYNCED` for `storeId` | `inventory-sync.service.ts` 163–170 |
| Online order stock push | `internalId + storeId` | `inventory-sync.service.ts` 115–123 |

Sales import **does** use PRODUCT mappings to resolve products. It does not require product push to keep running, and it does not create PRODUCT mappings itself.

---

## 3. C2 — Sales import (Lightspeed → HOS), to keep

**File:** `services/api/src/pos/sync/sales-import.service.ts`

### 3.1 Product resolution (`buildSaleItemCreates`, lines 841–881)

For each line, in order:

1. If `externalProductId` is set, `externalEntityMapping.findFirst` where `provider`, `entityType: 'PRODUCT'`, `externalId`, **and `storeId`** (lines 845–854). Hit → `productId = mapping.internalId`.
2. If still null and `sku` is present and does **not** start with `ls:`, `product.findFirst({ where: { sku: catalogSku } })` (lines 856–862). First row wins.
3. Otherwise `productId` stays null. The line is still inserted with `externalProductId`, `sku`, `name`, prices.

`Product.sku` is optional and indexed, not unique (`schema.prisma` lines 664 and 740). `findFirst` can attach the wrong HOS product when two sellers share a SKU.

A non-finite quantity, or a quantity that truncates to 0, **throws** and aborts the whole sale (lines 864–868). `Math.trunc(0.4)` is 0, so a weighed line under 1 unit fails the import. Because `pollStoreSales` has no per-sale try/catch (lines 933–938) and only advances `lastSaleVersion` after the loop (lines 941–972), one bad line blocks the cursor for that store.

### 3.2 Existing mappings after push is disabled

Disabling push does not delete, expire, or rewrite mapping rows. `syncProduct` is the only writer of PRODUCT mappings. Sales import only reads them.

Rows with `syncStatus: 'SYNCED'` continue to resolve `externalId → internalId` for that store. `FAILED` rows still resolve, because the sales lookup does not filter on `syncStatus` (lines 846–853). Nightly recon **does** filter `syncStatus: 'SYNCED'` (inventory service lines 163–169), so a FAILED mapping still links sales and is skipped by recon.

A mapping whose `externalId` was the bogus fallback `product.internalId` (adapter line 101) will not match real Lightspeed product ids. Those lines fall through to SKU match.

### 3.3 Sale line with no HOS product

The sale is still stored. Effects:

- `POSSaleItem.productId` is null. `externalProductId` and `sku` are kept (lines 870–879).
- Inventory: `applyPosSaleToInventory` skips lines with no `productId` or `quantity <= 0` (`inventory-sync.service.ts` lines 62–63). No stock movement, no error.
- Loyalty: `processPosSale` skips lines whose `product` relation is null (`earn.engine.ts` lines 1082–1084). If **every** line is unmapped, it falls back to earn on `totalAmount - taxAmount` (lines 1118–1131). If **some** lines map, only those lines earn; the unmapped revenue is omitted and the total fallback does not run. Product and brand campaign bonuses only apply to mapped lines (`lines` array, lines 1108–1115 and 1222–1232).
- A sale with a resolved customer and zero mapped products still earns base points, as long as the net total is positive and no seller opt-out zeroed the base. Loyalty integration does not require product push.
- Ship-from-store can later refresh items (`importParsedSale` options `refreshItems`, lines 598–608) after SKU hydration, which can fill `productId` on a **duplicate** import. The first import’s inventory movement is not replayed on that path (inventory runs only on create, line 651).

### 3.4 Loyalty earn

Call sites from sales import:

| When | Call | Lines |
|---|---|---|
| New closed sale | `earnEngine.processPosSale(sale.id)` then status `PROCESSED` | 653–658 |
| Earn throws | Sale stays `IMPORTED`; warn and do not rethrow from import | 659–663 |
| Duplicate import of an `IMPORTED` sale | Retry `processPosSale`, then `PROCESSED` | 611–622 |
| Void of a sale that already earned | `earnEngine.reversePosSaleEarn` | 554–561 |
| Return | `loyaltyReversal.onPosReturnCompleted` via a synthetic `ReturnRequest` | 760–837 |
| Return arrived before the original | `catchUpReturnClawbacks` after the original is imported | 666, 740–757 |
| Customer retro-link | `processPosSale` for previously unattributed sales | 521–529 |
| Explicit sales-link backfill with `earnPoints: true` | `processPosSale` | 285–299 |

`processPosSale` (`earn.engine.ts` lines 1032–1370):

- Returns immediately when loyalty runtime is off, when `customerId` is null, when there are no items, or when `loyaltyPointsEarned > 0` (idempotent).
- Does **not** check `POSSale.status`. A `RETURN` or `VOIDED` row passed into it can earn. The normal import path does not do that. `retroLinkUnattributedSales` does (see bugs).
- Ensures a membership (`HOS_OUTLET_POS`), applies the `PURCHASE` earn rule, seller rate, campaigns, tier, partner multiplier, brand and product bonuses, wallet `EARN` with idempotency key `earn:POS_PURCHASE:{saleId}:…`, and stamps `loyaltyPointsEarned`.
- Rethrows after logging (lines 1364–1369) so the import can leave the sale `IMPORTED`.

`reversePosSaleEarn` (lines 1381–1448) debits up to the live balance, idempotency key `reverse:POS_PURCHASE:{saleId}`, and sets `loyaltyPointsEarned` to 0. It does not restore inventory.

Customer identity for earn is independent of products (`resolveCustomerId`, lines 105–217):

1. `ExternalEntityMapping` `entityType: 'CUSTOMER'` by Lightspeed customer id → `LoyaltyMembership.userId`
2. `rawPayload.customer_code` as `LoyaltyMembership.id`
3. Card number in sale metadata
4. Case-insensitive email
5. Exactly one user with `phoneNormalized`; many users → `IdentityMatchReview` and no customer

Poll hydrates missing emails with `adapter.lookupCustomer` before import (lines 907–936).

### 3.5 Inventory decrement on sale import

`importParsedSale` calls `inventorySync.applyPosSaleToInventory(storeId, sale.id)` **once**, after insert, before earn (line 651).

`applyPosSaleToInventory` (`inventory-sync.service.ts` lines 47–86):

- Returns if there is no active connection or `autoSyncInventory` is false.
- For each item with `productId` and `quantity > 0`, finds an `InventoryLocation` (preferred warehouse from `connection.settings.defaultWarehouseId`, else any location for the product).
- `inventory.recordStockMovement` with `MovementType.OUT`, `referenceType: 'POS_SALE'`, `referenceId: posSaleId`.
- Missing location or a thrown movement is logged and skipped. The sale stays imported. A later duplicate webhook does **not** retry the movement.

Returns do not increment stock. The return test expects `applyPosSaleToInventory` not to be called (`sales-import.service.spec.ts` lines 258–259). Voids do not reverse the OUT movement either.

### 3.6 Poll cursor

`pollStoreSales` (lines 884–975) reads `settings.lastSaleVersion`, calls `adapter.getSales({ afterVersion, outletId })`, imports, then writes `lastSaleVersion = maxVersion`. The `_sinceHours` argument is unused. The comment on the connection field (`schema.prisma` lines 4369–4370) matches this: the version cursor is the source of truth, not a rolling 24h window.

Outlet filtering is client-side inside `getSales` (`lightspeed.adapter.ts` lines 346–348). The page `version.max` still advances, so other outlets’ sales are not stuck in the cursor. A sale whose `outlet_id` is empty is **not** filtered out (`mapped.outletId && …`). `POSSale` uniqueness is `(provider, externalSaleId)` globally (`schema.prisma` line 4411), so the first store to import an id owns it.

---

## 4. C3 — Inventory sync, to keep (with one write to review)

**File:** `services/api/src/pos/sync/inventory-sync.service.ts`

### 4.1 Directions

| Method | Direction | When | Needs a prior product sync? |
|---|---|---|---|
| `applyPosSaleToInventory` | Lightspeed sale → decrement HOS | First successful sale insert, if `autoSyncInventory` | Needs a resolved `productId`, which usually comes from a PRODUCT mapping |
| `syncOnlineOrderToPos` | HOS paid order → set Lightspeed outlet quantity | `payments.service.ts` 583–591 when `POS_ENABLED=true` | Yes. Skips lines with no PRODUCT mapping (lines 115–123). Also requires an active STORE channel and `autoSyncInventory` |
| `nightlyReconciliation` | Read Lightspeed qty, compare to HOS, open an `INVENTORY` discrepancy | Cron and admin sync-inventory job | Yes, in the sense that it only iterates existing `SYNCED` PRODUCT mappings. It does not create mappings |

`autoSyncInventory` gates the first two methods. **Nightly recon ignores the flag** and runs for every active connection (lines 149–156).

### 4.2 `nightlyReconciliation` (lines 149–231)

For each active connection (or one `connectionId`):

1. Outlet id from `externalOutletId` or `store.externalStoreId`. No outlet → skip.
2. Load PRODUCT mappings for that provider and store with `syncStatus: 'SYNCED'`. Zero rows → skip before any Lightspeed call (lines 162–171). Loyalty-only stores are safe.
3. Authenticate. Auth failure → skip the connection.
4. For each mapping, `adapter.getInventory(externalId, outletId)` vs HOS `InventoryLocation.quantity` (preferred warehouse, else first location, else 0).
5. If `abs(posQty - hosQty) > POS_INVENTORY_DISCREPANCY_THRESHOLD` (default 0), `discrepancies.createDiscrepancy` type `INVENTORY`. No dedupe: the same mismatch is inserted every night.
6. Writes `settings.lastReconciliation` with counts. Does not change HOS or Lightspeed quantities.

`getInventory` (`lightspeed.adapter.ts` lines 108–116) **discards `outletId`**. It `GET /products/{id}` and returns `Number(inventory[0])`, or `data.quantity`. Lightspeed X-Series inventory on a product is a list of per-outlet objects, not a list of numbers. `Number({ outlet_id, count })` is `NaN`. `Math.abs(NaN - hosQty) > threshold` is false, so a real object-shaped payload produces **no discrepancies** and looks reconciled. Even if the array were numeric, index 0 is not “this outlet”.

`updateInventory` (lines 118–127) does send `outlet_id` and an absolute `quantity` via `POST /products/{id}/inventory`. Read and write disagree. `syncOnlineOrderToPos` does read-modify-write (`current - line.quantity`, floored at 0, lines 132–134), so a bad read writes a bad quantity into the merchant’s POS.

### 4.3 Recommendation for the “POS is not ours” constraint

Keep `applyPosSaleToInventory` and `nightlyReconciliation` (read-only compare). Treat `syncOnlineOrderToPos` as a **separate HOS → Lightspeed write**. Disabling product push does not disable it for products that already have mappings. Decide explicitly whether paid online orders may still change Lightspeed on-hand. The safe default, given “the POS is not ours”, is to stop that write in the same change, without touching sale-import decrement.

---

## 5. C4 — Customer sync, to keep

### 5.1 `PosCustomerSyncService` — HOS → Lightspeed

**File:** `services/api/src/pos/sync/customer-sync.service.ts`

`syncMembershipToStore` (lines 19–81):

- Active connection required. No `autoSyncProducts` / inventory flag.
- Membership must have an email.
- Skips when both `optInEmail` and `optInSms` are false (lines 32–35).
- `adapter.syncCustomer` search-then-upsert: find by `customer_code` (membership id) then email; `PUT /customers/{id}` or `POST /customers` (`lightspeed.adapter.ts` lines 129–156).
- Upserts `ExternalEntityMapping` `entityType: 'CUSTOMER'`, `internalId = membership.id`, `storeId: ''`, `accountKey = domainPrefix` (lines 51–77).

`syncMembershipToAllPosStores` (lines 87–106) pushes once per distinct `domainPrefix`, not once per store.

Triggered by job `POS_CUSTOMER_SYNC` (`pos.jobs.ts` lines 79–86) and admin `POST .../sync/customers`, which enqueues at most **500** memberships with no cursor (`pos-admin.controller.ts` lines 257–269).

No product dependency.

### 5.2 `PosCustomerImportService` — Lightspeed → HOS

**File:** `services/api/src/pos/sync/customer-import.service.ts`

Pages `LightspeedAdapter.listCustomersPage` (`GET /customers?page_size=&after=`, adapter lines 203–249). For each customer with an email:

- If a CUSTOMER mapping exists and `customer_code` already equals the membership id, count `alreadyExisted`.
- If mapped but the stamp is wrong, `updateCustomerIdentity` (`PUT /customers/{id}` with `customer_code` and `custom_field_1` = card number).
- Otherwise find-or-create a `CUSTOMER` user, `loyalty.enroll(..., { enrollmentChannel: 'POS_IMPORT' })`, upsert the CUSTOMER mapping, then stamp Lightspeed.

`dryRun` defaults to **true** unless the payload sets `dryRun: false` (lines 43–44). The daily cron enqueues `{}` (`pos.jobs.ts` line 189), so the 03:00 job scans and writes nothing. Live import is admin-only (`POST .../import/customers` with `dryRun: false`).

No product dependency. The stamp write-back is a customer-field update, not a product write. Keep it if loyalty identity matching (`customer_code` = membership id) must keep working.

### 5.3 Identity backfill

`PosCustomerIdentityBackfillService` is queued by `POS_CUSTOMER_IDENTITY_BACKFILL` and admin `POST .../backfill/customer-identity`. Same dry-run default (`pos.jobs.ts` lines 91–92). It does not touch products.

---

## 6. C5 — Webhook handler

**File:** `services/api/src/pos/webhooks/pos-webhook.controller.ts`  
**Route:** `POST /pos/webhooks/:provider/:storeCode` (public).

1. POS runtime gate.
2. Store by `code`, active connection for that provider.
3. HMAC secret: decrypted `clientSecret` / `client_secret`, else `webhookSecret` (lines 66–78).
4. `adapter.validateWebhook(rawBody, signature, secret)`. Signature headers: `x-webhook-signature` or `x-signature`. Algorithm must be HMAC-SHA256 (`lightspeed.adapter.ts` lines 617–646). Raw body is required.
5. `isSaleWebhook` (lines 109–137):
   - `sale.delete` and any `*.delete` → ignore.
   - `sale.update`, `sale.*`, or type containing `register_sale` → accept.
   - Any other non-empty `type` / `topic` → ignore, return `{ ok: true }`.
   - No type: accept only when the payload (or `payload` JSON) has an `id` and `register_sale_products` or `line_items`.
6. Accepted events: `parseWebhookSale` → queue `POS_SALE_IMPORT`. The HTTP handler does not import inline.

Product, inventory, and customer webhooks are ignored on purpose (comment line 109). They return success. Disabling product push does not make those deliveries fail, and there is no product-webhook handler to break.

`parseWebhookSale` does not hydrate products. Webhook lines resolve the same way as poll lines. If the webhook body includes `sku` (0.9-style `register_sale_products`), SKU match works. If it only has `product.id`, the stored SKU is `ls:{id}` and a PRODUCT mapping is required.

---

## 7. C6 — POS admin controller

**File:** `services/api/src/pos/pos-admin.controller.ts`  
**Prefix:** `/admin/pos`. JWT + `ADMIN` role. Permissions `stores.view` or `stores.manage`.

| Method | Path | Keep / disable | Why |
|---|---|---|---|
| GET | `/connections` | Keep | List connections. Credentials stripped (`sanitizeConnection`, lines 61–68) |
| POST | `/connections` | Keep, change default | Creates a connection. `autoSyncProducts` defaults **true** (line 109). New default should be false |
| PUT | `/connections/:id` | Keep | Can still toggle flags. Stop honouring `autoSyncProducts: true` as a license to push |
| DELETE | `/connections/:id` | Keep | Deletes the connection row only. Does not delete mappings or call `removeProduct` |
| POST | `/connections/:id/test` | Keep | `authenticate` + `getOutlets` |
| GET | `/connections/:id/outlets` | Keep | Read outlets |
| POST | `/connections/:id/sync/products` | **Disable** | Enqueues `POS_PRODUCT_SYNC` (lines 227–233). UI: “Sync products” |
| POST | `/connections/:id/sync/inventory` | Keep | Enqueues nightly recon for one connection. Read-and-compare, not a product write |
| POST | `/connections/:id/sync/sales` | Keep | Enqueues `POS_SALES_POLL` for that store. No UI button; client has no wrapper |
| POST | `/connections/:id/sync/customers` | Keep | Enqueues customer **push**, capped at 500 |
| POST | `/connections/:id/backfill/customer-identity` | Keep | `?sync=true` runs inline. Default dry-run |
| POST | `/connections/:id/import/customers` | Keep | Lightspeed → HOS customers |
| POST | `/connections/:id/backfill/sales-links` | Keep | Relink `customerId`. `earnPoints` defaults false |
| GET | `/sales` | Keep | Filter DTO |
| GET | `/sales/:id` | Keep | Sale + items |
| GET | `/sync-log` | Keep | Last 40 `ExternalEntityMapping` rows, all entity types |
| GET | `/discrepancies` | Keep | Inventory discrepancies |

`productSync`, `inventorySync`, and `customerSync` are injected (lines 46–48) and unused. The three sync endpoints only enqueue jobs.

UI to hide with the product endpoint (`apps/web/src/app/admin/pos/connections/page.tsx`):

- “Sync products” button (lines 696–701)
- “Auto-sync products” checkbox (lines 567–577), or leave it visible and force it off

Keep “Sync inventory”, connection test, outlets, customer backfill, edit, delete.

API client methods to stop calling: `triggerPosProductSync` (`client.ts` lines 4869–4873). There is no client method for `sync/sales`, `import/customers`, or `backfill/sales-links`; those stay server-side.

---

## 8. C7 — Lightspeed API client

**File:** `services/api/src/pos/adapters/lightspeed/lightspeed-api.client.ts`

The client is a generic `request(method, path, body, { apiVersion })`. It does not hardcode a product catalogue. Paths are chosen by the adapter.

Auth, throttle (1.5s, Redis key `lightspeed:rl:{domainPrefix}`), 15s attempt timeout, 3 retries, 429 `Retry-After`, one 401 refresh, retry only on 5xx (lines 112–200).

### 8.1 Endpoints the adapter actually calls

| Method | Path | Read / write | Used for |
|---|---|---|---|
| GET | `/outlets` | Read | Connection test, outlet picker |
| POST | `/products` | **Write** | Product push create |
| PUT | `/products/{id}` | **Write** | Product push update |
| DELETE | `/products/{id}` | **Write** | `removeProduct`, unused |
| GET | `/products/{id}` | **Read** | Inventory qty; sale-line SKU hydration |
| POST | `/products/{id}/inventory` | **Write** | Online-order stock push |
| GET | `/customers`, `/customers/{id}` | Read | Import, lookup |
| POST / PUT | `/customers`, `/customers/{id}` | Write | Customer push and identity stamp |
| GET | `/search?type=customers` | Read | Customer match |
| GET | `/sales`, `/sales/{id}` | Read | Poll, ship-from-store |
| GET | `/search?type=sales` | Read | Invoice lookup |
| GET/POST/DELETE | `/gift_cards…` | Mixed | Gift cards |
| GET/POST/PUT | `/promotions…` on API `2026-04` | Mixed | Promotions |

### 8.2 Is there a list-products read?

**Not wrapped today.** The HTTP client can already call it. X-Series 2.0 list is the same version cursor the customer importer uses:

`GET /api/2.0/products?page_size={n}&after={version}`

Response shape matches customers: `{ data: [...], version: { min, max } }`. Per-id read already exists (`GET /products/{id}`), proven by the invoice hydration test (`lightspeed.adapter.spec.ts` lines 349–390), which expects `GET /products/prod-1` and reads `sku` and `name`.

Search, same client, same pattern as customers (`/search?type=customers`):

`GET /search?type=products&sku={sku}`

There is no `listProductsPage` on `LightspeedAdapter`. Adding one is a read path. It does not require `syncProduct`.

---

## 9. C8 — POS adapter interface

**File:** `services/api/src/pos/interfaces/pos-adapter.interface.ts`

| Method | Product write? | Product read? | Action |
|---|---|---|---|
| `authenticate` / `refreshAuth` / `setRequestDeadline` | No | No | Keep |
| `getOutlets` | No | No | Keep |
| `syncProduct` | **Yes** (`POST`/`PUT /products`) | No | Stop calling. Leave the method so a stray job cannot be “fixed” by re-enabling the button without a code change; make the HOS service no-op |
| `removeProduct` | **Yes** (`DELETE /products/{id}`) | No | Never call it. Deleting merchant POS products is out of scope |
| `getInventory` | No | **Yes** (`GET /products/{id}`) | Keep for reconciliation. Fix outlet parsing before trusting the numbers |
| `updateInventory` | Inventory **write** | No | Used only by `syncOnlineOrderToPos`. Disable with that method if the POS must not be written |
| `syncCustomer` / `lookupCustomer` | No | No | Keep |
| `getSales` | No | Sale read. Does not list products | Keep |
| `getSaleByInvoice` / `getSaleById` | No | Sale read + `GET /products/{id}` for SKU | Keep |
| `validateWebhook` / `parseWebhookSale` | No | No | Keep |
| Gift card methods | No | No | Keep |
| Promotion methods (optional) | No | No | Keep. `createPromotion` does not push a product catalogue (`condition.include: []`, adapter lines 810) |

Product-read methods to add for the pull (not on the interface today):

- `listProducts({ afterVersion?, pageSize? })` → page of products + `maxVersion`
- `getProduct(externalId)` → one product (the hydration call, returned as a DTO instead of only `{ sku, name }`)
- `findProductBySku(sku)` → `GET /search?type=products`

---

## 10. Safe removal plan (product push only)

Goal: zero calls to `POST /products`, `PUT /products/{id}`, and `DELETE /products/{id}`, with sales, loyalty, customer, and read-only inventory recon unchanged.

### 10.1 Do not touch

- `ExternalEntityMapping` rows. Do not migrate, delete, or rewrite `externalId`.
- `ProductChannel` rows.
- `POSSale` / `POSSaleItem`.
- `importParsedSale`, `pollStoreSales`, webhook sale queue, `processPosSale`, `reversePosSaleEarn`, `onPosReturnCompleted`.
- `applyPosSaleToInventory`.
- `nightlyReconciliation` (fix the inventory parser separately; do not couple that fix to the disable).
- Customer push, customer import, identity backfill, sales-link backfill, gift card recon.
- `getSaleById` product hydration (read).

### 10.2 Disable these call sites

1. `PosProductSyncService.syncProductToStore` and `syncAllProductsForStore` — return immediately. This is the only production caller of `adapter.syncProduct`.
2. Job processor `POS_PRODUCT_SYNC` (`pos.jobs.ts` lines 45–50) — no-op, or stop registering it so queued jobs do not sit retrying. Do not add it to `scheduleCrons` (it is not there today).
3. `POST /admin/pos/connections/:id/sync/products` — return 410/400 with a clear message, or remove the route. Hiding the button alone leaves the API and the API client method live.
4. Admin UI “Sync products” and the auto-sync-products checkbox (`connections/page.tsx` lines 567–577 and 696–701).
5. Create-connection default `autoSyncProducts: true` (`pos-admin.controller.ts` line 109). Persist `false` for new rows. Existing `true` flags become harmless once the service no-ops.
6. Do not call `removeProduct` as part of the disable. That would delete the merchant’s POS catalogue.

### 10.3 Separate decision (not required to disable product push)

`syncOnlineOrderToPos` writes outlet stock. It keeps working for already-mapped products after push is disabled. If the POS must not be mutated, no-op that method and the `payments.service.ts` call (lines 583–591). Leave `applyPosSaleToInventory` in place.

### 10.4 Why this does not break sales or loyalty

- Sale import never calls product sync.
- PRODUCT mappings remain, so previously pushed Lightspeed ids still set `POSSaleItem.productId`.
- Earn runs on the sale after insert and has a total fallback when no line has a product.
- Inventory decrement runs when `productId` is set and `autoSyncInventory` is on.
- Customer mappings use `entityType: 'CUSTOMER'` and `storeId: ''`. Product-mapping changes cannot collide with that unique key.
- Webhooks that are not sales already return `{ ok: true }`.

### 10.5 What gets worse if you only disable push

Till products that were **never** pushed, sold through poll or webhook without a real SKU on the line, stay `productId = null`. Consequences:

- No HOS stock decrement for that line.
- No product-level loyalty campaign on that line.
- Base loyalty still earns via the sale total when **no** line resolved.
- A mixed basket (some old mapped products, some new POS-only products) earns only on the mapped lines.

The pull service (section 11) plus a mapping written at submission time closes that gap without turning push back on. Hydrating SKUs inside `getSales` (the same `GET /products/{id}` ship-from-store already uses) is the other lever, and it is a read.

---

## 11. ExternalEntityMapping analysis

### 11.1 What happens to existing PRODUCT rows

They stay. Nothing in the disable plan deletes them. Sales import, nightly recon (`SYNCED` only), and online-order stock push keep reading them.

They are not refreshed. `lastSyncedAt` freezes. Lightspeed-side renames, price edits, and deletions are invisible until a pull or a sale-line SKU read. A deleted Lightspeed product leaves a stale `externalId`. The next sale simply fails the mapping lookup (Lightspeed will send a different id or none) and falls through to SKU. Recon’s `getInventory` will error that row, increment `errors`, and continue (inventory service lines 209–212).

### 11.2 Will imports break?

| Case | Result |
|---|---|
| Sale line `product_id` matches a stored `externalId` for that store | `productId` set. Earn line-level. Stock decremented. Same as today |
| No mapping, line SKU equals some `Product.sku` | `productId` set via global `findFirst`. Ambiguous if SKUs collide |
| No mapping, SKU empty or `ls:{id}` | Line stored, `productId` null. Sale, customer earn (total fallback if nothing mapped), no stock movement on that line |
| Mapping exists for store A, sale imported for store B | Miss. Lookup includes `storeId` (sales import lines 846–852). SKU fallback can still hit |
| Customer sale with no product match | Customer ladder unchanged. Loyalty still runs when `customerId` is set |

Disabling push does not remove the ability to import. It stops creating **new** PRODUCT mappings. Pre-synced products keep importing as they do now.

### 11.3 Account vs store scope

Customer rows are account-level (`storeId: ''`, one per Lightspeed `domainPrefix`). Product rows are per HOS store. Lightspeed products are account-level. Two HOS stores on one Lightspeed account therefore have two mapping rows and, if both ran product push, two `POST /products` attempts for the same SKU. The pull should key the Lightspeed id at account level (or copy one mapping per store from a single read) and must not POST.

### 11.4 Mapping to write from the pull

When a submission created from a Lightspeed product is approved, insert:

- `provider: 'lightspeed'`
- `entityType: 'PRODUCT'`
- `internalId`: new HOS product id
- `externalId`: Lightspeed product id
- `storeId`: the connection’s HOS store id (so the existing sales lookup hits)
- `syncStatus: 'SYNCED'` (so nightly recon includes it)
- `accountKey`: `domainPrefix`
- Do not set this by calling `syncProduct`

If a row already exists for that `(provider, PRODUCT, externalId, storeId)`, attach the submission to `internalId` instead of creating a second product. The unique constraint will reject a duplicate insert (`schema.prisma` line 4666).

---

## 12. POS import service design (pull, pre-fill only)

This is a read. It does not create a live HOS catalogue by itself, and it does not call `syncProduct`.

### 12.1 Adapter reads to add

On `LightspeedAdapter`, mirroring `listCustomersPage` (adapter lines 203–249):

```
listProductsPage({ after?: number; pageSize?: number })
  GET /products?page_size=&after=
  → { products: POSProductRecord[], maxVersion }

getProduct(externalId)
  GET /products/{id}          // already used by hydrateSaleLineSkus
  → POSProductRecord | null

findProductBySku(sku)
  GET /search?type=products&sku=
  verify an exact sku match (same discipline as pickVerifiedCustomerRow)
  → POSProductRecord | null
```

`POSProductRecord` from the Lightspeed product object:

| Lightspeed field | Form field |
|---|---|
| `id` | `externalProductId` (hidden, required to write the mapping later) |
| `sku` | `sku` |
| `name` | `name` |
| `description` | `description` |
| retail price (`price_including_tax` or the field the account actually returns; confirm against one live product before coding the mapper) | `price` / STORE `sellingPrice` suggestion |
| `supply_price` | `costPrice` suggestion |
| `image_url` | first image |
| brand / supplier name if embedded, else id only | `brand` |
| `handle` | slug suggestion |
| active / `deleted_at` | skip deleted |
| `inventory[]` filtered to `connection.externalOutletId` | read-only stock hint, not a write |
| `version` | cursor |

Do not map `outlet_id` onto the product. Products are account-scoped; inventory is per outlet.

### 12.2 Service

`PosProductImportService` (new), next to `customer-import.service.ts`:

- `search({ connectionId, sku?, query?, externalId? })`  
  Authenticate with the connection. `externalId` → `getProduct`. `sku` → `findProductBySku`. Otherwise page `listProductsPage` and filter by name/SKU in memory for the first page only (do not pull the whole catalogue into the request). Return form DTOs. If a PRODUCT mapping already exists for that `externalId` + store, include `alreadyLinkedProductId`.
- `preview(connectionId, externalId)`  
  Single product for the submission form. No DB writes.
- No `run()` that creates `Product` rows. Submission create/approve stays in the existing submission flow. On approve, that flow calls `linkProduct(storeId, hosProductId, externalId)` which only upserts `ExternalEntityMapping`.

Rate limit: one page (≤100) per interactive search. A full-catalogue cursor job is a later option and should be dry-run first, same as customer import.

### 12.3 What this does not do

- No `POST` or `PUT /products`.
- No price push back.
- No inventory write.
- No automatic `Product` insert from the cron.
- No deletion of existing mappings.

### 12.4 Optional read that protects sales before submissions exist

In `getSales`, after `mapSaleFromVend`, call the existing `hydrateSaleLineSkus` (adapter lines 407–444) for lines whose SKU is missing or `ls:`. That is the same `GET /products/{id}` ship-from-store already uses. Poll then stores the real SKU, and `buildSaleItemCreates` can match `Product.sku` even when no mapping exists. Cost is one extra Lightspeed read per distinct product id per page, on the 1.5s throttle. Worth doing if till SKUs match HOS SKUs. It does not replace the mapping for products that exist only in Lightspeed.

---

## 13. Bugs found

Severity is relative to “disable product push without breaking sales or loyalty”.

### High

1. **Poll/webhook sales do not hydrate product SKUs.** `getSales` maps the list payload and returns (`lightspeed.adapter.ts` lines 322–374). `hydrateSaleLineSkus` runs only from `getSaleById` (lines 506–507). Lines without `sku` become `ls:{id}` (`lightspeed.mapper.ts` line 142) and fail SKU match (`sales-import.service.ts` lines 856–857). After push is disabled, new products on this path stay unmapped. Ship-from-store is the exception.

2. **`getInventory` ignores the outlet and mis-reads the payload** (`lightspeed.adapter.ts` lines 108–116). `_outletId` is unused. `Number(inventory[0])` is `NaN` when the element is an object. Nightly recon then records no mismatch (`NaN` comparison is false). `syncOnlineOrderToPos` would write that bad number back if it were not `NaN`-guarded — it is not guarded; `Math.max(0, NaN - qty)` is `NaN`.

3. **A zero-truncated line aborts the sale and stalls the poll cursor.** `buildSaleItemCreates` throws when `Math.trunc(quantity) === 0` (sales import lines 864–868). `pollStoreSales` does not catch per sale (lines 933–938) and updates `lastSaleVersion` only after the full loop (lines 965–972). One weighed or zero-qty line retries forever and blocks later sales for that store.

4. **`retroLinkUnattributedSales` can earn on a RETURN.** It skips only `loyaltyPointsEarned !== 0` and `status === 'VOIDED'` (lines 521–524). `RETURN` is not skipped. `processPosSale` does not check status (`earn.engine.ts` lines 1032–1045). Linking a Lightspeed customer can award points on a return that was stored with `customerId` null. The explicit backfill path does skip `RETURN` (sales import lines 285–290). This is independent of product push and should be fixed before any loyalty-related POS change.

### Medium

5. **`syncProduct` stores the HOS id when Lightspeed returns no id** (`lightspeed.adapter.ts` line 101). The mapping then never matches a real sale line, and the next push PUTs that fake id.

6. **Missing HOS SKU is replaced with `product.id.slice(0, 12)`** (`product-sync.service.ts` line 68) and written into Lightspeed. That is not the merchant’s SKU. Disable makes this latent; do not “finish” in-flight pushes.

7. **Partial product resolution under-earns.** Mapped lines earn; unmapped lines in the same sale are dropped; the sale-total fallback runs only when `basePoints <= 0` (`earn.engine.ts` lines 1118–1132). Mixed baskets after the disable will under-earn relative to the till total.

8. **SKU match is global `findFirst`** (sales import lines 857–861). `Product.sku` is not unique (`schema.prisma` line 664, index only at line 740).

9. **Inventory movement failures are not retried.** The error is logged (`inventory-sync.service.ts` lines 82–84). The duplicate-sale path does not call `applyPosSaleToInventory` again (sales import lines 598–625).

10. **Returns and voids do not put stock back.** Return import never calls inventory (spec lines 258–259). Void only claws loyalty (sales import lines 554–566).

11. **Nightly recon ignores `autoSyncInventory` and duplicates discrepancies** every run (`inventory-sync.service.ts` lines 149–207). No “open discrepancy already exists” check.

12. **Connection `syncStatus` is last-product-wins** (`product-sync.service.ts` lines 103–122). One failure marks the connection `FAILED` even when earlier products synced. Relevant only while push still runs.

13. **Customer push admin endpoint silently caps at 500 memberships** (`pos-admin.controller.ts` lines 262–265) with no `orderBy` or cursor.

14. **Daily customer import cron is a dry run.** Processor treats missing `dryRun` as true (`customer-import.service.ts` lines 43–44 and `pos.jobs.ts` lines 103–104). Cron payload is `{}` (line 189). The log line says “Daily incremental customer import” (line 188). It does not import.

15. **`isClosedSale` treats a missing `state` as closed** (`lightspeed.mapper.ts` lines 337–340). A list payload that omits `state` is imported, earned, and decremented. API 2.0 sales usually include `state`; webhook bodies that do not will import.

16. **Empty `outlet_id` is imported into whichever store polls it**, and the global unique `(provider, externalSaleId)` makes the first writer the owner (`lightspeed.adapter.ts` lines 346–348, `schema.prisma` line 4411).

17. **`retroLinkUnattributedSales` loads every unattributed sale for the store** (sales import lines 507–513) and filters `customer_id` in memory.

### Low

18. **`syncIntervalMinutes` is unused.** UI implies a schedule (`connections/page.tsx` lines 553–564). Crons are fixed.

19. **Multiple active STORE channels:** bulk sync repeats the product; `findFirst` without `orderBy` picks an arbitrary price (`product-sync.service.ts` lines 24–31 and 126–133).

20. **Product push has no `status` filter.** A DRAFT with a STORE channel is pushed.

21. **`posBackfillCustomerIdentity` in the API client sends `dryRun: false` when the argument is omitted** (`client.ts` lines 4921–4929). The HTTP API defaults omitted body to dry-run (`pos-admin.controller.ts` lines 286–287). The admin page passes the flag explicitly, so the UI path is safe.

22. **Admin controller injects `productSync`, `inventorySync`, and `customerSync` and never calls them** (constructor lines 46–48).

23. **`hydrateSaleCustomer` logs with `console.warn`** (adapter lines 481–485) instead of the Nest logger.

---

## 14. Regression test cases

Run these after the product-push no-op, with PRODUCT mapping rows left in place and `adapter.syncProduct` asserted not called.

### Sales import still works

1. **Mapped line.** Closed sale, `externalProductId` equals an existing PRODUCT mapping for that store. Expect `POSSaleItem.productId` = `internalId`, one `OUT` movement, `processPosSale` once, status `PROCESSED`. `syncProduct` not called.
2. **SKU fallback, no mapping.** Line SKU `WAND-1`, mapping lookup returns null, one `Product.sku = WAND-1`. Expect that product id. Same earn and stock behaviour.
3. **`ls:` SKU and no mapping.** Expect the sale row, `productId` null, no stock movement, `processPosSale` still called. With no mapped lines, earn uses the sale net total (loyalty engine test, not a skipped earn).
4. **Mixed basket.** One mapped line, one `ls:` line. Expect stock OUT only for the mapped line. Expect earn only on the mapped line (documents current under-earn; do not “fix” it inside the disable PR unless called out).
5. **Duplicate webhook.** Second import of the same `externalSaleId` does not create a second sale, does not decrement stock again, and does not earn again when status is already `PROCESSED`.
6. **IMPORTED retry.** Existing sale status `IMPORTED`, `loyaltyPointsEarned = 0`. Duplicate import retries earn and sets `PROCESSED`.
7. **Unattributed customer.** No email, no mapping. Sale stored with `customerId` null. `processPosSale` returns without a wallet credit (engine returns when `customerId` is null).
8. **Customer mapping hit.** CUSTOMER mapping resolves `userId`. Earn runs. Product push flag irrelevant.
9. **Void.** Existing processed sale, webhook `state: voided`. `reversePosSaleEarn` once, status `VOIDED`, no second stock movement.
10. **Return.** Negative total and `return_for` set. Status `RETURN`, `processPosSale` not called, `onPosReturnCompleted` called, stock not incremented (current behaviour).
11. **Return before original.** Original import later runs `catchUpReturnClawbacks`.
12. **Non-closed.** `state: pending` → `{ skipped: true }`, no sale, no earn, no stock.
13. **Poll cursor.** Two closed sales. After success, `settings.lastSaleVersion` equals the page max. A thrown import (zero qty) must be covered: either the new code skips the bad line, or the test documents that the cursor does not advance (current bug). Do not ship a change that advances the cursor past a failed sale.
14. **`autoSyncProducts: false` and a queued `POS_PRODUCT_SYNC`.** Job completes, `syncProduct` not called, sales poll for that store still imports.
15. **Ship-from-store refresh.** `getSaleByInvoice` hydrates SKU via `GET /products/{id}`, `importParsedSale({ refreshItems: true })` updates items. Still no `POST /products`.

### Loyalty

16. Earn idempotency: second `processPosSale` on a sale with `loyaltyPointsEarned > 0` does not write another wallet transaction.
17. Retro-link of a `RETURN` row must **not** call `processPosSale` once bug 4 is fixed. Add this test in the same release if that fix is included; if the fix is deferred, add the test as a known failure and do not change retro-link behaviour accidentally.
18. Customer import dry-run and live stamp still upsert CUSTOMER mappings and do not read PRODUCT mappings.

### Inventory

19. `applyPosSaleToInventory` with `autoSyncInventory: false` performs no movement. Sale import still earns.
20. Nightly recon with zero PRODUCT mappings does not call Lightspeed (existing skip, inventory service lines 162–171).
21. Nightly recon with an existing `SYNCED` mapping still calls `getInventory` and does not call `syncProduct` or `updateInventory`.
22. If online-order push is disabled: paying an order does not call `POST /products/{id}/inventory`. Sale-import OUT movements still occur.

### Webhooks and admin

23. Product webhook (`type: product.update`) returns `{ ok: true }` and enqueues nothing.
24. Sale webhook still enqueues `POS_SALE_IMPORT`.
25. `POST .../sync/products` does not enqueue a job that calls Lightspeed product write.
26. `POST .../sync/sales` still enqueues `POS_SALES_POLL`.
27. `POST .../sync/inventory` still enqueues recon.

---

## 15. Recommended implementation

Order matters. Do the no-op before any pull UI, and do not delete data.

1. **Freeze writes.** Make `syncProductToStore` / `syncAllProductsForStore` return without calling the adapter. Make `POS_PRODUCT_SYNC` log and return. Reject `POST .../sync/products`. Hide the admin button and force `autoSyncProducts` default to false. Add a test that a sale import with an existing mapping never calls `syncProduct`.
2. **Decide the online-order stock write.** Default recommendation: no-op `syncOnlineOrderToPos` in the same change so paid web orders stop setting Lightspeed quantities. Keep `applyPosSaleToInventory`.
3. **Fix the loyalty retro-link hole** (bug 4) before relying on customer link jobs: skip `RETURN` the same way the explicit backfill does (sales import lines 285–290).
4. **Fix the poll poison line** (bug 3): skip or store a zero-qty line instead of throwing, so one bad line cannot freeze `lastSaleVersion`. Keep the cursor rule: do not advance past a sale that failed for a transient Lightspeed error.
5. **Hydrate SKUs on poll** using the existing `GET /products/{id}` helper, so lines that already exist in HOS by SKU resolve without a mapping. This is a read and directly protects sales after push is off.
6. **Fix `getInventory`** to select the object whose `outlet_id` equals the connection outlet and read that object’s count. Until that lands, treat nightly mismatch counts as unreliable. Do not let `syncOnlineOrderToPos` write if step 2 left it enabled and the read is still `NaN`.
7. **Add `listProductsPage` / `getProduct` / `findProductBySku`** as read-only adapter methods. Add `PosProductImportService.search` and `preview` for the submission form. No `Product` insert inside the POS module.
8. **On submission approval, upsert the PRODUCT mapping** (section 11.4) and do not call `syncProduct`. Sales import and nightly recon then see the new product the same way they see pre-synced ones.
9. **Leave customer import, customer push, webhooks, gift cards, and the sales poll cron alone.** Fix the 03:00 customer-import dry-run separately if a live nightly import was the intent; do not flip it to live as a side effect of this work.
10. **Regression suite** from section 14, especially cases 1, 3, 5, 9, 10, 14, 23, and 25.

Out of scope for the disable PR: deleting Lightspeed products, rewriting historical `externalId`s, changing earn math for mixed baskets (bug 7 — fix deliberately, with loyalty sign-off), and making `Product.sku` unique.

# Phase 0 Audit B — Vendor / Buy-Box System

**Scope:** VendorProduct lifecycle, cart, checkout, order model, seller storefront, product detail page.
**Date:** 2026-10-06
**Code reviewed:** `services/api/src/vendor-products/`, `services/api/src/cart/cart.service.ts`, `services/api/src/orders/orders.service.ts`, `services/api/prisma/schema.prisma` (Product, VendorProduct, Cart, CartItem, Order, OrderItem, ReturnRequest, ReturnItem), `services/api/src/products/products.service.ts`, `services/api/src/returns/returns.service.ts`, `apps/web/src/app/sellers/[slug]/`, `apps/web/src/app/products/[id]/ProductDetailClient.tsx`.

There is no `ChildOrder` model. Multi-vendor checkout stores child orders as extra `Order` rows with `parentOrderId` set (`schema.prisma` lines 1073–1076).

---

## Executive conclusion

The marketplace has two independent sources of truth, and checkout uses the wrong one for the buy-box.

| Concern | What the buyer and cart use | What VendorProduct stores | Wired together? |
|---|---|---|---|
| Selling price | `Product.price` | `VendorProduct.platformPrice` (and `vendorPrice`) | No. Approval writes `platformPrice` and never copies it onto `Product`. |
| Stock | `Product.stock` | `VendorProduct.vendorStock` | Partially. Catalog visibility uses vendor stock. Cart and the checkout gate use product stock. Checkout then decrements both, with a silent skip if no ACTIVE vendor row matches. |
| Which vendor fulfills | Not chosen by the buyer | At most one ACTIVE row, enforced only in application code | Checkout ignores the cart and picks the ACTIVE vendor with the highest `vendorStock`. |

`CartItem` and `OrderItem` have no `vendorProductId`. Add to Cart sends only `productId`. The product page has no vendor picker and does not show a seller.

Making every approved product `isPlatformOwned: true` / `sellerId: null`, allowing multiple ACTIVE vendor listings, and validating price and stock from `VendorProduct` will break storefronts, seller dashboards, order routing, returns restock, and slug uniqueness unless the changes in section 5 land first.

---

## 1. Current flow

### 1.1 VendorProduct lifecycle

```
DRAFT ──submit──► PENDING_APPROVAL ──approve──► APPROVED ──activate──► ACTIVE
                      │                              ▲                    │
                      └──reject──► REJECTED ─submit──┘                    │
                                                                          │ deactivate
                                                                          ▼
                                                                       INACTIVE ──activate──► ACTIVE
```

`OUT_OF_STOCK` exists on the enum (`schema.prisma` lines 794–802) and is never written.

#### `create()` — `vendor-products.service.ts` 23–72

Controller passes `req.user.id` (`vendor-products.controller.ts` 39–43). The service parameter is named `sellerId` but `assertSellerCanOperate` looks the seller up by **user id** (`sellers.service.ts` 51–61).

Checks:

1. Seller exists and `vendorStatus` is `ACTIVE` or `APPROVED`. Anything else throws `ForbiddenException`.
2. `Product` with `dto.productId` exists. No check that the product is `ACTIVE`, platform-owned, or free of another seller.
3. Unique pair `(seller.id, productId)` via `sellerId_productId` (`schema.prisma` line 844). Duplicate throws `ConflictException` (“You already have a listing for this product”).

Writes status `DRAFT` (line 55). Sets `vendorPrice`, `vendorCurrency` (default platform currency), optional `costPrice`, `vendorStock` (default 0), `lowStockThreshold` (default 5), `allowBackorder` (default false), `fulfillmentMethod`, `leadTimeDays` (default 3). Does not set `platformPrice` or `marginPercent`. No notification.

#### `submitForApproval()` — lines 218–237

Owner check: `vp.seller.userId === userId`. Allowed from `DRAFT` or `REJECTED` only. Sets `status: PENDING_APPROVAL` and `submittedAt`. Does **not** call `assertSellerCanOperate`, so a suspended vendor can still submit. No notification, email, or admin queue event.

#### `approve()` — lines 240–272

Admin/catalog only (`controller` 130–141). Requires `PENDING_APPROVAL`.

```250:253:services/api/src/vendor-products/vendor-products.service.ts
    const platformPrice = dto.platformPrice ?? Number(vp.vendorPrice);
    const marginPercent =
      dto.marginPercent ??
      (platformPrice > 0 ? (platformPrice - Number(vp.vendorPrice)) / platformPrice : 0);
```

Status becomes `APPROVED`, not `ACTIVE`. The product the buyer sees is not updated: `Product.price`, `Product.stock`, and `Product.status` stay as they were. No notification to the seller.

`marginPercent` is a fraction of the selling price, stored as `Decimal(5, 4)` (`schema.prisma` line 819, max absolute value 9.9999). If an admin sets `platformPrice` far below `vendorPrice`, the computed margin is a large negative and the update throws. Auto-calculated margin can also be negative; the DTO only rejects a negative value when the client sends `marginPercent` explicitly (`approve-vendor-product.dto.ts` 11–15).

#### `activate()` — lines 294–319 (single-active-vendor rule)

Admin/catalog only (`controller` 157–164). Allowed from `APPROVED` or `INACTIVE`. Refuses `vendorStock <= 0`.

Exact queries, **not inside a transaction**:

```306:319:services/api/src/vendor-products/vendor-products.service.ts
    await this.prisma.vendorProduct.updateMany({
      where: {
        productId: vp.productId,
        status: 'ACTIVE',
        id: { not: id },
      },
      data: { status: 'INACTIVE' },
    });

    return this.prisma.vendorProduct.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
```

What this does:

- Flips every other `ACTIVE` row for the same `productId` to `INACTIVE`.
- Then sets this row to `ACTIVE`.
- Does not copy `platformPrice` → `Product.price`.
- Does not copy `vendorStock` → `Product.stock`.
- Does not touch carts, orders, or search index.
- Does not check that the listing was ever approved. `INACTIVE` is allowed even if the row was never `APPROVED` (see bug B-01).
- Does not lock the product row. Two concurrent activates can both pass the read, each deactivate the other, then both write `ACTIVE`. There is no partial unique index on `(productId) WHERE status = 'ACTIVE'`.

#### `reject()` — lines 275–291

`PENDING_APPROVAL` → `REJECTED`, sets `rejectedAt` and `rejectionReason`. No notification.

#### `deactivate()` — lines 322–335

Seller-scoped (`vp.seller.userId === userId`). No status guard. Any status, including `DRAFT`, `PENDING_APPROVAL`, and `REJECTED`, becomes `INACTIVE`. Does not call `assertSellerCanOperate`. Does not sync `Product`. Does not notify. Does not restock anything (stock was never moved).

#### Other lifecycle notes

- `update()` (182–215) can change `vendorPrice` and `vendorStock` on an `ACTIVE` or `PENDING_APPROVAL` row without returning it to `DRAFT` or recomputing `platformPrice`.
- `delete()` (338–352) blocks `ACTIVE` only. No order-history guard beyond the FK (`onDelete: Cascade` on the vendor product, `schema.prisma` 809–811). Orders do not reference `VendorProduct`, so history is not cascaded; the listing row is simply gone.
- `totalUnitsSold` and `totalRevenue` (`schema.prisma` 838–839) are never incremented in `orders.service.ts`.
- `allowBackorder` is stored and never read by cart or checkout.
- `fulfillmentMethod` and `leadTimeDays` are not used when routing the order.

### 1.2 Cart

`AddToCartDto` (`cart/dto/add-to-cart.dto.ts` 3–13) is `productId`, `quantity`, optional `variationOptions`. No `vendorProductId`.

#### `addItem()` — `cart.service.ts` 126–237

1. Load `Product` by id (127–135).
2. Reject unless `product.status === 'ACTIVE'` (141–143).
3. Reject if `product.stock < quantity` (145–147). Vendor stock is not read.
4. Serializable-style transaction on the cart only (150–221):
   - Cap 50 distinct lines, matched by `productId` only (163–173).
   - Merge line if same `productId` and same variation map (175–193).
   - Update or create `CartItem` with `price: product.price` (201–216).
5. Best-effort wishlist removal (223–234).
6. `recalculateCart` (236).

Guest add (`addGuestItem`, 414–511) is the same price and stock rules and is **not** wrapped in a transaction.

#### What a cart line stores

`CartItem` (`schema.prisma` 993–1004):

| Field | Present |
|---|---|
| `id`, `cartId`, `productId`, `quantity`, `variationOptions`, `price` | Yes |
| `vendorProductId` | **No** |
| Seller id | **No** (seller is joined from `Product.seller` at read time) |

`getCart()` (66–124) and `getGuestCart()` (352–412) return the stored `CartItem.price`. They do **not** refresh price or stock.

#### `recalculateCart()` — 633–898

- Drops lines whose product is missing or `status !== 'ACTIVE'` (669–685). A deactivated vendor listing does **not** remove the line, because product status is unchanged.
- Merges duplicates on `` `${productId}::${variationKey}` `` (687–717). Two vendors of the same product would collapse into one line.
- Rewrites `CartItem.price` from `item.product.price` whenever it differs (719–728). Never reads `VendorProduct.platformPrice` or `vendorPrice`.
- Tax from `TaxService` or `product.taxRate`. Promotions and loyalty use the refreshed product price.
- Cart currency is `cart.items[0].product.currency` (869).

`updateItem` / `updateGuestItem` (239–276, 513–551) re-check `product.stock` and write `price: item.product.price`.

`mergeGuestCart` (596–631) re-adds each guest line via `addItem` with only `productId`, `quantity`, and variations. A future `vendorProductId` on the guest line would be dropped unless this loop is updated.

### 1.3 Checkout → order

Entry: `OrdersService.create` (`orders.service.ts` 502).

Step by step:

1. **Idempotency** (503–545). Key from the client, or `auto-${userId}-${cartId}`. Existing parent order (`parentOrderId: null`) is returned as-is.
2. **Cart lock** (547–572). `checkoutLockedAt` set if null, or stolen if older than 2 minutes.
3. **Load cart** with `product.seller` and tax class (575–597). Empty cart throws.
4. **Refresh prices** by calling `cartService.recalculateCart` (603–613), which overwrites every line from `Product.price`, then reload the cart. Charged price is therefore `Product.price`, not a stale cart snapshot and not `VendorProduct.platformPrice`.
5. **Promotions** recomputed from those line prices (615–628).
6. **Addresses** must belong to the user (630–642).
7. **Vendor routing / buy-box** (652–691). See below. The cart has no vendor choice to honor.
8. **Per-group stock gate** uses `item.product.stock`, not `vendorStock` (731–734). Missing seller record aborts that group (718–725).
9. **Totals.** Shipping is re-quoted server-side (784–840). Discount comes from `cart.discount` (843), which includes promotions and loyalty. Grand total = subtotal + tax + shipping − discount, floored at 0 (844–847).
10. **Transaction** (910+):
    - Re-read `Product.stock` and reject if short (912–929). Still not vendor stock.
    - Parent `Order` (942–1000). `sellerId` is `null` when more than one group, otherwise the single group’s seller id (945). Line items copy `productId`, `quantity`, `price` (the cart line, already refreshed from `Product.price`), and `variationOptions` (976–982). No `vendorProductId`.
    - If `vendorGroups.length > 1`, one child `Order` per group (1002–1061). `groupKey` is the map key from step 7 (`sellerIdOrPlatform`). Child `sellerId` is `group.seller.id` or null for the `'platform'` bucket. Shipping and discount are split by subtotal ratio (1019–1028). Platform fee = group subtotal × seller `commissionRate` (or `defaultCommissionRate`) (1013–1016). Child lines duplicate the parent lines for that group.
    - Single group: warehouse routing and platform fee are written onto the parent (1063–1088). No child row.
    - Loyalty redemption finalized (1091–1104).
    - Stock decrement (1106–1155). See section 2.
    - Cart lines deleted and totals zeroed inside the same transaction (1157–1174).

#### Exact buy-box (who gets the line)

```652:691:services/api/src/orders/orders.service.ts
      // Group items by seller, preferring VendorProduct assignments ...
      // When multiple vendors carry the same product, pick the one with the most stock.
      const activeVendorProducts = await this.prisma.vendorProduct.findMany({
        where: {
          productId: { in: productIds },
          status: 'ACTIVE' as any,
        },
        take: 500,
        select: { productId: true, sellerId: true, vendorStock: true },
      });
      // ... highest vendorStock wins; equal stock keeps the first row seen (no orderBy)
      const groupKey =
        vendorProductMap.get(item.productId) || item.product.sellerId || 'platform';
```

Priority for `groupKey`:

1. `sellerId` of the ACTIVE `VendorProduct` with the highest `vendorStock`.
2. Else `Product.sellerId`.
3. Else the string `'platform'` (seller left null, no vendor stock decrement, no commission unless a seller object exists — it does not).

Price, `platformPrice`, `leadTimeDays`, `fulfillmentMethod`, and buyer choice are ignored. `findMany` has no `orderBy`, so a tie is whichever row the database returns first. `take: 500` can drop rows and silently fall through to `Product.sellerId` or `'platform'`.

`isMultiVendor` is `vendorGroups.length > 1` (778). A cart of three platform products with no vendor listing is **one** order (`groupKey = 'platform'`), not three. A cart whose lines route to two different sellers becomes a parent (`sellerId: null`, all lines) plus one child per seller (those lines duplicated).

Vendor accept (`vendorAcceptOrder`, 2267–2297) and reject (`vendorRejectOrder`, 2303–2358) require `order.sellerId === seller.id` and `parentOrderId` set. A single-vendor order has no child, so the vendor cannot accept or reject it through these methods. Reject restores `Product.stock` and increments `VendorProduct.vendorStock` for that seller with **no status filter** (2325–2341).

### 1.4 Cancel and returns

Cancel of a multi-vendor parent restores stock from **child** lines only, skipping children already `CANCELLED`, `REFUNDED`, or `REJECTED` (`orders.service.ts` 2510–2553). Single-vendor cancel restores from parent lines (2554–2573). Vendor stock is incremented only when `order.sellerId` / `child.sellerId` is set, via `findFirst({ productId, sellerId })` with no status filter.

`applyRestockForReturn` (`returns.service.ts` 1161–1206) always increments `Product.stock`. It increments `VendorProduct.vendorStock` only when `returnRequest.order.sellerId` is set. A return filed against the **parent** of a multi-vendor checkout has `sellerId: null` (set at order create line 945), so vendor stock is not restored. `ReturnRequest` and `ReturnItem` have no vendor id (`schema.prisma` 1346–1399). `ReturnItem` points at `OrderItem`, which also has no vendor id.

### 1.5 Seller storefront

`apps/web/src/app/sellers/[slug]/page.tsx` loads the seller profile from `GET /sellers/slug/:slug` for metadata and 404. The grid is client-side:

```128:135:apps/web/src/app/sellers/[slug]/SellerStorefrontClient.tsx
      const productsResponse = await apiClient.getProducts({
        sellerId: sellerData.id,
        status: 'ACTIVE',
        limit: 50,
      } as any);
```

`ProductsService.findAll` resolves that id to a `Seller` and sets `where.sellerId = seller.id` (`products.service.ts` 392–402). The filter is `Product.sellerId`, not `VendorProduct.sellerId`. Prices shown on the grid are `Product.price` (client interface at `SellerStorefrontClient.tsx` 49–62, sort at 153–165).

Public catalog eligibility (`products.service.ts` 304–325), when `vendor_products` exists:

- No `VendorProduct` rows at all, and `Product.stock > 0` and `Product.price > 0`, **or**
- At least one `VendorProduct` with `status: ACTIVE`, `vendorStock > 0`, and `vendorPrice > 0`.

`platformPrice` is not part of this filter. A single `DRAFT` vendor row removes the product from the “no vendor rows” branch. If that row is not `ACTIVE` with stock and price, the product disappears from the public catalog even when `Product.stock` and `Product.price` are valid.

Seller dashboard counts use the same `Product.sellerId` filter (`sellers.service.ts` 844–846). Vendor listing counts use `VendorProduct` (848–850) and would survive `Product.sellerId = null`. Order counts use `Order.sellerId` (840–843), which stays correct only if checkout still writes the fulfilling seller onto the order.

Seller-owned product edit/delete requires `product.sellerId === seller.id` (`products.service.ts` 715–717 and 1000). Platform-owned rows are not editable by the seller through that API. Seller product **create** always sets `sellerId: seller.id` (171–173) and does not create a `VendorProduct`.

Slug lookup for `GET /products/:id` when the param is not a UUID uses `findBySlugOnly` (`products.controller.ts` 77–80, `products.service.ts` 639–645): `findFirst({ where: { slug, status: ACTIVE } })` with no seller and no `orderBy`.

### 1.6 Product detail page

`ProductDetailClient.tsx`:

- Price is `product.price` (459–462).
- Stock label and quantity cap are `product.stock` (463–466, 529–533, 546–548).
- Add to Cart calls `addToCartContext(product.id, quantity, variations)` (327–331). No vendor id.
- There is no vendor list, no “sold by”, and no offer selector. The only seller read is `product.seller?.storeName` when writing `recentlyViewed` (171). The public product endpoint calls `findOne(id)` / `findBySlugOnly` with the default `includeSeller = false` (`products.service.ts` 489, 641; `mapToProductType` only attaches `seller` when `includeSeller` is true, 1190–1198). The PDP therefore does not show seller info.

---

## 2. Price and stock source of truth

| Stage | Price | Stock | Vendor |
|---|---|---|---|
| Public listing filter | `vendorPrice > 0` if any vendor row exists; else `Product.price > 0` | `vendorStock > 0` if any vendor row exists; else `Product.stock > 0` | Any ACTIVE row qualifies the product. Buyer is not told which one. |
| PDP | `Product.price` | `Product.stock` | Hidden |
| Add to cart / update qty | Snapshot `Product.price` onto `CartItem.price` | Gate: `Product.stock` | Not stored |
| `getCart` | Stored `CartItem.price` (can be stale until a mutation) | Not rechecked | `Product.seller` if the relation is loaded |
| `recalculateCart` and the start of `create` order | Overwrite from `Product.price` | Not rechecked here (inactive **products** are removed) | Unchanged |
| Order line `price` | That cart price | — | — |
| Buy-box | Ignored | Highest `vendorStock` among ACTIVE rows picks the seller | `groupKey` |
| Checkout stock gate (before and inside the transaction) | — | `Product.stock` | — |
| Decrement | — | `Product.stock` always; `VendorProduct.vendorStock` only if the group has a seller **and** an ACTIVE row for that seller has `vendorStock >= qty` | Routed seller |
| Commission | `commissionRate × group subtotal` (subtotal is `Product.price × qty`) | — | Seller on the order |
| `VendorProduct.platformPrice` / `marginPercent` | Written at approve, never read by cart, PDP, or checkout | — | — |
| Cancel / vendor reject | — | `Product.stock` incremented; vendor stock incremented if `order.sellerId` matches any vendor row | `order.sellerId` |
| Return restock | — | `Product.stock` always; vendor stock only if `order.sellerId` is set | Parent multi-vendor orders have `sellerId` null, so vendor stock is skipped |

Checkout decrement (`orders.service.ts` 1110–1153):

- `product.updateMany` where `stock >= quantity`, else throw.
- If `group.seller` is set, `vendorProduct.updateMany` where `productId`, `sellerId`, `status: ACTIVE`, `vendorStock >= quantity`.
- If that matches 0 rows **and** an ACTIVE row exists, throw “Insufficient vendor stock”.
- If that matches 0 rows **and** no ACTIVE row exists, **do not throw**. `Product.stock` is already decremented and the order is still assigned to that seller.

So a product can be buyable in the cart (`Product.stock` high, `vendorStock` zero or listing inactive) and then fail at checkout, or the reverse: visible in the catalog because `vendorStock > 0` while `Product.stock === 0`, and Add to Cart fails.

---

## 3. Bugs

### B-01 — Critical: `INACTIVE` can be activated without approval

`deactivate()` sets any status to `INACTIVE` (322–335), including `DRAFT`, `PENDING_APPROVAL`, and `REJECTED`. `activate()` allows `APPROVED` **or** `INACTIVE` (299–301) and does not check `approvedAt` / `platformPrice`. A seller can deactivate a draft (or a rejected listing) and an admin can activate it. `platformPrice` stays null. `submitForApproval` then refuses the row because it is no longer `DRAFT` or `REJECTED` (227–228), so the normal path is also stuck.

### B-02 — Critical: single-active rule is not atomic and not in the database

`activate()` runs `updateMany` then `update` with no `$transaction` and no `SELECT … FOR UPDATE` (306–319). Concurrent activates can leave two `ACTIVE` rows. Schema unique key is only `(sellerId, productId)` (844). Checkout then “picks highest stock” (652–682), which is a second, conflicting rule.

### B-03 — Critical: buyer price is `Product.price`, not the approved platform price

`approve()` stores `platformPrice` (250–260) and never writes `Product.price`. Cart (205, 215, 495, 505, 719–726) and checkout (603–613, 976–981) charge `Product.price`. Two vendors cannot have two prices. Changing `vendorPrice` via `update()` (196) does not change what the buyer pays and does not invalidate an existing `platformPrice`.

### B-04 — Critical: stock gates disagree

Catalog uses `vendorStock` once any vendor row exists (`products.service.ts` 312–324). Cart and both checkout checks use `Product.stock` (`cart.service.ts` 145–147, 264–266; `orders.service.ts` 732–733, 922–927). Vendor stock is decremented only as a second step (1127–1152) and is skipped when no ACTIVE row matches. `allowBackorder` is ignored everywhere.

### B-05 — High: a non-active vendor row hides the product

Listing OR-branch 1 requires `vendorProducts: { none: {} }` (`products.service.ts` 314). Creating a `DRAFT` listing removes that branch. Branch 2 requires `ACTIVE` + stock + `vendorPrice`. Until activation, a previously visible in-stock product drops out of search and the storefront.

### B-06 — High: buy-box ignores the buyer and is unstable

Routing (659–686) uses highest `vendorStock`, no `orderBy`, `take: 500`. Equal stock is non-deterministic. Price, lead time, and fulfillment method are not inputs. Cart cannot express a choice. After `Product.sellerId` is nulled, a product with zero ACTIVE vendor rows routes to `'platform'` and is fulfilled by nobody (`sellerId` null, no vendor decrement).

### B-07 — High: vendor stock not restored on parent-order returns

Multi-vendor parent is created with `sellerId: null` (945). `applyRestockForReturn` (returns.service.ts 1172–1184 and 1194–1204) only restocks the vendor when `order.sellerId` is set. A customer return against the parent order puts units back on `Product.stock` only. The child order’s vendor stock stays decremented. Cancel of the parent does use child `sellerId` (2525–2533), so cancel and return disagree.

### B-08 — High: silent vendor-stock skip still commits the order

`orders.service.ts` 1138–1152 throws only when an ACTIVE vendor row exists and is short. If the listing was deactivated between the routing read and the decrement, or the group seller came from `Product.sellerId` with no ACTIVE listing, decrement count is 0, `vp` is null, and checkout succeeds. Product stock is down; vendor stock is not; the seller is still on the order.

### B-09 — Medium: `getCart` serves stale prices

Refresh happens in `recalculateCart`, which runs on add/update/remove/clear and at checkout, not on `getCart` (66–123) or `getGuestCart` (352–411). The cart page can show a price that checkout will replace.

### B-10 — Medium: duplicate cart lines key on product only

Merge and the 50-line cap (`cart.service.ts` 165–166, 175–193, 699) ignore vendor. Guest merge (614–618) drops every field except product, quantity, and variations. Supporting `vendorProductId` without changing these keys will combine two vendors into one line or reject a second vendor as a duplicate.

### B-11 — Medium: slug uniqueness collapses when `sellerId` is null

`@@unique([sellerId, slug])` (`schema.prisma` 735). In PostgreSQL, unique indexes treat NULL as distinct, so many platform-owned products may share a slug. Admin create tries to avoid that with `findFirst({ where: { slug } })` (`admin/products.service.ts` 245), but seller create checks `sellerId_slug` (`products.service.ts` 111) and `findBySlugOnly` returns an arbitrary `findFirst` (644–645). Public URLs `/products/:slug` become ambiguous.

### B-12 — Medium: seller storefront and seller product APIs key off `Product.sellerId`

Storefront query (`SellerStorefrontClient.tsx` 131–134 → `products.service.ts` 392–402). Dashboard product counts (`sellers.service.ts` 844–846). Seller update/delete (`products.service.ts` 715–717). All return empty or 403 when every product is platform-owned. `findBySlug(sellerSlug, productSlug)` (569–587) also requires `Product.sellerId = seller.id`.

### B-13 — Medium: commission base is the customer price, not vendor economics

`platformFeeAmount` is `subtotal * commissionRate` (1013–1016, 1079–1087). `vendorPrice`, `costPrice`, and `marginPercent` are unused. `totalUnitsSold` / `totalRevenue` on `VendorProduct` stay 0.

### B-14 — Low: no notifications on submit, approve, reject, activate, or deactivate

`submitForApproval`, `approve`, `reject`, `activate`, and `deactivate` only write the row. Sellers are not told a listing was approved or rejected. Admins are not told a listing was submitted.

### B-15 — Low: `OUT_OF_STOCK` is dead; zero vendor stock does not change status

Checkout can drive `vendorStock` to 0 and leave status `ACTIVE`. The next catalog query hides the product (`vendorStock > 0` fails) while the row is still ACTIVE, so the buy-box can still select that seller and then fail the vendor decrement (B-08’s throw path) or, if another ACTIVE row exists, route elsewhere without the buyer knowing.

### B-16 — Low: guest add-to-cart is not transactional

`addGuestItem` (438–508) reads the cart, then writes, with no transaction. Two parallel adds can insert duplicate lines. `recalculateCart` later merges them (687–717), but the stock check can pass twice against the same `Product.stock`.

---

## 4. Impact of the four planned changes

### Change 1 — Approved products become `isPlatformOwned: true`, `sellerId: null`

| Surface | What breaks |
|---|---|
| Seller storefront `/sellers/[slug]` | Product grid empty. Profile, theme, and “member since” still render. |
| Seller dashboard `totalProducts` / `activeProducts` | Always 0 (`sellers.service.ts` 844–846). |
| Seller product edit, delete, bundle ownership | 403, because they compare `product.sellerId` (`products.service.ts` 715–717, 922, 1000). |
| Checkout fallback | `groupKey` no longer falls through to `Product.sellerId`. With no ACTIVE `VendorProduct`, every line is `'platform'`, parent `sellerId` is null, no commission, no vendor stock movement. |
| Single-vendor accept/reject | Still requires a child order. One platform group does not create children, so vendors never see an order to accept. |
| Returns | Parent `sellerId` null → vendor restock skipped (already true for multi-vendor; becomes true for every order). |
| Slugs | DB unique `(sellerId, slug)` stops deduplicating. `findBySlugOnly` can return the wrong product. |
| Loyalty earn | `earn.engine.ts` already special-cases `isPlatformOwned` (around 471–487). Attribution to a vendor via `Product.sellerId` stops. Confirm that path still has a vendor id from the order. |
| PDP seller | Already omitted on the public product API. No new UI break; “sold by” cannot be implied from `Product.seller`. |
| Admin create | Already supports `isPlatformOwned` forcing `sellerId` null (`admin/products.service.ts` 143–146). This part is aligned. |
| Meilisearch | Indexes `isPlatformOwned` (`meilisearch.service.ts`). Search can filter on it, but listing eligibility still uses the vendor-row rule in `findAll`, which is a separate code path from Meili. |

What still works: vendor listing CRUD keyed by `VendorProduct.sellerId`; order history queries that use `Order.sellerId` **or** `childOrders.sellerId` (`orders.service.ts` 1737, 1749–1752); public seller profile by slug.

### Change 2 — Multiple ACTIVE `VendorProduct` rows per product

| Surface | What breaks |
|---|---|
| `activate()` | Still deactivates every other ACTIVE row (306–314). Must be removed or the feature cannot exist. |
| Checkout buy-box | Highest `vendorStock` wins, ignoring price. The buyer can be charged `Product.price` while a cheaper ACTIVE vendor exists, and a different vendor ships it. |
| Catalog | `some: { status: ACTIVE, vendorStock > 0 }` stays valid (the product is listed if any offer is live). It cannot show per-vendor price or stock. |
| Stock | `Product.stock` is a single integer. Two vendors’ stock cannot both be represented. Decrementing `Product.stock` by the full qty **and** one vendor’s `vendorStock` double-counts or under-counts the other vendor. |
| Cart merge key | Same `productId` from two vendors becomes one line (687–717). |
| `take: 500` | More likely to truncate once many vendors are ACTIVE (659–665). |

### Change 3 — Cart stores `vendorProductId`; buyer chooses the vendor

| Surface | What must change |
|---|---|
| `CartItem` | New nullable FK `vendorProductId`. Unique/merge key must include it (175–193, 699, guest copies at 467–483 and 614–618). |
| `AddToCartDto` | Accept `vendorProductId`. |
| PDP | Offer list and a selected vendor passed into `handleAddToCart` (327–331). |
| `getCart` / map | Return the chosen vendor (name, price, stock, lead time). `mapToCartType` (900–926) currently has no such field. |
| Price refresh | `recalculateCart` 719–726 must load that vendor row and use `platformPrice` (or the agreed selling price), and drop the line if that listing is no longer `ACTIVE`. |
| Checkout routing | Replace 652–691. `groupKey` must be the cart line’s vendor seller, not a fresh max-stock query. |
| Guest cart and merge | Persist and copy `vendorProductId`. |
| Promotions | `applyPromotionsToCart` is keyed by `productId` (820–825). Confirm a promo does not need to be vendor-scoped; if it does, pass vendor id. |
| Old carts | Lines with null `vendorProductId` need a migration rule (assign the current ACTIVE offer, or force the buyer to re-add). |

### Change 4 — Price and stock validation use `VendorProduct`

| Surface | What breaks if cart/checkout switch without a full cutover |
|---|---|
| PDP and listing cards | Still render `Product.price` / `Product.stock`, so the buyer sees one number and is charged another. |
| `Product.stock` decrement | If this remains (1112–1114) while vendor stock is the real inventory, platform stock and vendor stock drift on every order, cancel, and return. |
| Catalog filter | Uses `vendorPrice`, not `platformPrice` (320). A listing with a platform price and a zero vendor price would not match, or the inverse. |
| Variations | PDP can show per-option `price` (`ProductDetailClient.tsx` 490–504) that is never written to the cart line. Vendor price does not interact with variation price at all. |
| Shipping quote | Uses cart line price (`orders.service.ts` 789–796). Must be the vendor platform price or free-shipping thresholds are wrong. |
| Tax | Computed on line total from that price (736–757). Same requirement. |
| Idempotent retry | Returns the existing order’s stored prices (521–544). Safe if the first request locked the vendor price onto `OrderItem.price`. |

---

## 5. Multi-vendor migration plan

Do these in order. Schema changes before behavior changes. Do not turn off the single-active rule until cart and checkout read `vendorProductId`.

### Step 1 — Schema

1. `CartItem.vendorProductId String?` → `VendorProduct`, `onDelete: Restrict` (do not cascade-delete a line that is in a live cart; block delete or null with a defined rule). Index `(cartId, productId, vendorProductId)`.
2. `OrderItem.vendorProductId String?` → `VendorProduct`, `onDelete: Restrict`. This is the permanent record of who was paid and who restocks.
3. Optional: `OrderItem.sellerId` denormalized for queries, copied from the vendor row at checkout so returns do not depend on `Order.sellerId`.
4. Partial unique index **removed** only after step 6. Until then, keep a partial unique index `UNIQUE (productId) WHERE status = 'ACTIVE'` so B-02 cannot happen during the transition. Drop that index in the same migration that enables multiple active offers.
5. Replace `@@unique([sellerId, slug])` with a global unique on `Product.slug` (or a partial unique `WHERE sellerId IS NULL`) before nulling seller ids. Backfill duplicate slugs first.
6. Decide the selling-price column. Recommend: buyer-facing price is `VendorProduct.platformPrice`; `vendorPrice` stays the vendor’s ask; `Product.price` becomes a display cache (min active `platformPrice`) updated when offers change, not the charge source.

### Step 2 — One offer writer

1. Fix `activate()` / `deactivate()`:
   - `activate()` only from `APPROVED`, or from `INACTIVE` when `approvedAt` is set and `platformPrice` is non-null.
   - `deactivate()` only from `ACTIVE` (and maybe `APPROVED`). Never from `DRAFT` / `PENDING_APPROVAL` / `REJECTED`.
   - Run the status change in a transaction. While the single-active rule still exists, `SELECT … FOR UPDATE` the product’s vendor rows, then deactivate others, then activate.
2. On `update()` of `vendorPrice` or `vendorStock` for an `ACTIVE` or `APPROVED` row, either force status back to `PENDING_APPROVAL` and clear `platformPrice`, or recompute margin and write an audit row. Do not leave a stale `platformPrice`.
3. When `vendorStock` hits 0 and `allowBackorder` is false, set `OUT_OF_STOCK` (or keep `ACTIVE` but exclude it from buy-box and PDP). When stock is replenished, return to `ACTIVE` only if it was previously approved.
4. Emit notifications on submit, approve, reject, activate, deactivate.
5. Call `assertSellerCanOperate` from submit, deactivate, and activate’s seller-status check.

### Step 3 — Read path for offers (PDP and listing)

1. Public product payload includes `offers: { vendorProductId, sellerId, storeName, slug, platformPrice, currency, vendorStock, leadTimeDays, fulfillmentMethod, allowBackorder }[]` for `status = ACTIVE` and (`vendorStock > 0` or `allowBackorder`).
2. PDP renders the offer list. Default selection is explicit (lowest `platformPrice`, then shortest lead time — document the rule). Add to Cart sends `vendorProductId`.
3. Listing cards show “from {min platformPrice}” and “N sellers” when `offers.length > 1`.
4. Catalog filter: product is listed if any offer is purchasable. Replace the `vendorProducts: { none: {} }` branch so a `DRAFT` row does not hide a product that still has product stock **or**, after cutover, so only purchasable offers matter and `Product.stock` is not a visibility input.
5. Storefront `getProducts({ sellerId })` becomes: products that have a `VendorProduct` for that seller with `status = ACTIVE` (and stock). Price on the card is **that seller’s** `platformPrice`, not `Product.price`.

### Step 4 — Cart

1. `addItem` / `addGuestItem`: require `vendorProductId` for products that have offers. Load that row; require `ACTIVE`, seller allowed to operate, and (`vendorStock >= qty` or `allowBackorder`). Set `CartItem.price` from `platformPrice`. Reject a missing or inactive offer.
2. Stock checks use `vendorStock`, not `Product.stock`.
3. Merge key: `vendorProductId` + variation key. Cap of 50 counts distinct keys.
4. `recalculateCart` refreshes price from the linked `VendorProduct.platformPrice` and removes lines whose offer is not purchasable.
5. `getCart` should call the same refresh, or the cart page will keep showing stale prices (B-09).
6. `mergeGuestCart` copies `vendorProductId`.

### Step 5 — Checkout

1. Delete the max-stock query (652–682). Group cart lines by `item.vendorProduct.sellerId`. `'platform'` only for lines with no vendor (gift cards, true platform SKUs with no offer). Do not fall back to `Product.sellerId` once that column is null.
2. Stock gate and decrement: `VendorProduct` only, `id = line.vendorProductId`, `vendorStock >= qty` unless `allowBackorder`. Stop decrementing `Product.stock`, or redefine `Product.stock` as a cache of `sum(vendorStock)` updated in the same transaction.
3. Lock the vendor row (`updateMany` with `id` and `vendorStock >= qty`) **before** creating the order, inside the same transaction. If count is 0, throw. Remove the silent skip (1138–1152).
4. `OrderItem.price` = cart line price just refreshed from `platformPrice`. Also store `vendorProductId`.
5. Child orders: one child per seller group whenever the fulfilling seller is a vendor, including a single-vendor cart, so `vendorAcceptOrder` / `vendorRejectOrder` (they require `parentOrderId`) work. Today a one-seller checkout has no child (1002 vs 1063).
6. `groupKey` = `seller.id`. Never a product id.
7. Commission: decide whether the base is customer `platformPrice` or vendor `vendorPrice`, and store the rate used on the order line. Increment `VendorProduct.totalUnitsSold` and `totalRevenue` in the same transaction.
8. Raise or remove `take: 500` on any remaining vendor query; page inside the transaction by the cart’s vendor product ids instead.

### Step 6 — Flip the single-active rule

1. Remove the `updateMany` deactivate block in `activate()`.
2. Drop the partial unique index from step 1.4.
3. Keep `(sellerId, productId)` unique so one seller still has one listing per catalog product.

### Step 7 — Platform-owned catalog migration

1. For each approved product: set `isPlatformOwned = true`, `sellerId = null`.
2. Ensure every product that should remain buyable has at least one `ACTIVE` `VendorProduct` with `platformPrice` and `vendorStock` copied from the old `Product.price` / `Product.stock` if no vendor row exists (otherwise the product becomes unroutable, change 1).
3. Deduplicate slugs, then enforce global slug uniqueness.
4. Point seller storefront, seller analytics, and seller “my products” at `VendorProduct`.
5. Leave historical `Order.sellerId` as-is. New orders carry `OrderItem.vendorProductId`.

### Step 8 — Returns, cancel, reject

1. Restock the `VendorProduct` on `OrderItem.vendorProductId`, not `order.sellerId`.
2. Do this for the line once. Multi-vendor parent and child both contain the same lines today (976–982 and 1052–1058); restock must not run for both. Prefer child lines when children exist, matching cancel (2510–2511), and use `vendorProductId` so a parent-order return still finds the vendor.
3. Vendor reject already increments vendor stock (2331–2339); point it at `orderItem.vendorProductId` and do not also increment a shared `Product.stock` unless that column is still a cache.

### Step 9 — Backfill and cleanup

1. Backfill `platformPrice` where status is `APPROVED` or `ACTIVE` and `platformPrice` is null (`vendorPrice` as default, matching `approve()`).
2. Recompute `Product.price` display cache as the minimum active `platformPrice`, and `Product.stock` cache as the sum of active `vendorStock`, in one job. Stop writing those columns from seller product forms.
3. Cart lines with null `vendorProductId`: if the product has exactly one ACTIVE offer, attach it; otherwise remove the line and surface “choose a seller” on the next cart load.

---

## 6. Regression test cases

These must pass before multiple active vendors are enabled.

### Lifecycle

1. Create listing → status `DRAFT`, second create for the same seller+product → 409.
2. Seller `SUSPENDED` cannot create, submit, update, or deactivate.
3. Submit from `DRAFT` and from `REJECTED` → `PENDING_APPROVAL`. Submit from `ACTIVE` or `APPROVED` → 400.
4. Approve without body → `platformPrice = vendorPrice`, `marginPercent = 0`, status `APPROVED`, product price unchanged.
5. Approve with `platformPrice` above and below `vendorPrice`. Below must not 500 on `Decimal(5,4)`; reject or clamp with a clear error.
6. Reject stores the reason. Seller can submit again.
7. Activate from `APPROVED` with stock > 0 → `ACTIVE`. Activate with stock 0 → 400. Activate from `DRAFT` → 400 (after B-01 fix).
8. Deactivate `DRAFT` → 400 (after B-01 fix). Deactivate `ACTIVE` → `INACTIVE`. Other vendors’ listings for other products stay `ACTIVE`.
9. Two concurrent activate calls for different vendors of the same product: while the single-active rule exists, exactly one row is `ACTIVE`. After step 6, both stay `ACTIVE`.
10. Edit `vendorPrice` on an `ACTIVE` listing → listing returns to `PENDING_APPROVAL` or `platformPrice` is explicitly recomputed (whichever policy step 2 chooses). Cart refresh does not keep the old price.

### Catalog and PDP

11. Product with only a `DRAFT` vendor row and `Product.stock > 0` remains visible until cutover, and after cutover is hidden until an offer is `ACTIVE` with stock. It must not disappear solely because a draft row exists (B-05).
12. Two ACTIVE offers: PDP lists both sellers, prices, and stock. Default offer is deterministic.
13. Add to Cart without `vendorProductId` when offers exist → 400. With a valid id → line stores that id and `platformPrice`.
14. Add to Cart against an `INACTIVE` or `REJECTED` offer → 400.
15. Quantity above that offer’s `vendorStock` → 400, even if `Product.stock` is higher. `allowBackorder: true` allows it.
16. Seller storefront for seller A shows A’s active offers only, priced at A’s `platformPrice`, including products whose `Product.sellerId` is null.

### Cart

17. Same product, two vendors, same variations → two cart lines. Same vendor added twice → one line, quantities summed.
18. 50 lines: adding a 51st distinct vendor offer → 400; increasing quantity on an existing line → success.
19. Vendor deactivated after add: next `getCart` or `recalculateCart` removes the line (or marks it unavailable) and totals exclude it.
20. `platformPrice` changes: next cart read updates `CartItem.price` and totals before checkout.
21. Guest add, then login merge, preserves `vendorProductId` and does not merge two vendors.
22. `getCart` after a price change does not return the old price (B-09).

### Checkout

23. Cart with vendor A at price 10 (stock 5) and vendor B at price 8 (stock 50): checkout charges 10 for A’s line and 8 for B’s line, creates two child orders (or one parent + two children), and decrements A by the A qty and B by the B qty. `Product.stock` is not the gate.
24. Highest-stock vendor is **not** selected when the cart line names the other vendor.
25. Single vendor cart still creates a child order the vendor can accept, and reject restores that vendor’s stock once.
26. Concurrent checkouts of the last unit: one succeeds, one gets “insufficient vendor stock”. Neither drives `vendorStock` negative.
27. Vendor deactivated between cart load and pay: checkout fails that line; no order, no stock change, cart lock released.
28. Idempotent retry returns the original order and does not decrement stock twice.
29. Multi-vendor shipping and discount split: sum of child shipping equals parent shipping within one cent; same for discount.
30. `'platform'` group is not used for a normal catalog product that has an offer.
31. `OrderItem.vendorProductId` is set. `OrderItem.price` equals the offer’s `platformPrice` at refresh time, not `Product.price`, when they differ.

### Cancel, reject, return

32. Cancel parent: each vendor’s `vendorStock` increases by the child line qty exactly once. `Product.stock` cache matches the sum of vendor stock afterward.
33. Vendor rejects one child of a two-vendor order: only that vendor’s stock returns. The other child stays open. Parent is not cancelled unless every child is rejected.
34. Return against the **parent** order restocks the vendor named on `OrderItem.vendorProductId`, not “nobody” because `parent.sellerId` is null.
35. Partial return qty restocks that qty only.
36. Return then a second return of the same units → 400, no double restock.

### Platform-owned migration

37. After `sellerId` null: PDP slug resolves to exactly one product. A second product cannot be created with the same slug.
38. Seller A’s storefront still lists products A fulfills via `VendorProduct`.
39. Seller B cannot `PUT` the platform product through the seller product API.
40. Historical orders created before the migration still open, cancel, and return using their stored `sellerId` when `vendorProductId` is null.

---

## 7. Recommended fixes (priority)

### P0 — Do before any of the four product changes

1. **Stop the approval bypass (B-01).** `activate()` only from `APPROVED`, or `INACTIVE` with `approvedAt` and non-null `platformPrice`. `deactivate()` must not run on `DRAFT`, `PENDING_APPROVAL`, or `REJECTED`.
2. **Make the single-active rule transactional** and add the partial unique index, until step 6 of the migration removes it (B-02).
3. **Treat `VendorProduct.platformPrice` and `vendorStock` as the charge and inventory source** on the PDP, cart refresh, and checkout, and persist `vendorProductId` on `CartItem` and `OrderItem` (B-03, B-04, change 3 and 4). Leave `Product.price` / `Product.stock` as a display cache only after backfill.
4. **Remove the silent vendor-stock skip** (B-08). Decrement by `vendorProductId`. If the row is missing or short, fail the checkout.
5. **Restock by `OrderItem.vendorProductId`** on cancel, vendor reject, and return, including parent orders with `sellerId` null (B-07).
6. **Storefront query** must use `VendorProduct.sellerId` before `Product.sellerId` is nulled (B-12).
7. **Global unique `Product.slug`** before seller ids are cleared (B-11).

### P1 — Required for multiple active vendors

8. Remove the deactivate-others block in `activate()` only after P0.3 is live.
9. Change cart identity to `(vendorProductId, variationOptions)` and guest merge (B-10).
10. Replace max-stock routing with the cart’s vendor. Create a child order even for a single vendor so accept/reject works.
11. Fix catalog eligibility so a `DRAFT` vendor row does not hide the product (B-05), then switch the predicate to “has a purchasable offer”.
12. PDP offer picker. Show seller name, `platformPrice`, stock, and lead time.
13. Refresh prices on `getCart`, not only on mutation (B-09).
14. On vendor price edit, invalidate `platformPrice` or re-enter approval (section 5 step 2).
15. Honor `allowBackorder`. Set `OUT_OF_STOCK` when stock hits 0 and backorder is off (B-15).
16. Define commission base (`platformPrice` vs `vendorPrice`) and update `totalUnitsSold` / `totalRevenue`.
17. Notifications for submit, approve, and reject (B-14).
18. Wrap `addGuestItem` in the same transaction as `addItem` (B-16).

### P2 — After the cutover

19. Seller product create should create or attach a `VendorProduct` and stop setting `Product.sellerId`.
20. Drop `Product.seller` as a fulfillment pointer. Keep it null for catalog rows.
21. Stop duplicating line items on parent and child without a restock rule, or mark parent lines as the customer view and child lines as the only stock-bearing rows and test both paths.
22. Remove the `take: 500` cap on the routing query once routing is by id list.
23. Backfill `platformPrice`, attach legacy cart lines, and recompute the `Product` price/stock cache in one job.

---

## File index

| File | Why it matters |
|---|---|
| `services/api/src/vendor-products/vendor-products.service.ts` | Lifecycle, single-active `updateMany` |
| `services/api/src/vendor-products/vendor-products.controller.ts` | Who may create, approve, activate |
| `services/api/src/vendors` DTOs under `vendor-products/dto/` | Fields accepted at create and approve |
| `services/api/src/sellers/sellers.service.ts` 51–61, 832–850 | Operate gate; dashboard counts by `Product.sellerId` |
| `services/api/src/cart/cart.service.ts` | Price and stock from `Product`; no vendor id |
| `services/api/src/cart/dto/add-to-cart.dto.ts` | `productId` + `quantity` + variations only |
| `services/api/src/orders/orders.service.ts` 502–1155, 2267–2358, 2506–2573 | Routing, child orders, decrement, reject, cancel |
| `services/api/src/returns/returns.service.ts` 1161–1206 | Restock uses `order.sellerId` |
| `services/api/src/products/products.service.ts` 304–325, 392–402, 569–645, 715–717 | Listing filter, storefront filter, slug, seller edit |
| `services/api/prisma/schema.prisma` 655–752, 794–850, 959–1004, 1044–1259, 1346–1399 | Models; no `vendorProductId` on cart or order lines |
| `apps/web/src/app/sellers/[slug]/SellerStorefrontClient.tsx` 128–135 | Storefront loads `Product.sellerId` |
| `apps/web/src/app/products/[id]/ProductDetailClient.tsx` 313–331, 459–466 | PDP price, stock, add to cart |

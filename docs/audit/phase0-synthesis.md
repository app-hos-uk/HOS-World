# Phase 0 synthesis — implementation rules

All five audits are in `docs/audit/`. This file is the order we will build in. The live US shop, checkout, web loyalty, and seller storefronts must keep today's behavior until a flag is turned on in staging. Nothing in this branch is pushed to production.

## Hard rule

Do not ship a schema change and a behavior change in different releases when the audit says they must land together. In particular:

- Do not set `Product.sellerId` to null until storefront, MeiliSearch, export, and seller edit read `VendorProduct`.
- Do not drop `LoyaltyMembership.userId` unique until every `findUnique({ userId })` (59 sites) and `User.loyaltyMembership` are market-aware.
- Do not add a global unique on `Product.slug` until a collision preflight has renamed duplicates, including soft-deleted rows.
- Do not turn on `isAnchorStore` gating until the real HOS outlets are backfilled to `true`. Default `false` would stop POS points everywhere.
- Do not use NULL as a "global" key in a Prisma `@@unique`. PostgreSQL treats nulls as distinct, and Prisma does not emit `NULLS NOT DISTINCT`.

New behavior is behind flags that default to the current path. Staging turns flags on. Production does not receive this branch.

## What the audits changed in the plan

| Planned change | Audit result | Build rule |
|---|---|---|
| Marketplace-owned catalog | Publish always sets `sellerId`. Duplicate check `sellerId != seller` misses NULL, so a platform row is invisible and a second product is inserted. `ProductSubmission.productId` is unique, so a second vendor's publish writes the listing then fails the submission link. | New `CatalogProductsService.createPlatformProduct` in one transaction. Keep `productId` unique only for the originating submission. |
| Multiple active vendors | Cart and checkout charge `Product.price` and `Product.stock`. `platformPrice` is never read. `CartItem` and `OrderItem` have no `vendorProductId`. `activate()` deactivates every other listing and is not transactional. | Add nullable `vendorProductId` first. Switch cart, PDP, and checkout to it while the single-active rule is still on. Only then allow multiple ACTIVE rows. |
| Close CSV bypass | Seller CSV calls `ProductsService.create` and skips the pipeline. | Map CSV rows to submissions. Do not do this until the submission write path is the only catalog writer. |
| Stop pushing products to Lightspeed | Push is a manual admin job. Sales, loyalty, and inventory do not call it. Existing `PRODUCT` mappings must stay. | No-op the push methods. Do not delete mappings or call `DELETE /products`. Also no-op `syncOnlineOrderToPos` (it writes outlet stock). Pull is read-only `GET /products` into the submission form. |
| Anchor stores | Web earn never loads a store. POS earn is only `processPosSale`. Ship-from-store is only `createClaimFromTill`. | Gate those two methods only, after backfill. Do not touch `processOrderComplete`. |
| Per-market loyalty | One wallet per user. Tiers are unique on `slug`, `name`, and `level`. | Widen all three tier uniques together. Backfill membership `marketId` from `regionCode`, then US. Rewrite lookups in the same release as the constraint drop. |
| Per-market founding members | `email` and `userId` are both globally unique. | This release: `@@unique([email, marketId])` only. Leave `userId` unique so one person still links to one founding-member row. |
| Per-market settings / integrations / templates | Nullable compound uniques do not stop two global rows. `getActiveIntegration` and `refreshFromDb` can pick the wrong row. | Store a non-null market id on every row (US market for today's globals). No NULL sentinel. |

## Build order

### Slice 1 — Additive only (no behavior change)

- `Store.isAnchorStore Boolean @default(false)` with no gate yet.
- `CartItem.vendorProductId` and `OrderItem.vendorProductId` nullable, unused by cart and checkout.
- `ProductSubmission.marketId` nullable.
- `FoundingMember.marketId`, `LoyaltyMembership.marketId`, `LoyaltyTier.marketId`, `PlatformSetting.marketId`, `IntegrationConfig.marketId`, `EmailTemplate.marketCode` nullable. Do not drop or replace existing unique indexes in this slice.
- Feature flags, default = current behavior: marketplace-owned catalog off, multi-vendor offers off, anchor gating off, POS product push still available until the flag is flipped in staging.

### Slice 2 — Offer identity, still one active vendor

- Cart, PDP, and checkout read `vendorProductId` and `platformPrice` / `vendorStock` when the flag is on. Flag off keeps `Product.price` and `Product.stock`.
- Restock and cancel use `vendorProductId` when set, else the current seller path.
- Fix `activate()` so it cannot promote a draft, and make the single-active update transactional.
- Seller storefront can list `VendorProduct` rows behind the flag, and still lists `Product.sellerId` when the flag is off.

### Slice 3 — Catalog ownership, flag off by default

- Slug preflight and partial unique index `WHERE "deletedAt" IS NULL` (raw SQL; Prisma cannot express it).
- Publish transaction: platform product plus originating `VendorProduct`, NULL-safe duplicate match.
- Backfill vendor rows before any `sellerId` nulling. Nulling runs only when the flag is on, and only after slice 2 reads are deployed.
- CSV import creates submissions, not products.

### Slice 4 — POS

- Flag off the product push and the online-order stock write.
- Read-only product pull into the submission form.
- Do not delete mappings. Hydrate SKU on sales poll via `GET /products/{id}` so unmapped lines can still match.

### Slice 5 — Markets (schema and queries together)

- Preflight, backfill to the US market, `SET NOT NULL`, add the new unique indexes, drop the old ones, and ship the query rewrite in one release.
- Loyalty tier `name` and `level` widen with `slug`.
- Anchor gate turns on only after outlet backfill.
- Web loyalty is not gated.

### Slice 6 — Frontends and Railway

- Global hub, US landing move, Malaysia landing and shop.
- Separate Railway services. Shared API. No production deploy from this branch.

## Explicit non-goals until a later slice

- Do not split existing point balances.
- Do not let one user be a founding member in two markets (`userId` stays unique).
- Do not gate web earn or POS burn on anchor stores.
- Do not delete Lightspeed products or historical mappings.
- Do not enable multiple ACTIVE vendors until cart lines carry `vendorProductId`.

## Slice 1 status

Additive only. No unique-constraint or UI behavior change. Existing US website, checkout, loyalty, storefront, and POS flows stay on the current path because the new flags default off. `MULTI_VENDOR_OFFERS` is read in slice 2; with it off, those branches are not taken.

Files changed:

- `services/api/prisma/schema.prisma` — nullable `marketId` FKs, `CartItem`/`OrderItem.vendorProductId`, `Store.isAnchorStore` default false, `EmailTemplate.marketCode`. Existing uniques left in place.
- `services/api/prisma/migrations/20261028120000_slice1_additive_market_columns/migration.sql` — `ADD COLUMN`, non-unique `CREATE INDEX`, and `FOREIGN KEY` only.
- `services/api/src/config/feature-flags.service.ts` — four flag keys and defaults. `isEnabled()` unchanged.
- `docs/audit/phase0-synthesis.md` — this note.

`packages/shared-types` has no feature-flag catalog, so the keys live only in `FeatureFlag` / `FLAG_DEFAULTS`. Model names matched the schema (`EmailTemplate` has no `@@map`, so the SQL table is `"EmailTemplate"`). `EmailTemplate.marketCode` is a nullable string, not a market foreign key.

## Slice 2 status

`MULTI_VENDOR_OFFERS` still defaults to false. With the flag off, cart, checkout, storefront, and seller product lists keep using `Product.price`, `Product.stock`, and `Product.sellerId`. The single-active vendor rule is still in force.

With the flag on:

- Add to cart accepts `vendorProductId`. One active offer is chosen automatically. Several active offers require the id. Price and stock come from `platformPrice` and `vendorStock`.
- Checkout groups a named offer by that seller and fails if that row cannot decrement. It does not pick the highest-stock vendor for that line.
- Cancel and vendor reject restock `OrderItem.vendorProductId` when it is set. Older orders with a null id keep the previous seller lookup.
- Seller storefront search and "my products" include that seller's active `VendorProduct` rows.
- `activate()` runs in one transaction. Reactivating an `INACTIVE` row that was never approved is rejected only when the flag is on.

Multiple ACTIVE listings are still deactivated on activate. That stays until cart lines are in use in staging.

## Slice 3 status

`MARKETPLACE_OWNED_CATALOG` still defaults to false. Publish and seller CSV stay on today's path until that flag is on.

No slug unique was added. A partial unique index on `Product.slug` where `deletedAt` is null still needs a collision preflight on a database snapshot. Existing `sellerId` values are not nulled by a migration.

With the catalog flag on:

- Seller CSV creates a product submission instead of a product. Approval still goes through the existing pipeline.
- Publish creates a platform product (`sellerId` null, `isPlatformOwned` true) and an originating `VendorProduct` only when `MULTI_VENDOR_OFFERS` is also on, so storefront reads already use the vendor row. If only the catalog flag is on, publish stays on the current seller-owned create.
- Duplicate matching includes platform rows (`sellerId` null). A second submission for the same product does not write `ProductSubmission.productId` when another submission already holds that id.
- The single-active vendor rule still deactivates the other listings on that product.

## Slice 4 status

`POS_PRODUCT_PUSH` still defaults to true, so product push and the online-order stock write keep running.

With the flag off:

- Product sync returns without calling Lightspeed. The admin sync button is hidden. New connections default `autoSyncProducts` to false.
- `syncOnlineOrderToPos` returns without writing outlet stock. Sales import and in-store stock decrement are unchanged. Mappings are not deleted.

Sales poll now hydrates a missing SKU with a read of `GET /products/{id}`, the same read ship-from-store already uses. A seller with a Lightspeed connection can search that catalogue and pre-fill a submission. Publish writes an `ExternalEntityMapping` only when the submission carries a Lightspeed product id. It does not POST a product.

## Slice 5 status

`ANCHOR_STORE_GATING` still defaults to false. POS points and ship-from-store are unchanged until that flag is on, and the flag should stay off until the real House of Spells outlets are marked as anchor stores in admin.

`MARKET_CATALOG` still defaults to false. A product with no `ProductMarket` row stays visible. The shop list filters by `x-market-code` only when the flag is on and the header is present. The US shop does not store a market code, so its list is unchanged.

Existing rows are backfilled to the US market. Unique constraints are not dropped. `LoyaltyMembership.userId` stays unique, so each person still has one wallet. Web earn is not gated.

## Slice 6 status

The landing page stays the Times Square site unless `NEXT_PUBLIC_MARKET_CODE=MY` or `NEXT_PUBLIC_SITE_ROLE=hub`. The hub suggests a country from Cloudflare and does not redirect. Railway service names and DNS are in `docs/expansion/railway-and-dns.md`. Nothing in this branch is deployed.

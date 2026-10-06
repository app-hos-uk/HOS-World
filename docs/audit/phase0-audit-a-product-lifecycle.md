# Phase 0 Audit A — Product Lifecycle

Audit date: 2026-10-06. Scope is the live code in `services/api` and the seller storefront in `apps/web`. Every creation, update, query, submission, slug, and delete path below was read in source. Line numbers refer to that source.

Planned changes this audit is scored against:

1. Approved products become marketplace-owned (`isPlatformOwned: true`, `sellerId: null`).
2. The original submitting seller receives a `VendorProduct`, same as any later seller.
3. Multiple `ACTIVE` vendors per product (remove the single-active-vendor rule).
4. Seller bulk CSV import goes through the submission pipeline. Sellers no longer create `Product` rows directly.

---

## 1. Current flow diagrams

There is no single product factory. Six runtime paths insert a `Product`. A seventh path (`VendorProduct`) attaches a seller to an existing product and does not insert a `Product`.

### Path 1 — Seller / catalog direct create (`POST /products`)

Controller: `services/api/src/products/products.controller.ts` lines 139–164.
Roles: `ADMIN`, `CATALOG` only (`Roles` + `products.create` / `GLOBAL`). Sellers are rejected here. The swagger text says vendors must use vendor-products. The service still writes a seller-owned row.

```
POST /products  (JWT user id)
  └─ ProductsService.create(userId, CreateProductDto)          products.service.ts:60
       ├─ User lookup by id                                    :62-65
       ├─ Seller lookup by userId                              :67-69
       ├─ If no seller AND role === ADMIN:
       │    create Seller "House of Spells"                    :71-83
       │    slug admin-store-{first 8 of userId}
       ├─ If still no seller → 404                             :85-89
       │    (CATALOG with no seller profile dies here.
       │     ADMIN auto-provision does not run for CATALOG.)
       ├─ price >= 0, stock >= 0 if present                    :91-102
       │    price 0 and empty description are allowed
       ├─ slug = slugify(name); bump "-1", "-2"… while
       │    product.findUnique({ sellerId_slug }) hits         :104-116
       ├─ optional categoryId / tagIds / attributes checks     :118-168
       └─ prisma.product.create                                :171-269
            sellerId = seller.id          ALWAYS               :173
            isPlatformOwned omitted → schema default false     schema.prisma:658
            status = dto.status || DRAFT                       :191
            images, variations, tagsRelation, attributes       :194-232
            legacy tags string[] and category string kept      :188-189
       └─ cache hook + Meili index (fire-and-forget)          :274-283
```

`CreateProductDto.imageUrls` (`create-product.dto.ts:168`) is never read. Only `images[]` is persisted.

`parentProductId` is written with no existence check (`products.service.ts:193`).

There is no SKU / barcode / EAN duplicate check on this path. There is no `validatePublishReadiness`. A caller can persist `status: 'ACTIVE'` with no images and a one-character description.

### Path 2 — Admin create (`POST /admin/products`)

Controller: `services/api/src/admin/products.controller.ts` lines 39–134. Role: `ADMIN` only.
Service: `AdminProductsService.createProduct` (`admin/products.service.ts:71`). This does **not** call `ProductsService.create`.

```
POST /admin/products
  └─ createProduct(body)                                       admin/products.service.ts:71
       ├─ Always (even DRAFT):
       │    name non-empty                                     :115-117
       │    description trim length >= 10                      :118-120
       │    at least one image                                 :121-123
       │    categoryId OR fandom                               :124-126
       ├─ If status === ACTIVE → validatePublishReadiness      :129-131
       │    price > 0, image count > 0, name, description,
       │    category or fandom                                 :26-68
       ├─ If sellerId set, Seller must exist (by Seller.id)    :134-141
       ├─ If isPlatformOwned → force sellerId = null           :143-146
       ├─ category / tags / attributes / image URL (new URL()) :148-212
       ├─ SKU | barcode | EAN duplicate among ACTIVE+DRAFT     :214-238
       │    blocks create; tells caller to use Vendor Products
       ├─ slug = slugify(name); bump while ANY product
       │    has that slug (findFirst, global, not per seller)  :240-248
       └─ prisma.product.create                                :271-364
            sellerId = data.sellerId     (null if platform)    :284
            isPlatformOwned = data.isPlatformOwned || false    :285
            status = data.status || DRAFT                      :286
            images, variations (normalized), tags, attributes  :301-339
       └─ cache + Meili                                        :367-375
```

If the body omits both `sellerId` and `isPlatformOwned`, the row is stored as `sellerId: null`, `isPlatformOwned: false`. It is owned by nobody and is not flagged as platform inventory.

Admin slug checks are global. Seller slug checks are per seller. The database constraint is neither (see A5).

### Path 3 — Seller bulk CSV / JSON import (`POST /products/import`)

Controller: `products.controller.ts:281-326`. Roles: `SELLER_ROLES` only.
`<= 10` rows run inline. `> 10` rows enqueue `JobType.BULK_IMPORT`, which calls the same `importProducts` (`products-bulk.service.ts:18-24`, `:165`).

```
POST /products/import
  └─ ProductsBulkService.importProducts(userId, rows)          :165
       ├─ Seller must exist (lookup by userId)                 :174-180
       └─ for each row:
            ├─ getImportValidationErrorsAsync                  :190
            │    name required                                 :139-141
            │    price < 0 rejected; price missing → later 0   :142-143
            │    stock < 0 rejected                            :145-147
            │    SKU duplicate only for THIS seller.id         :129-135, :156-160
            │    NO description / image / category / fandom
            │    NO global SKU check
            │    NO within-batch SKU check (both rows pass
            │      if neither exists yet)
            └─ productsService.create(userId, mapped dto)      :213-244
                 status = row.status || DRAFT                  :228
                 description = row.description || ''           :215
                 price = Number(price) || 0                    :219
                 images split on '|'                           :229-242
                 variations = JSON.parse if present            :243
                 category is the legacy string only
                 categoryId, tagIds, attributes, shortDescription
                   are not forwarded
```

This **does** call `ProductsService.create`. It inherits seller ownership, per-seller slugs, and the lack of publish-readiness. It does **not** create a `ProductSubmission`. Dry-run `POST /products/import/validate` (`:82`) uses the same weak checks and writes nothing.

`exportProducts` (`:37-79`) selects `where: { sellerId: seller.id }`. After products are platform-owned, a seller's export returns an empty file even if they have active vendor listings.

### Path 4 — Publish (`PublishingService.publish`)

Entry: submission must be `FINANCE_APPROVED` and must have a `CatalogEntry` (`publishing.service.ts:50-58`).

```
publish(submissionId, userId)
  ├─ Load submission + seller + catalogEntry + marketingMaterials  :37-44
  ├─ Price from submission.pricingData.finalPrice                  :64-72
  │    else regex on financeNotes "Final: £|$X" / "Margin: N%"     :74-80
  │    else productData.price, margin 0.15
  ├─ Images: catalogEntry.images (string[]) if non-empty           :84-91
  │    else productData.images (string or {url})
  ├─ Duplicate probe (SKU, else barcode, else EAN)                 :96-116
  │    status in ACTIVE, DRAFT
  │    AND sellerId NOT EQUAL TO submission.seller.id
  │    findFirst, no orderBy
  ├─ If no identifier AND catalogEntry.title:
  │    exact name match, same sellerId exclusion                   :120-137
  │
  ├─ IF existingProduct:                                           :141-195
  │    VendorProduct for (submission.seller.id, existingProduct.id)
  │    create if missing, else increment vendorStock               :158-187
  │    status ACTIVE, vendorPrice = finalPrice
  │    THIS WRITE IS OUTSIDE THE LATER TRANSACTION
  │    Does NOT call VendorProductsService.activate()
  │    so it does NOT deactivate other ACTIVE vendors
  │
  └─ ELSE:                                                         :196-228
       productsService.create(submission.seller.userId, {
         name: catalogEntry.title,          NOT productData.name
         description: catalogEntry.description,
         sku, barcode, ean, tradePrice, rrp from productData,
         price: finalPrice,
         taxRate: > 1 ? taxRate/100 : taxRate,
         stock: selectedQuantity || productData.stock || 0,
         fandom, category, categoryId, tags (legacy string[]),
         status: ACTIVE,
         images from URLs above,
         variations: productData.variations || [],
       })
       → seller-owned, isPlatformOwned stays false
       → no tagIds, no attributes, no shortDescription
       → no VendorProduct for the submitting seller

  THEN a transaction:                                              :232-267
       re-read submission; abort if already PUBLISHED
       set submission.productId = product.id, status PUBLISHED
       create ProductPricing if none exists for that product
```

`unpublish` (`:326-361`) sets the **Product** to `INACTIVE` and the submission back to `FINANCE_APPROVED`. It does not touch `VendorProduct`.

### Path 5 — Bundle create (`POST /products/bundles`)

`bundle.controller.ts:26-46` → `ProductsService.createBundle` (`products.service.ts:1206`).

```
ADMIN: seller key = createDto.sellerId
everyone else: seller key = req.user.id
  └─ seller lookup is findUnique({ userId })                      :1208-1214
       (DTO field is named sellerId but queried as User.id.
        Passing a Seller.id 404s. ADMIN with no sellerId 404s.
        ADMIN is NOT auto-provisioned, unlike Path 1.)
  └─ items must be non-empty                                      :1217-1219
  └─ each item product must be seller-owned OR isPlatformOwned    :1221-1232
  └─ per-seller slug loop                                         :1234-1246
  └─ prisma.product.create productType BUNDLED, status DRAFT      :1252-1273
       sellerId = seller.id
       isPlatformOwned omitted → false
       bundleItems created
```

`GET /products/bundles/:id` is `@Public()` and calls `findOne(id, undefined, true)` (`bundle.controller.ts:57`). See bug B12: the public status gate is skipped whenever bundle items are included.

### Path 6 — Dev seed only

`services/api/prisma/seeds/finance-seed.ts:82-94` inserts `Product` rows directly (`sellerId` set, `status: ACTIVE`, slug from a local regex, not `slugify`). Not a production path. It will violate a future global slug unique index if those names already exist.

### Path 7 — Vendor listing (does not create a Product)

`VendorProductsService.create` (`vendor-products.service.ts:23-72`):

```
assertSellerCanOperate
product must exist
@@unique([sellerId, productId]) else 409
insert VendorProduct status DRAFT
```

Approval (`:240-272`) sets `APPROVED`, not `ACTIVE`.
`activate` (`:294-319`) requires `APPROVED` or `INACTIVE`, stock > 0, then sets every other `ACTIVE` row for that `productId` to `INACTIVE`, then sets this row `ACTIVE`.

Publish (Path 4) writes `ACTIVE` directly and skips this deactivation. The single-active rule is only enforced on the activate endpoint.

### Submission create (does not create a Product)

`POST` handler → `SubmissionsService.create` (`submissions.service.ts:26-138`).

```
Seller by userId, else 404
2-minute same-name window among this seller's SUBMITTED rows     :36-56
If sku|barcode|ean: block when ANY ACTIVE/DRAFT product matches   :58-82
  message tells the seller to "List as Vendor"
name required; price must be a number > 0                          :84-93
  (DTO @Min(0) allows 0; the service rejects 0)
Persist ONE json blob productData + status SUBMITTED               :95-133
duplicatesService.detectDuplicates(submission.id)                  :136
```

`bulkCreate` (`:699-792`) is a different mapper. It does not call `create()`.

### Seller storefront read

`apps/web/src/app/sellers/[slug]/SellerStorefrontClient.tsx:111-144`:

```
GET seller by slug → seller.id
GET /products?sellerId={seller.id}&status=ACTIVE&limit=50
```

`GET /products` → `ProductsService.findAll` (`products.service.ts:288`).
`status` is ignored unless `searchDto.isAdmin` is true (`:293-299`). That flag is undecorated on `SearchProductsDto` (`search-products.dto.ts:95`) and `ValidationPipe` is `whitelist: true` (`main.ts:532-534`), so the query string cannot set it. The controller never sets it either. Public listings are always `ACTIVE`. The client's `status: 'ACTIVE'` is a no-op.

Seller filter (`products.service.ts:392-403`): resolve `Seller` by `userId` OR `id`, then `where.sellerId = seller.id`. That is `Product.sellerId`, not `VendorProduct.sellerId`.

Public seller profile product count is the same relation: `sellers.service.ts:267-272` counts `products` where `status: ACTIVE`.

### Marketplace search (not `findAll`)

`ProductsService.findAll` never calls MeiliSearch. Meili is a separate read path:

- Storefront `apps/web/src/app/products/page.tsx` searches Meili first. On throw, it calls `apiClient.getProducts` → `findAll` (`page.tsx:391-407`).
- `MeilisearchService.search` (`meilisearch.service.ts:479`):
  - client missing → `fallbackSearch` (`:480-481`)
  - search throws → `fallbackSearch` (`:598-600`)
  - search returns 0 hits but the DB fallback total is > 0 → serve DB and schedule a full reindex (`:580-588`)
- `fallbackSearch` (`:777-869`) is Prisma `product.findMany`. `filters.sellerId` becomes `where.sellerId` (`:826`). Same column as `findAll`.
- Indexed document stores a single `sellerId: product.sellerId || null` (`:405`).

---

## 2. Field mapping — submission DTO vs what is stored vs what publish uses

### `CreateSubmissionDto` (`create-submission.dto.ts`)

| DTO field | Lines | `create()` productData | `bulkCreate()` productData | `publish()` → Product |
|---|---|---|---|---|
| name | 49 | yes `:96` | yes `:757` | **dropped.** Product name is `catalogEntry.title` (`publishing.service.ts:200`) |
| description | 54 | yes `:97` | yes `:758` | **dropped.** Product description is `catalogEntry.description` (`:201`) |
| shortDescription | 58 | yes `:98` | **dropped** (not in the object at `:756-775`) | **dropped** |
| sku, barcode, ean | 62-70 | yes | yes | copied onto Product (`:202-204`) |
| price | 75 | yes | yes | not the product price. Product price is finance `finalPrice` (`:205`). `productData.price` is only the pricing `basePrice` fallback (`:258`) |
| tradePrice, rrp | 80-85 | yes | yes | copied (`:206-207`) |
| currency | 89 | yes, default `PLATFORM_DEFAULT_CURRENCY` (`USD`, `currency-defaults.ts:6`) | yes | copied, same default (`:208`) |
| taxRate | 94 | yes | yes | copied, divided by 100 when `> 1` (`:209`). Seller create does not divide |
| stock | 99 | yes | yes | used only if `selectedQuantity` is null (`:210`) |
| quantity | 132 | yes `:108` | yes `:768` | **dropped.** Publish never reads `productData.quantity` |
| fandom | 103 | yes | yes | copied (`:211`) |
| category (legacy string) | 107 | yes | yes | copied (`:212`) |
| categoryId | 111 | yes | yes | copied (`:213`) |
| tags `string[]` | 116 | yes | yes | copied as legacy `tags`, **not** `tagIds`. No `ProductTag` rows (`:214`) |
| images `{url,alt,order}[]` | 122 | yes, stored as objects | yes | used only when `catalogEntry.images` is empty. URLs extracted (`publishing.service.ts:84-91`) |
| variations | 128 | yes | yes | passed through (`:222`). Shape is `{name, options:{name,value}[]}`. Seller create stores that JSON as-is. Admin create normalizes options to `{value,price,stock,imageUrl}` |

Not on the DTO at all, so they can never survive a submission: `tagIds`, `attributes`, `brand`, `weight`, `length`, `width`, `height`, `metaTitle`, `metaDescription`, `productType`, `parentProductId`, `taxClassId`.

`CatalogEntry` columns (`schema.prisma:1704-1718`): `title`, `description`, `images` are consumed. `keywords`, `specs`, `completedBy`, `completedAt` are never copied onto the product.

`marketingMaterials` are loaded in `publish` (`publishing.service.ts:42`) and never read.

### Duplicate detection (three different implementations)

| Gate | Where | What it matches | Same-seller? | Null `sellerId`? |
|---|---|---|---|---|
| 2-minute name window | `submissions.service.ts:36-56` | this seller, status `SUBMITTED` only, exact trimmed name | n/a | n/a |
| Catalog identifier block | `submissions.service.ts:58-82` | any `ACTIVE`/`DRAFT` product, SKU or barcode or EAN | yes, blocks own products too | **yes, null sellerId matches** (no seller filter) |
| `bulkCreate` | `:715-751` | in-batch lowercased name, plus pending `SUBMITTED`/`UNDER_REVIEW` names | names only | **no SKU check at all** |
| `checkDuplicates` | `:446-584` | scans up to 500 products; SKU/barcode/EAN score 100; name similarity ≥ 80 | splits into `sellerActiveMatches` vs `catalogueMatches` by `product.sellerId === seller.id` | platform rows (`sellerId` null) land in `catalogueMatches` |
| Publish link-vs-create | `publishing.service.ts:108-127` | SKU/barcode/EAN, else exact `catalogEntry.title`, status `ACTIVE`/`DRAFT` | **excluded** via `sellerId: { not: submission.seller.id }` | **missed.** Prisma/SQL `<>` does not match NULL |
| Admin create | `admin/products.service.ts:214-238` | SKU/barcode/EAN among `ACTIVE`/`DRAFT` | yes | yes |
| Seller create / bulk | none / per-seller SKU only | `products-bulk.service.ts:129-135` | per `Product.sellerId` | platform rows are invisible to this check |

`checkDuplicates` loads 500 products with no `orderBy` (`submissions.service.ts:468-482`). Matches beyond that page are invisible.

Name duplicate at publish is case-sensitive equality on `catalogEntry.title` (`publishing.service.ts:124`). `"Wand"` and `"wand"` are different products.

`INACTIVE` products are invisible to every identifier check. Re-submitting a discontinued SKU creates another product.

---

## 3. Update paths

### Seller `ProductsService.update` (`products.service.ts:696-898`)

Who can call it: `PUT /products/:id` allows `ADMIN`, `CATALOG`, and `SELLER_ROLES` (`products.controller.ts:166-168`). The service then ignores the role.

Ownership (`:711-717`):

```
seller = Seller where userId = caller
forbid unless product.sellerId === seller.id
```

A seller cannot update a product they do not own. A platform product (`sellerId: null`) fails the equality and is forbidden for every seller, including the original submitter. `ADMIN` and `CATALOG` are subject to the same check. They cannot edit an arbitrary catalog product through this route. Catalog-wide edits exist only on `PUT /admin/products/:id`, which is `ADMIN` only (`admin/products.controller.ts:34-35`).

Fields written (`:787-805`): name, description, shortDescription, sku, barcode, ean, price, tradePrice, rrp, currency, taxRate, stock, fandom, legacy category, legacy tags, categoryId, status.

Guards: price ≥ 0, stock ≥ 0, category exists, tag ids exist, attribute ids exist (`:719-784`). **No publish-readiness.** `status` is copied from the body (`:804`), so a seller can flip a product to `ACTIVE` with no images.

Silently ignored even though `UpdateProductDto` declares them (`update-product.dto.ts:42-58`): `images`, `variations`. Slug is not regenerated when the name changes.

Tag and attribute replacement deletes rows **before** the product update and **outside** a transaction (`:810-839`). A failed `product.update` leaves the product with no tags or attributes.

Attribute text on create accepts `attr.value || attr.textValue` (`:226`). On update only `attr.textValue` is stored (`:833`). A client that sends `value` (the create shape) wipes the text on update.

`bulkUpdate` (`:900-983`) is seller-only and filters `id in productIds AND sellerId = seller.id`. Any id not owned → 403 for the whole batch (`:926-928`). It can set `status`, `stock`, and a percent price change. Same missing publish gate. Same `sellerId` column, so it will not see platform-owned products.

### Admin `AdminProductsService.updateProduct` (`admin/products.service.ts:380-675`)

No ownership check. Any product id.

`validatePublishReadiness` runs only when `data.status === 'ACTIVE'` **and** the current status is not already `ACTIVE` (`:435-437`). An already-live product can have its images replaced with `[]` (`:554-567`) or its price set to 0 without a readiness check.

Capabilities beyond the seller update:

- replace images (delete all, then create) `:554-567`
- replace variations via `createMany` **before** the product update `:584-611` (also outside the transaction; a later failure leaves new variations in place after the old ones were deleted)
- replace tags and attributes the same non-transactional way `:569-633`
- change `sellerId` (validated only when non-null and different) `:439-449`
- SEO, dimensions, tax class, trade price, RRP, SKU, barcode, EAN, fandom, productType
- regenerate slug globally when `name` changes (`:519-534`), with no redirect

`isPlatformOwned` is not in the TypeScript body type (`admin/products.controller.ts:180` onward, create type has it, update type's documented schema does not). The handler is not a class-validator DTO, and the service spreads remaining scalars into Prisma (`:539-551`). A raw JSON `isPlatformOwned` would be written. `sellerId: null` can be written **without** setting `isPlatformOwned: true`, producing an ownerless row.

Setting `sellerId` to another seller does not check the `(sellerId, slug)` unique index before the write. A slug collision throws a raw Prisma error.

---

## 4. Query / display paths

### `findAll` (`products.service.ts:288-485`)

- Page default 1, limit default 20, cap 100 (`:289-291`).
- Status forced to `ACTIVE` (see storefront section). The `isAdmin` branch is dead code from HTTP.
- When status is `ACTIVE` and table `vendor_products` exists (`:34-46`, result cached for the process lifetime):

```
OR
  vendorProducts none AND stock > 0 AND price > 0
  vendorProducts some { status ACTIVE, vendorStock > 0, vendorPrice > 0 }
```

(`:308-325`). The comment at `:304-305` says this is "platform-owned (no vendor mapping)". The code does **not** test `isPlatformOwned`. Any product with zero vendor rows and positive stock and price is listed, including seller-owned direct creates.

If the table probe fails, the filter falls back to `stock > 0 AND price > 0` only (`:326-331`). The probe is cached (`vendorTableChecked`), including a `false` from a transient error (`:41-44`).

- Text `query` is a top-level `OR` on name, description, fandom (`:335-341`). It is ANDed with the eligibility `OR`. Description search has no vendor-price awareness.
- `sellerId` query: resolve seller, then `Product.sellerId` (`:392-403`). If the id matches no seller, the filter is **dropped** and the response is the global catalog (`:400-402`).
- `inStock: false` sets `where.stock = 0` (`:415-420`) while eligibility already requires `stock > 0` inside `AND`. The intersection is empty. Out-of-stock browsing returns nothing on the public list.
- Attribute filters use one `attributes.some.OR` across every filter (`:366-389`). A product matching any single filter is returned. Multi-select facets are OR, not AND.
- `sortBy: popular` orders by `reviewCount` only (`:435-439`). The comment claims a secondary `averageRating` sort. That sort is not applied.
- `mapToProductType(..., false)` hides seller on list rows (`:477`).
- Soft-deleted rows are hidden here because `findMany` is in the extension's filtered operations (`prisma-soft-delete.ts:7`, `:16-27`).

### `findOne` / slug

There is no `findById`. The public controller (`products.controller.ts:77-80`):

- UUID → `findOne(id)` 
- anything else → `findBySlugOnly(id)`

`GET /products/slug/:slug` also calls `findBySlugOnly` (`:96-97`).

`findOne` (`:487-567`):

- `findUnique` by id. The soft-delete extension does **not** wrap `findUnique` (`prisma-soft-delete.ts:7`). A row with `deletedAt` set is still loaded.
- Public gate (`:561-564`): if status is not `ACTIVE` and both `includeSeller` and `includeBundles` are falsy → 404.
- Passing either flag bypasses the gate. `GET /products/bundles/:id` passes `includeBundles: true` on a public route (`bundle.controller.ts:57`). Draft and inactive bundles are readable without auth.
- Include list does not add a `deletedAt: null` predicate.

`findBySlug(sellerSlug, productSlug)` (`:569-637`):

- Resolves `Seller.slug`, then `findUnique` on `sellerId_slug`.
- **No status check.** A draft would be returned.
- **No controller calls this method.** Public URLs are global-slug, not `/{sellerSlug}/{productSlug}`.

`findBySlugOnly` (`:639-694`):

- `findFirst({ slug, status: ACTIVE })` by default. `findFirst` does hide `deletedAt`.
- No `orderBy`. If two live rows share a slug, which one is returned is undefined.
- `requireActive: false` exists but the public controller never passes it.

`mapToProductType` seller block (`:1191-1198`) reads `product.seller.userId`, but every include in this file selects only `id, storeName, slug`. `userId` is always undefined, so `mapped.sellerId` becomes `seller.id`.

### Meili vs `findAll` mismatch that will show up after the ownership change

| Behavior | Meili / `fallbackSearch` | `findAll` |
|---|---|---|
| Seller filter | `sellerId = "<Product.sellerId>"` (`meilisearch.service.ts:513-514`, `:826`) | `Product.sellerId` (`products.service.ts:401`) |
| Stock gate | `inStock` → `stock > 0` on the product (`:525-527`, `:832`) | vendor stock **or** product stock (`:313-324`) |
| Price filter | product `price` | product `price` |
| Inactive | `isActive = true` unless `includeInactive` | always `ACTIVE` from HTTP |
| Platform flag | indexed (`:417`) but storefront seller queries do not filter on it | not filtered |

`browseCatalogForVendor` (`submissions.service.ts:587-696`) searches Meili with `includeInactive: true` and then overlays this seller's `VendorProduct`. That path already understands multi-vendor. The public storefront does not.

---

## 5. Slug uniqueness (A5)

Schema (`schema.prisma:735`):

```
@@unique([sellerId, slug])
```

Migration `services/api/prisma/migrations/20251201000000_init/migration.sql:1824`:

```sql
CREATE UNIQUE INDEX "products_sellerId_slug_key" ON "products"("sellerId", "slug");
```

This is a plain PostgreSQL unique index. It is not `NULLS NOT DISTINCT` (PostgreSQL 15+). In PostgreSQL, `NULL` is distinct from `NULL` inside a unique index, so two rows `(sellerId NULL, slug 'elder-wand')` are both legal. Confirmed by the migration SQL: there is no partial index on `slug` and no `UNIQUE (slug)`.

`sellerId` is optional (`schema.prisma:657`).

### How slugs are generated

`slugify` (`packages/utils/src/slug.ts:4-14`): lower case, trim, spaces to `-`, strip non-word characters. A name of `"!!!"` becomes `""`.

| Writer | Collision check | Namespace |
|---|---|---|
| `ProductsService.create` `:104-116` | `findUnique({ sellerId_slug: { sellerId: seller.id, slug } })` | that seller only |
| `createBundle` `:1239-1245` | same | that seller only |
| `AdminProductsService.createProduct` `:245-247` | `findFirst({ where: { slug } })` | all non-deleted products (findFirst is soft-delete filtered) |
| `AdminProductsService.updateProduct` `:526-532` | `findFirst({ slug, id not this })` | global, and it **rewrites** the live slug when the name changes |
| Publish | uses `ProductsService.create`, so per-seller | the submitting seller |
| finance seed | none | can collide |

Seller create never looks at platform rows (`sellerId` null) or at other sellers. Two sellers can both own `elder-wand`. `findBySlugOnly` then returns an arbitrary one. That bug exists today.

The seller collision loop cannot be reused for `sellerId: null`. `findUnique` on a compound unique rejects a null component (Prisma validation: the unique input field must not be null). Even if it did not, the database would not reject the duplicate.

Admin's global `findFirst` is application-level only. Two concurrent admin creates can both pass the loop. The database will not stop them when `sellerId` is null. Soft-deleted rows are hidden from `findFirst`, so a new product can take the slug of a merged product (`deletedAt` set, slug unchanged, `admin/products.service.ts:999-1003`).

There is no max on the counter. A pathological slug still terminates, but the suffix is unbounded.

---

## 6. Deletion and deactivation (A6)

`deletedAt` exists on `Product` (`schema.prisma:732-733`) and is indexed (`:740`). The extension (`prisma-soft-delete.ts:5-7`) adds `deletedAt: null` only for `findMany`, `findFirst`, `findFirstOrThrow`, and `count`. It does not affect `findUnique`, `update`, or `delete`.

### What the code actually does

| Operation | Behavior | Lines |
|---|---|---|
| Seller `ProductsService.delete` | Hard `product.delete` after cart cleanup. Not a soft delete. | `products.service.ts:985-1025` |
| Admin `deleteProduct` | Same hard delete | `admin/products.service.ts:1020-1053` |
| `mergeProducts` | The only soft delete: `status: INACTIVE`, `deletedAt: now()` | `admin/products.service.ts:999-1003` |
| `unpublish` | `status: INACTIVE` only. `deletedAt` stays null. Product disappears from `findAll` and from Meili, row remains | `publishing.service.ts:342-346` |

Seller and admin delete both:

1. 404 if missing, 403 if seller caller does not own it (`products.service.ts:1000-1002`).
2. 400 if any `OrderItem` exists (`:1004-1008`, admin `:1030-1034`).
3. `cartItem.deleteMany` then `product.delete` in a transaction.

They do **not** check `ProductSubmission`. `productId` on `ProductSubmission` has no `onDelete` (`schema.prisma:1635-1636`). Prisma's default is `Restrict`. A published product whose submission still points at it **cannot be hard-deleted**; the transaction throws a foreign-key error after the order-item check has passed. `Discrepancy.product` is also Restrict with no `onDelete` (`schema.prisma:2388-2389`).

### Cascades when a hard delete succeeds

From `schema.prisma`, `onDelete: Cascade` from `Product`:

- `ProductImage` `:894`
- `ProductVariation` `:913`
- `ProductTag` `:2841`
- `ProductAttribute` `:2722`
- `ProductReview` `:1278`
- `WishlistItem` `:1309`
- `ProductPricing` `:1739` (`productId` is also `@unique`)
- `DuplicateProduct` `:1758`
- `ProductView` `:757`
- `ProductBundleItem` both sides `:924-926`
- `VolumePricing` `:942`
- `VendorProduct` `:811`
- `InventoryLocation` `:3087`
- `StockTransfer` `:3140`
- `StockMovement` `:3172`
- `ReturnPolicy` `:1324`
- `InfluencerProductLink` `:3512`
- `ProductChannel` `:4329`
- `ProductMarket` `:281`
- child variants via `parentProduct` `onDelete: Cascade` `:681`

`onDelete: SetNull`: `UGCSubmission` `:4033`, `SkuCustomsAttribute` `:4611`, `POSSaleItem` `:4633`.

No cascade, delete is blocked unless rows are removed first:

- `CartItem` `:998` — removed manually
- `OrderItem` `:1250` — blocked by the count check, and the message tells the caller to set Inactive. Neither delete method offers that Inactive update itself
- `ProductSubmission` `:1635` — **not handled**
- `Discrepancy` `:2389` — **not handled**

`VendorProduct` rows die with the product (cascade). They are not detached or archived. `OrderItem` does not store `vendorProductId`; historical orders point only at `Product`.

Deleting a `Seller` cascades to `Product` (`schema.prisma:657`, `onDelete: Cascade`). Today that attempts to delete every product that seller owns, and then hits the same `OrderItem` / `ProductSubmission` restricts. After `sellerId` is null, seller deletion no longer takes the catalog product with it. That part of the planned model is safer. Vendor rows still cascade from the seller (`VendorProduct.seller` `onDelete: Cascade`, `:809`), so deleting a seller deletes their listings, not the product.

---

## 7. Bugs

### B1 — Publish duplicate link does not see platform-owned products

`publishing.service.ts:108-115` and `:120-127`. `sellerId: { not: submission.seller.id }` is SQL `sellerId <> $id`, which excludes `NULL`. Once `sellerId` is null, every publish of an existing SKU misses the catalog row and calls `productsService.create`, inserting a second seller-owned product. The planned "attach a VendorProduct" branch never runs for marketplace-owned catalog items.

### B2 — Second publish onto an existing product cannot save `submission.productId`

`schema.prisma:1635-1636`: `productId String? @unique`, and `Product.submission` is a single optional relation (`:696`). The first submission already holds that id. The second submission's update (`publishing.service.ts:242-248`) throws a unique violation.

The `VendorProduct` insert/stock increment at `:158-187` is **outside** that transaction. The vendor row commits, then the submission update rolls back. A retry hits the `existingVP` branch and **increments `vendorStock` again** (`:183`) before failing the same unique constraint. Each retry doubles the listed stock.

### B3 — Single-active-vendor rule is only on one endpoint, and publish violates it

`vendor-products.service.ts:306-314` deactivates other `ACTIVE` listings. `PublishingService.publish` inserts `status: 'ACTIVE'` (`publishing.service.ts:170`) without that update. Two active vendors can exist today if the second arrived through publish. `approve()` sets `APPROVED`, not `ACTIVE` (`vendor-products.service.ts:258`), so the rule and the publish path disagree about what "on sale" means.

Removing the rule means deleting `:306-314`. Leaving publish as-is means new listings skip approval entirely.

### B4 — `unpublish` takes the shared product off the marketplace

`publishing.service.ts:342-346` sets `Product.status = INACTIVE`. With multiple vendors, one seller's unpublish hides the product for every vendor. Meili delete (`:349-353`) drops it from search too.

### B5 — Submitting seller never gets a VendorProduct on the first publish

The non-duplicate branch (`publishing.service.ts:196-223`) only creates a seller-owned `Product`. There is no `vendorProduct.create` for the original seller. Ownership and the vendor listing are the same row. Change 2 has no existing write to extend; it has to be added, and the product must be created with `sellerId: null` / `isPlatformOwned: true`, which `ProductsService.create` cannot do (`:173`).

### B6 — Seller bulk import bypasses the submission pipeline and the admin validation bar

`products-bulk.service.ts:213` calls `ProductsService.create`. Validation is name, non-negative price/stock, and per-seller SKU (`:137-162`). Missing: description length, images, category/fandom, global SKU, within-batch SKU, publish readiness, `ProductSubmission`, duplicate detection. A CSV `status` of `ACTIVE` goes live (`:228`).

`create()` and `bulkCreate()` on submissions are also inconsistent: `bulkCreate` drops `shortDescription` (`submissions.service.ts:756-775`) and never runs the SKU catalog block or `detectDuplicates`.

### B7 — Global slug is not enforced, and null `sellerId` makes the current unique index useless

`schema.prisma:735` plus migration line 1824. PostgreSQL unique indexes treat nulls as distinct. Admin slug allocation (`admin/products.service.ts:245-247`) is check-then-act and ignores soft-deleted slugs. Seller allocation (`products.service.ts:109-112`) is per seller. `findBySlugOnly` (`:644-645`) is `findFirst` without `orderBy`, so duplicate slugs make `GET /products/:slug` and `GET /products/slug/:slug` unstable.

`ProductsService.create`'s loop uses `findUnique` on `sellerId_slug` (`:110-112`). That call throws if `sellerId` is null. Pointing this method at platform ownership without replacing the loop will 500 on every create.

### B8 — Storefront and search key off `Product.sellerId`

- `ProductsService.findAll` `:392-403`
- Meili filter and fallback `:513-514`, `:826` in `meilisearch.service.ts`
- Indexed document `:405` (`sellerId: product.sellerId || null`)
- Seller profile count `sellers.service.ts:267-272` (`_count.products`)
- Export `products-bulk.service.ts:47-48`
- Seller `update` / `delete` / `bulkUpdate` ownership (`products.service.ts:715-716`, `:922`, `:1000`)

After `sellerId: null`, `/sellers/[slug]` (`SellerStorefrontClient.tsx:131-132`) renders an empty grid, Meili seller facets are all null, and the seller's own edit/delete/export/bulk tools match nothing. Unknown `sellerId` on `findAll` is not an empty list; the predicate is omitted (`:400-402`) and the caller receives the global catalog.

### B9 — Listing eligibility will hide or mis-price a vendor catalog

`products.service.ts:313-324`. A product with any `VendorProduct` is shown only when some row is `ACTIVE` with `vendorStock > 0` and `vendorPrice > 0`. The product's own stock and price are ignored in that branch.

If change 2 inserts the original seller's listing as `DRAFT` or `PENDING_APPROVAL`, the product vanishes from `findAll` even though publish set `Product.status = ACTIVE`.

If the listing is `ACTIVE`, the card still renders `Product.price` (`mapToProductType` `:1067`), not `vendorPrice` / `platformPrice`. Price filters (`:405-412`) use the same column. Multi-vendor prices are not what the list shows.

The "no vendor rows" branch currently lets seller-owned products with stock and price appear with no vendor record. Closing direct create (change 4) without giving every live product an `ACTIVE` vendor row will empty the storefront.

### B10 — Hard delete of a published product fails; soft delete is not the delete path

`products.service.ts:1011-1014` and `admin/products.service.ts:1037-1040` call `product.delete`. `ProductSubmission.productId` is `Restrict` and is not cleared or nulled first. Published products that have no orders still fail to delete. The API error is a Prisma FK exception, not the "set Inactive" message (that message is only for orders).

`findOne` uses `findUnique`, so a merged product (`deletedAt` set) is still loaded. It 404s only because merge also sets `INACTIVE` (`admin/products.service.ts:1002`). A future soft delete that sets `deletedAt` and leaves `ACTIVE` would stay public by UUID.

### B11 — Seller update can publish an incomplete product; admin update can un-ready a live one

Seller: no `validatePublishReadiness`, `status` assigned at `products.service.ts:804`, images ignored.

Admin: readiness only on the transition into `ACTIVE` (`admin/products.service.ts:435-437`). Clearing images or price on an already `ACTIVE` product is allowed. Image and variation deletes are not in the same transaction as the update (`:554-611`).

Tag/attribute delete-then-create has the same hole on both services (`products.service.ts:810-839`, `admin/products.service.ts:569-633`).

### B12 — Public bundle fetch returns non-active products

`findOne` treats `includeBundles` as permission to skip the `ACTIVE` check (`products.service.ts:562-564`). `BundleController.getBundle` is `@Public()` and passes `true` (`bundle.controller.ts:49-58`).

### B13 — `ProductsService.create` cannot represent platform ownership, and it invents a seller for admins

`:71-83` inserts a real `Seller` named "House of Spells" the first time an admin uses `POST /products` or publish (publish calls this method). `:173` always sets `sellerId`. `isPlatformOwned` is never set. Publish of a new catalog item therefore creates a seller-owned product under that admin-provisioned store when the submitter is an admin, and under the wholesaler's store otherwise.

`CATALOG` is allowed to call `POST /products` (`products.controller.ts:140`) but is not auto-provisioned. Those users 404 until a seller profile exists, and the product they then create is still theirs, not the platform's.

### B14 — Admin create allows an ownerless product; admin update can null `sellerId` without flipping the flag

`admin/products.service.ts:284-285`: `isPlatformOwned` defaults to false while `sellerId` may already be null. Update spreads `sellerId` (`:548-551`) and does not force `isPlatformOwned` when `sellerId` is cleared.

### B15 — Submission `create` blocks the vendor pipeline it tells the seller to use, and `bulkCreate` does not

`submissions.service.ts:76-80` rejects any SKU already in the catalog and points at "List as Vendor". That listing path creates a `DRAFT` `VendorProduct` (`vendor-products.service.ts:55`), not a submission. Change 4 wants CSV to go through submissions. As written, a CSV of SKUs that already exist is rejected by `create()` and accepted by `bulkCreate()` (no SKU check). Neither path creates the vendor listing.

`quantity` is stored and then ignored at publish (`publishing.service.ts:210` uses `selectedQuantity` or `stock`).

### B16 — Publish is not atomic and not concurrency-safe

Product create or vendor-product create happens before the transaction (`publishing.service.ts:141-228` vs `:232`). Two workers can both observe no existing product and insert two products. The in-transaction "already PUBLISHED" check (`:234-240`) does not cover two different submissions of the same SKU. `Product.submission` cannot point both of them at one product (B2).

### B17 — `inStock=false` on the public list is an empty set

`products.service.ts:415-420` combined with `:313-324`.

### B18 — Attribute filters on `findAll` are OR

`products.service.ts:366-389`. A product with one matching attribute satisfies a multi-attribute query.

### B19 — Bundle admin seller argument is a user id

`bundle.controller.ts:38` passes `createDto.sellerId` for admins. `createBundle` loads `Seller` by `userId` (`products.service.ts:1208-1210`). The field name does not match the lookup. Admin bundle create also does not auto-create a seller and does not set `isPlatformOwned`.

### B20 — Tax rate scale and currency

`Product.taxRate` is `Decimal(5, 4)` (`schema.prisma:671`), maximum `9.9999`. Seller create stores the raw number (`products.service.ts:185`). A percentage of `20` overflows. Publish divides by 100 only when `> 1` (`publishing.service.ts:209`), so `0.2` and `20` can mean the same thing depending on the path, and `1` (1% or 100%) is stored as `1`, which fits, and is not divided.

Schema default currency is `"USD"` (`schema.prisma:670`). `PLATFORM_DEFAULT_CURRENCY` is `'USD'` (`currency-defaults.ts:6`). Not a functional bug for the ownership change, but every new platform-owned row will be USD unless a currency is passed.

### B21 — `vendor_products` existence cache can stick on false

`products.service.ts:34-45`. One failed `information_schema` query disables vendor eligibility for the life of the process. Listings then use product stock only, including products whose only stock lives on a vendor row.

### B22 — Seller update attribute `value` vs `textValue`

Create `:226` vs update `:833`. Documented in section 3. Data loss on update for the create payload shape.

---

## 8. Impact of the planned changes

### 8.1 Marketplace ownership (`isPlatformOwned: true`, `sellerId: null`)

Breaks:

- **B1, B5, B13.** Publish and `ProductsService.create` will keep stamping the submitter's `seller.id` unless both are rewritten. Admin create is the only path that can write the flag today, and only when the caller passes `isPlatformOwned`.
- **B8.** Storefront, Meili, export, seller product counts, seller update/delete/bulk all filter `Product.sellerId`. They return nothing.
- **B7.** Slugs of platform rows are not unique. `findUnique({ sellerId_slug })` throws on null.
- **Seller deletion** stops cascading catalog products (good) and still cascades that seller's `VendorProduct` rows (`schema.prisma:809`).
- **Loyalty / commission** reads `product.sellerId` and `isPlatformOwned` (`services/api/src/loyalty/engines/earn.engine.ts:471` and `:487`). Null `sellerId` with the flag set is the branch that code already special-cases. Rows with null `sellerId` and `isPlatformOwned: false` (B14) fall through with no seller.
- **Admin list** `getAllProducts` treats platform products as `sellerId === null && isPlatformOwned` (`admin/products.service.ts:689-695`). The `=== null` branch is unreachable from a query string (omitted is `undefined`, and a non-empty string is caught by the first branch). After the migration, filtering "platform" from that API still does not work unless the controller is changed. Every product will be platform-owned, so the seller filter `where.sellerId = filters.sellerId` returns empty.
- **First-publish pricing** lives on `Product.price` and `ProductPricing` (`productId` unique, one price per product, `schema.prisma:1738`). Vendor price is a second number. The storefront shows the product price (B9).

### 8.2 Original seller receives a VendorProduct

Breaks:

- **B2.** The submission cannot store `productId` if another submission already has it. The original seller's submission occupies the unique slot. Later vendors' submissions cannot link.
- **B5.** The first publish does not create a vendor row. Adding one as `DRAFT` hides the product (B9). Adding one as `ACTIVE` makes it sellable, but publish currently also sets product stock/price, so the product is double-counted: once on `Product.stock` (the "no vendors" branch stops applying as soon as any vendor row exists) and once on `vendorStock`.
- **B15.** A later CSV/submission with the same SKU is rejected by `create()` before a vendor listing can be created through that pipeline.
- Seller edit of name, images, and description is forbidden once they no longer own the row (`products.service.ts:715-716`). Vendor `update` only changes price, stock, and fulfillment (`vendor-products.service.ts:193-203`). Catalog copy becomes admin-only. That is consistent with marketplace ownership if it is intentional. It is a behavior change for every seller who uses `PUT /products/:id` today.
- `ProductSubmission.product` being 1:1 means "which submission created this product" cannot also mean "which sellers have submitted it". Vendor identity has to live on `VendorProduct`, and `productId` on the submission should either stay with the originating submission only or become a non-unique foreign key.

### 8.3 Multiple active vendors

Breaks:

- **B3** is the rule to remove (`vendor-products.service.ts:306-314`). Publish already ignores it.
- **B4.** Unpublish and seller/admin product delete are product-scoped. Deactivating one vendor must not set `Product.status`.
- **B9.** `findAll` already ORs "any active vendor", so multiple active vendors do not hide the product. They also do not appear as separate offers. The list has one card, one `Product.price`, no vendor picker. PDP `findOne` does not load `vendorProducts`.
- Cart and order lines reference `productId` only (`schema.prisma:997-1001`, `:1249-1250`). Checkout cannot attribute a unit to a vendor. That is outside this audit's files, and it blocks multi-vendor fulfillment even if listings are fixed.
- Meili has one document per product and one `sellerId`. A product sold by three vendors is one search hit with `sellerId: null`.

### 8.4 Bulk CSV through the submission pipeline

Breaks:

- **B6 and B15.** `POST /products/import` never creates a submission. `bulkCreate` is capped at 50 (`submissions.service.ts:703-705`), skips SKU checks, drops `shortDescription`, and does not call `detectDuplicates`. Import of more than 10 products is a background job (`products.controller.ts:313-318`) with no submission status to poll other than the queue job.
- Rows that match an existing SKU need a defined outcome: reject, or open a vendor listing, or open a submission that publish turns into a `VendorProduct`. Today `create()` rejects and `bulkCreate()` accepts and later publish mis-creates a product (B1).
- Direct `POST /products` is already closed to sellers. The hole for sellers is import, plus `POST /products/bundles`.

---

## 9. Regression tests required after the change

These are the cases that pass only if the new model is actually wired. They should be API-level, with the database constraint in force.

### Ownership and publish

1. Publish a `FINANCE_APPROVED` submission whose seller has a profile. The new `Product` has `isPlatformOwned: true`, `sellerId: null`, `status: ACTIVE`. The submitter has exactly one `VendorProduct` for that product. No "House of Spells" seller is created.
2. Publish a second seller's submission with the same SKU. No second `Product`. A second `VendorProduct` exists. Both can be `ACTIVE` at the same time. The first submission's `productId` remains set. The second submission is `PUBLISHED` and records the same product without a unique violation.
3. Retry the second publish after a forced failure between vendor insert and submission update. `vendorStock` does not increase twice. There is still one vendor row.
4. Two concurrent publishes of the same new SKU produce one product and two vendor rows (or one product and one vendor if the second loses the race), never two products.
5. Publish with empty catalog images and empty submission images does not create an `ACTIVE` product. Publish-readiness applies: name, description ≥ 10, price > 0, at least one image, category or fandom.
6. `unpublish` of one seller sets that seller's `VendorProduct` to `INACTIVE` and leaves `Product.status` `ACTIVE` while another vendor is still `ACTIVE`. When the last vendor deactivates, define and assert the product status (recommend: product stays `ACTIVE` in the catalog but `findAll` hides it because no vendor qualifies).
7. Original seller `PUT /products/:id` returns 403. Admin `PUT /admin/products/:id` can still change catalog copy. Seller vendor `PATCH` can change `vendorPrice` and `vendorStock` only.
8. Admin create without `isPlatformOwned` and without `sellerId` is rejected, or it sets both `sellerId: null` and `isPlatformOwned: true`. It must not persist the ownerless combination.

### Slugs

9. Two platform products cannot share a slug, including concurrent creates. The second gets a numeric suffix or a 409, and the database rejects a raw duplicate.
10. `sellerId: null` does not throw in the slug loop.
11. A soft-deleted product's slug cannot be reused while `deletedAt` is set, or reuse is explicit and `findBySlugOnly` never returns the deleted row. `GET /products/{slug}` returns the single live row.
12. Renaming a product either keeps the slug or writes a redirect. `GET` by the old slug does not 404 if the public URL was shared. (Current admin update changes the slug in place.)
13. `slugify("!!!")` does not persist an empty slug.

### Storefront and search

14. `GET /sellers/{slug}` returns products for which that seller has an `ACTIVE` `VendorProduct` with stock and price, including products whose `Product.sellerId` is null. It does not return another seller's exclusive listings. It does not return the global catalog when the seller id is unknown (`GET /products?sellerId=does-not-exist` is an empty page, not all products).
15. Seller profile `_count` matches that vendor listing count, not `Product.sellerId`.
16. Meili (and its Prisma fallback) return the same seller's listings for a seller filter. Reindex after publish includes the new product. A product with three vendors is discoverable for each of those sellers.
17. `findAll` does not show a product whose only vendor row is `DRAFT`. It shows a product when at least one vendor is `ACTIVE` with `vendorStock > 0` and `vendorPrice > 0`, even if `Product.stock` is 0.
18. The price on the card is the offer price the new model chooses (document whether that is `platformPrice` or the minimum `vendorPrice`) and the price filter uses that same number.
19. `GET /products/{uuid}` for a non-`ACTIVE` product is 404 for anonymous callers, including `GET /products/bundles/{id}`.
20. `GET /products/{uuid}` for a soft-deleted product is 404 even if status is still `ACTIVE`.
21. `inStock=false` returns products that are actually out of stock (or is rejected). It does not return an empty page because two stock predicates contradict.
22. Two attribute filters are AND.

### Submissions and CSV

23. CSV import creates `ProductSubmission` rows (status `SUBMITTED`) and does not insert `Product` until publish. A row with a SKU that already exists becomes a vendor-listing submission (or a documented rejection), not a second product.
24. `create` and `bulkCreate` persist the same fields, including `shortDescription`. `quantity` is either honored at publish or removed from the DTO.
25. Within one CSV, duplicate SKUs are rejected. Duplicate names in one batch are rejected (already true for `bulkCreate`).
26. A submission with price `0` is rejected. A submission with price `10` and a finance final price of `12.50` publishes at `12.50`, with the vendor row storing the seller's cost separately.
27. Tags sent as taxonomy ids become `ProductTag` rows. Legacy string tags stay only if still required.
28. `bulkCreate` runs the same identifier block and `detectDuplicates` as `create`.

### Deletion

29. Admin delete of a product that has orders is rejected and the row remains.
30. Admin delete (or archive) of a product that has a submission and no orders succeeds: either soft-delete (`deletedAt`, hidden from `findMany` and `findUnique`) or hard-delete after nulling `ProductSubmission.productId`. No FK 500.
31. Archiving a product does not delete `OrderItem` rows. `VendorProduct` rows are inactive or removed, and a subsequent public `findAll` does not show the product.
32. Deleting a seller removes that seller's `VendorProduct` rows and does not delete the platform `Product`.

### Slug / ownership migration of existing rows

33. After backfill, every previously seller-owned `ACTIVE` product has `sellerId: null`, `isPlatformOwned: true`, and a `VendorProduct` for the previous `sellerId` with that seller's price and stock, status `ACTIVE` when the product was sellable.
34. Existing `(seller, slug)` pairs that collide once seller is null are suffixed before the unique index is applied. The migration fails the deploy if any duplicate remains. Assert two pre-migration products named the same under different sellers do not end as two live rows with one slug.
35. `GET /products/{oldSlug}` still resolves for every pre-migration product that had a unique slug.

---

## 10. Recommended fixes

### B7 / A5 — Make slug globally unique before nulling `sellerId`

Do this in the same migration that sets `sellerId` null, or the backfill will insert duplicates the index cannot see.

1. Deduplicate live slugs (`deletedAt` null): keep the oldest `id`, suffix the rest with `-2`, `-3`, …
2. Drop `products_sellerId_slug_key`.
3. Add a partial unique index:

```sql
CREATE UNIQUE INDEX "products_slug_live_key"
ON "products" ("slug")
WHERE "deletedAt" IS NULL;
```

Prisma cannot express a partial unique index in `@@unique`. Keep the index in SQL and stop calling `findUnique({ sellerId_slug })`. Allocate slugs with `findFirst({ slug, deletedAt: null })` under a transaction, and treat a unique-violation retry as the race loser.

Reject empty `slugify` output. Fall back to a short id.

Do not use `NULLS NOT DISTINCT` on `(sellerId, slug)` as the only fix. It uniques platform rows against each other and still allows a leftover seller-owned row to share a slug with a platform row. A single live-slug index matches `findBySlugOnly`.

On admin rename, keep the old slug unless the editor asks for a new one.

### B5 / B13 — One write path for catalog products

Stop calling `ProductsService.create` from publish and from bulk import.

Add an internal `CatalogProductsService.createPlatformProduct` used by admin create and by publish:

- forces `sellerId: null`, `isPlatformOwned: true`
- global slug allocation
- `validatePublishReadiness` when status will be `ACTIVE`
- SKU/barcode/EAN match against `ACTIVE` and `DRAFT`, including null `sellerId`
- inserts the product and the originating `VendorProduct` in one transaction

Delete the admin auto-seller block at `products.service.ts:71-83`, or stop using that method for catalog writes. `POST /products` for `ADMIN`/`CATALOG` should call the platform creator. Seller roles stay forbidden.

### B1 / B2 / B16 — Publish decides "new product vs vendor" inside one transaction

```
BEGIN
  lock identifier (sku/barcode/ean), or INSERT … ON CONFLICT
  if a live product exists (sellerId IS NULL is a match, not a miss):
       upsert VendorProduct for this seller (do not increment stock if the row already existed for this submission)
  else:
       insert platform Product
       insert VendorProduct for the submitter
  set this submission PUBLISHED
  set productId only if we define the column as "originating submission"
COMMIT
```

Remove `sellerId: { not: submission.seller.id }` (`publishing.service.ts:112` and `:125`).

`ProductSubmission.productId @unique` cannot represent every vendor's submission. Recommended: keep it unique for the submission that created the product; add `originSubmissionId` on `Product` or a non-unique `catalogProductId` on later submissions. Do not write the shared product id into a unique column for the second seller. If the product requirement is "every submission points at the catalog product", drop `@unique` on `product_submissions.productId` and change `Product.submission` to `ProductSubmission[]`.

Move the vendor insert inside the transaction. On the existing-vendor branch, do not `increment` stock unless the submission has not been published yet (guard on `publishedAt`, not only on the vendor row).

### B3 — Multiple active vendors

Delete the `updateMany` that sets other listings `INACTIVE` (`vendor-products.service.ts:306-314`). Allow `activate` to set `ACTIVE` when stock > 0 without touching siblings. Publish should create the listing as `PENDING_APPROVAL` or `ACTIVE` using the same function as `activate`, so the two paths cannot diverge. Pick one and test both.

### B4 — Unpublish and delete are vendor-scoped

`unpublish` updates that submission's seller `VendorProduct` to `INACTIVE`. It sets `Product.status = INACTIVE` only when no `ACTIVE` vendor remains, if product status is still used as a kill switch. Do not call `meilisearch.deleteProduct` unless the product itself is archived.

### B8 / B9 — Reads go through vendor listings

`findAll` seller filter:

```
vendorProducts: { some: { sellerId: seller.id, status: 'ACTIVE', vendorStock: { gt: 0 }, vendorPrice: { gt: 0 } } }
```

Unknown seller id → `where.id = 'impossible'` / empty page, not an omitted filter.

Drop the "no vendor rows" branch once every sellable product has a vendor row. Until backfill finishes, keep it only for `isPlatformOwned: false` legacy rows.

Seller storefront and `Seller._count` should count `VendorProduct`, not `Product`.

Meili document: replace scalar `sellerId` with `vendorSellerIds: string[]` (active vendors) or a side index. Update `fallbackSearch` to the same `some` filter. Reindex on vendor activate/deactivate, not only on product create.

Return the offer price the business picks. Do not return `Product.price` on the public card if vendors set their own prices. If the platform sets one `platformPrice`, write that onto `Product.price` at publish and whenever the winning offer changes, and test the filter against it.

### B6 / B15 — CSV creates submissions

`importProducts` should map each row into `CreateSubmissionDto` and call the same `create()` as the single-product form (or `bulkCreate` after it shares that mapper). It should not call `ProductsService.create`.

One mapper, used by `create` and `bulkCreate`:

- include `shortDescription`
- run the identifier check
- run `detectDuplicates`
- define the existing-SKU outcome as "create a vendor submission" rather than a 400 that points at a different feature, if change 4 means existing SKUs still travel through this pipeline

Raise or remove the 50-row cap if CSV batches are larger; the queue already exists on the product-import endpoint and can wrap submission ids.

Reject duplicate SKUs inside the file before insert.

### B10 — Soft delete is the product archive

`delete` / `deleteProduct` should set `status: INACTIVE` and `deletedAt`, deactivate vendor rows, remove cart lines, and delete the Meili document. They should not call `product.delete` when a submission, order, or discrepancy exists.

Either teach the soft-delete extension to cover `findUnique`, or add `deletedAt: null` inside `findOne` and `findBySlug`. Public reads must 404 when `deletedAt` is set regardless of status.

Clearing `ProductSubmission.productId` is only required if hard delete stays. Prefer not hard-deleting.

### B11 / B12 — One readiness check, one public visibility rule

Call `validatePublishReadiness` from any path that sets `ACTIVE`, including seller update, bulk update, and publish. Run it again when an `ACTIVE` product loses its last image or its price drops to 0.

`findOne` should hide non-`ACTIVE` products unless the caller is the owner or staff. `includeBundles` must not disable that check. `getBundle` should use the same rule.

Replace tags, attributes, images, and variations inside the same transaction as the product update.

### B14 — Ownership flag is derived

Any write that sets `sellerId` null sets `isPlatformOwned` true. Any write that sets a `sellerId` sets `isPlatformOwned` false. Reject the mixed state in one helper used by admin create and admin update.

### B17 / B18 / B22 — Query and attribute fixes (do with the read-path change)

- `inStock: false` must not be ANDed with `stock > 0`. Apply it to vendor stock.
- Combine attribute filters with `AND` of `some` blocks, not one `some` of `OR`.
- On update, accept `value` as `textValue`, matching create.

### B19 — Bundles

Look up the admin target by `Seller.id` when the field is `sellerId`, or rename it `sellerUserId` and validate. Create the bundle as platform-owned if bundles are catalog items, and add a vendor row for the seller. Keep `POST /products/bundles` off the seller direct-create list if change 4 is strict, or send bundle requests through submission.

### B20 — Tax

Store tax as a fraction everywhere, or as a percent everywhere. Reject values that do not fit `Decimal(5, 4)` at the DTO. Publish's `> 1` divide is a trap for a 1% rate stored as `1` (not divided) and for a 0.5% rate stored as `0.005` (not divided, correct) versus `0.5` (divided, becomes 0.005). Pick one unit and migrate.

### B21 — Vendor table probe

Do not cache `false` forever. If the migration is applied in all environments, delete the probe and query `vendorProducts` directly.

### Backfill order

1. Deduplicate slugs and add the partial unique index (tests 9, 34, 35).
2. For each product with a non-null `sellerId`, insert `VendorProduct` (seller, price, stock, `ACTIVE` if the product was `ACTIVE` and stock and price are positive) if missing.
3. Set `sellerId: null`, `isPlatformOwned: true`.
4. Deploy read-path changes (storefront, Meili, `findAll`) in the same release as step 3. Shipping step 3 first empties every seller storefront (B8).
5. Switch publish, admin create, and CSV to the new write path.
6. Remove single-active deactivation.
7. Only then close `POST /products/import`'s direct create.

---

## 11. File index

| File | What was read |
|---|---|
| `services/api/src/products/products.service.ts` | `create`, `findAll`, `findOne`, `findBySlug`, `findBySlugOnly`, `update`, `bulkUpdate`, `delete`, `createBundle`, `mapToProductType` |
| `services/api/src/products/products.controller.ts` | Public list/detail and seller import/update/delete guards |
| `services/api/src/products/products-bulk.service.ts` | Full file |
| `services/api/src/products/dto/create-product.dto.ts` | Full file |
| `services/api/src/products/dto/update-product.dto.ts` | Full file |
| `services/api/src/products/dto/search-products.dto.ts` | Full file |
| `services/api/src/products/dto/create-bundle.dto.ts` | Full file |
| `services/api/src/products/bundle.controller.ts` | Create and public get |
| `services/api/src/admin/products.service.ts` | `createProduct`, `updateProduct`, `getAllProducts`, `validatePublishReadiness`, `mergeProducts`, `deleteProduct` |
| `services/api/src/admin/products.controller.ts` | Create/update entry |
| `services/api/src/publishing/publishing.service.ts` | Full file |
| `services/api/src/submissions/submissions.service.ts` | `create`, `bulkCreate`, `checkDuplicates`, `browseCatalogForVendor` |
| `services/api/src/submissions/dto/create-submission.dto.ts` | Full file |
| `services/api/src/vendor-products/vendor-products.service.ts` | `create`, `approve`, `activate` |
| `services/api/src/meilisearch/meilisearch.service.ts` | `search`, `fallbackSearch`, `transformProductToDocument` |
| `services/api/src/database/prisma-soft-delete.ts` | Full file |
| `services/api/src/sellers/sellers.service.ts` | `findBySlug` public select and `_count.products` |
| `services/api/prisma/schema.prisma` | `Product`, `VendorProduct`, `CartItem`, `OrderItem`, `ProductSubmission`, `CatalogEntry`, `ProductPricing`, and FK `onDelete` for product children |
| `services/api/prisma/migrations/20251201000000_init/migration.sql:1824` | Unique index SQL |
| `packages/utils/src/slug.ts` | `slugify` |
| `apps/web/src/app/sellers/[slug]/SellerStorefrontClient.tsx` | Product fetch |
| `apps/web/src/app/products/page.tsx` | Meili failure → `getProducts` |

# Product Upload User Flow

> Complete reference for the product team covering all upload scenarios across Admin, Seller, and Bulk Import channels.

---

## Table of Contents

1. [Overview](#overview)
2. [Roles & Permissions](#roles--permissions)
3. [Flow A: Admin Product Creation](#flow-a-admin-product-creation)
4. [Flow B: Admin Product Editing](#flow-b-admin-product-editing)
5. [Flow C: Seller Product Submission](#flow-c-seller-product-submission)
6. [Flow D: Seller Vendor Listing (Browse Catalog)](#flow-d-seller-vendor-listing-browse-catalog)
7. [Flow E: Bulk CSV Import](#flow-e-bulk-csv-import)
8. [Flow F: Submission Approval Pipeline](#flow-f-submission-approval-pipeline)
9. [Image Handling](#image-handling)
10. [Variation Management](#variation-management)
11. [Taxonomy & Categorization](#taxonomy--categorization)
12. [Validation Rules Summary](#validation-rules-summary)
13. [Status Lifecycle](#status-lifecycle)
14. [API Endpoints Reference](#api-endpoints-reference)

---

## Overview

The HOS Marketplace supports three primary channels for getting products into the system:

| Channel | Actor | Creates | Requires Approval | Pricing |
|---------|-------|---------|--------------------|---------|
| Admin Create | ADMIN, CATALOG | Product (DRAFT) | No | Set later in Price Management |
| Seller Submit | SELLER, B2C_SELLER, WHOLESALER | ProductSubmission | Yes | Seller sets on submit |
| Bulk CSV Import | SELLER roles | Product (DRAFT) | No | Included in CSV |

---

## Roles & Permissions

| Role | Can Create Admin Products | Can Submit Products | Can Bulk Import | Can Browse Catalog |
|------|--------------------------|--------------------|-----------------|--------------------|
| ADMIN | Yes | No | No | No |
| CATALOG | Yes | No | No | No |
| SELLER | No | Yes | Yes | Yes |
| B2C_SELLER | No | Yes | Yes | Yes |
| WHOLESALER | No | Yes | Yes | Yes |

---

## Flow A: Admin Product Creation

**Path:** `/admin/products/create`

### Step-by-Step

```
1. Navigate to Admin Dashboard → Products → Create Product
2. Fill in basic information:
   - Product Name (REQUIRED)
   - Description (REQUIRED, minimum 10 characters)
   - Short Description (recommended)
   - SKU (recommended), Barcode, EAN (optional)
3. Select Fandom or Category (REQUIRED — at least one must be set)
4. Choose ownership:
   - Platform Owned (default, checked)
   - Or uncheck and assign to a Seller
5. Configure Taxonomy:
   - Select Category (tree selector)
   - Select Tags (multi-select with search)
   - Fill Attributes (auto-loaded based on category)
6. Fill SEO fields (recommended):
   - Meta Title (max 70 characters)
   - Meta Description (max 160 characters)
7. Fill Shipping Dimensions (optional):
   - Weight (kg), Length, Width, Height (cm)
8. Choose Product Type:
   - SIMPLE (default)
   - VARIANT → add variation dimensions (Size, Color, etc.)
     - Each option can have: value, price, stock, image
9. Add Product Images (REQUIRED, at least 1):
   - OPTION A: Upload files (JPEG/PNG/GIF/WebP, max 5MB each, up to 4 at a time)
   - OPTION B: Paste an image URL and click "Add URL"
   - Set alt text for each image
10. Review the Creation Checklist (bottom of form) — all required items must be green
11. Click "Create Product (DRAFT)"
12. Product is created as DRAFT
13. Success banner shown → form resets for next product
```

### Post-Creation

- Product appears in Admin Products list with DRAFT status
- Navigate to Price Management to set pricing, stock, and tax
- Once pricing is set, change status to ACTIVE to make it visible on the marketplace

### Form Fields

Fields are enforced at two stages: **Creation** (when saving as DRAFT) and **Publish** (when activating to ACTIVE). This two-tier model lets the catalog team add products quickly while ensuring nothing incomplete reaches customers.

#### Required at Creation (DRAFT)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| name | text | — | Product display name |
| description | textarea | — | Minimum 10 characters |
| images | file/URL | — | At least 1 image (upload or URL) |
| fandom OR categoryId | select/tree | — | At least one must be set |

#### Required at Publish (ACTIVE) — in addition to above

| Field | Type | Notes |
|-------|------|-------|
| price | number | Must be > $0 (set in Price Management) |

#### Recommended (shown in checklist, not blocking)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| shortDescription | text | — | Shown in search results and cards |
| sku | text | — | Stock Keeping Unit for inventory |
| metaTitle | text | — | SEO title (max 70 chars) |
| metaDescription | textarea | — | SEO description (max 160 chars) |

#### Optional

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| barcode | text | — | Product barcode |
| ean | text | — | European Article Number |
| isPlatformOwned | checkbox | true | Whether HOS owns the product |
| sellerId | select | — | Required when isPlatformOwned is false |
| tagIds | multi-select | [] | Taxonomy tag IDs |
| attributes | dynamic | [] | Auto-loaded when category is selected |
| productType | radio | SIMPLE | SIMPLE or VARIANT |
| variations | dynamic | [] | Required for VARIANT products |
| weight | number | — | Shipping weight in kg |
| length, width, height | number | — | Shipping dimensions in cm |

---

## Flow B: Admin Product Editing

**Path:** `/admin/products` → Click "Edit" on any product

### Step-by-Step

```
1. Navigate to Admin Dashboard → Products
2. Click "Edit" on the product row
3. Edit modal opens with pre-filled form
4. Modify any field (name, description, pricing, status, etc.)
5. Manage Images:
   - Upload new files (max 5MB each)
   - Add image by URL (paste and click "Add")
   - Remove existing images
   - Set primary image (star icon)
6. Update Taxonomy (category, tags, attributes)
7. Toggle Published / Featured checkboxes
8. Click "Update Product"
```

### Bulk Actions (from product list)

- Select multiple products via checkboxes
- Available bulk actions:
  - **Publish** → set status to ACTIVE
  - **Unpublish** → set status to DRAFT
  - **Set Inactive** → set status to INACTIVE
  - **Delete** → permanently delete (blocked if product has order history)

---

## Flow C: Seller Product Submission

**Path:** `/seller/submit-product` → "Submit New Product" tab

### Step-by-Step

```
1. Navigate to Seller Dashboard → Submit Product
2. Switch to "Submit New Product" tab
3. Fill Basic Information:
   - Product Name (required, triggers duplicate check after 3+ chars)
   - Description (required)
   - SKU, Barcode, EAN (optional, trigger duplicate check)
4. Set Pricing:
   - Price (required, > 0)
   - Currency (USD or EUR)
   - Trade Price, RRP (optional)
   - Stock (required, ≥ 0)
   - Tax Rate (optional)
   - Min Order Quantity (Wholesalers only)
5. Categorization:
   - Category (tree selector)
   - Fandom (dropdown)
   - Tags (comma-separated text)
6. Add Product Images (at least 1 required):
   - OPTION A: Upload files (JPEG/PNG/GIF/WebP, max 10MB each, up to 4)
   - OPTION B: Paste an image URL and click "Add URL"
   - Set alt text for each image
7. Add Variations (optional):
   - Enter variation name (e.g., "Size")
   - Add option name/value pairs (e.g., "Small" / "S")
   - Click "Add Variation"
8. Click "Submit Product"
9. Submission goes to review pipeline
10. Redirect to Submissions list
```

### Duplicate Detection

The system automatically checks for duplicates when the seller types in the Name, SKU, Barcode, or EAN fields (800ms debounce). Three types of matches are shown:

| Match Type | Color | Meaning |
|------------|-------|---------|
| Your Active Products | Red | You already sell this product |
| Your Pending Submissions | Orange | You have a pending submission for this |
| Catalogue Matches | Amber | Product exists in the catalog (use "List as Vendor" instead) |

### Idempotency Protection

- Same product name from the same seller within 2 minutes → submission rejected
- Exact SKU/barcode/EAN match against catalog → rejected (use "List as Vendor")

---

## Flow D: Seller Vendor Listing (Browse Catalog)

**Path:** `/seller/submit-product` → "Browse Catalog" tab

### Step-by-Step

```
1. Navigate to Seller Dashboard → Submit Product
2. Default tab is "Browse Catalog"
3. Search or filter by fandom
4. Find the product you want to sell
5. Click "List as Vendor"
6. Modal opens:
   - Set your selling price
   - Set your available stock
7. Click "List Product"
8. Product is instantly listed — no approval needed
```

### Key Differences from Submit

- **No approval required** — instant listing
- Seller only sets price and stock
- Uses the existing product's images, description, and categorization
- Shows how many other vendors sell the same product

---

## Flow E: Bulk CSV Import

**Path:** `/seller/products/bulk`

### Export

```
1. Navigate to Seller Dashboard → Bulk Import
2. Click "Export CSV"
3. Downloads CSV with columns:
   name, description, sku, price, stock, currency, category, fandom, tags, images, status
```

### Import

```
1. Prepare CSV file matching the export format
2. Navigate to Seller Dashboard → Bulk Import
3. Upload CSV file
4. System validates and previews products
5. Click "Import"
6. If ≤ 10 products: synchronous processing
7. If > 10 products: queued (BullMQ) with progress polling
8. Results shown: X succeeded, Y failed, with error details
```

### CSV Format

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| name | string | Yes | Product name |
| description | string | Yes | Full description |
| sku | string | No | Stock Keeping Unit |
| price | number | Yes | Selling price |
| stock | number | Yes | Available units |
| currency | string | No | Default: USD |
| category | string | No | Category name (legacy) |
| fandom | string | No | Fandom name |
| tags | string | No | Comma-separated |
| images | string | No | Pipe-separated URLs: `url1\|url2\|url3` |
| status | string | No | Default: DRAFT |

### Important Notes

- Bulk import creates **Products directly** (not Submissions)
- Does NOT go through the approval pipeline
- Supports both pipe-separated URL strings and JSON array format for images

---

## Flow F: Submission Approval Pipeline

### Status Flow

```
SUBMITTED
    ↓
UNDER_REVIEW
    ↓
┌─────────────────────┐
│  PROCUREMENT_APPROVED │──────→ FINANCE_APPROVED
│  PROCUREMENT_REJECTED │          ↓
└─────────────────────┘   CATALOG_COMPLETED
                               ↓
                         MARKETING_COMPLETED
                               ↓
                         CONTENT_COMPLETED
                               ↓
                          Product Created (DRAFT)
```

### Rejection Path

```
PROCUREMENT_REJECTED or REJECTED
    ↓
Seller receives notification
    ↓
Seller can resubmit (POST /submissions/:id/resubmit)
    ↓
Status returns to SUBMITTED
```

### Who Reviews What

| Stage | Reviewer | Action |
|-------|----------|--------|
| Procurement | Procurement Team | Approve/Reject — validates product sourcing |
| Finance | Finance Team | Approve — validates pricing and margins |
| Catalog | Catalog Team | Complete — enriches product data |
| Marketing | Marketing Team | Complete — adds marketing content |
| Content | Content Team | Complete — final review and product creation |

---

## Image Handling

### Upload Methods

| Method | Admin Create | Admin Edit | Seller Submit | Bulk Import |
|--------|-------------|------------|---------------|-------------|
| File Upload | Yes (5MB, 4 files) | Yes (5MB, 4 files) | Yes (10MB, 4 files) | No |
| Image URL | Yes | Yes | Yes | Yes (pipe-separated) |

### Image Object Schema

```json
{
  "url": "https://cdn.example.com/product-image.jpg",
  "alt": "Red dragon figurine front view",
  "order": 0
}
```

### Supported Formats

- JPEG / JPG
- PNG
- GIF
- WebP

### Backend Validation

- Image URL must be a valid URL (validated with `new URL()`)
- Non-empty string required
- Backend upload endpoint limit: 5MB per file, 10 files per request

### Image Metadata (captured on upload)

- **Size** (bytes)
- **Dimensions** (width x height pixels)
- **Format** (JPEG, PNG, etc.)
- **Upload timestamp**

---

## Variation Management

### Admin Create (VARIANT product type)

```
Variation Dimension: "Size"
├── Option: "Small"  → Price: $19.99, Stock: 50, Image: [upload/url]
├── Option: "Medium" → Price: $24.99, Stock: 30, Image: [upload/url]
└── Option: "Large"  → Price: $29.99, Stock: 20, Image: [upload/url]

Variation Dimension: "Color"
├── Option: "Red"    → Price: $0 (use base), Stock: 25, Image: [upload/url]
└── Option: "Blue"   → Price: $0 (use base), Stock: 15, Image: [upload/url]
```

### Seller Submit

Seller variations use name/value pairs (no per-option pricing):

```
Variation: "Size"
├── Option Name: "Small"  → Value: "S"
├── Option Name: "Medium" → Value: "M"
└── Option Name: "Large"  → Value: "L"
```

---

## Taxonomy & Categorization

### Category (Tree Selector)

- Hierarchical tree with up to 3 levels
- User expands/collapses levels to find the right category
- Selecting a category auto-loads its attributes
- Label: "Fandom" in the UI (categories represent fandoms)

### Fandom (Dropdown Selector)

- Flat dropdown of all category slugs
- Sets the `fandom` field (string slug)
- Used for search filtering and product grouping

### Tags

- **Admin**: Multi-select with search (TagSelector component)
  - Categories: Theme, Occasion, Style, Character, Fandom, Custom
  - Uses tag IDs (`tagIds[]`)
- **Seller**: Comma-separated text input
  - Plain string tags sent to submission

### Attributes

- Auto-loaded when a category is selected
- Types: TEXT, NUMBER, SELECT, BOOLEAN, DATE
- SELECT type shows predefined values
- Only shown on Admin Create/Edit (not seller submit)

---

## Validation Rules Summary

### Admin Create

| Field | Validation |
|-------|-----------|
| name | Required (HTML `required` attribute) |
| description | Required (HTML `required` attribute) |
| images | At least 1 image (checked before submit) |
| image URL | Must be valid URL (frontend + backend) |
| categoryId | If provided, must exist in database |
| tagIds | If provided, all must exist in database |
| attributes | If SELECT type, value must match predefined values |
| sellerId | If provided, seller must exist in database |

### Seller Submit

| Field | Validation |
|-------|-----------|
| name | Required, min 3 chars for duplicate check |
| description | Required |
| price | Required, > 0 |
| stock | Required, ≥ 0 |
| images | At least 1 image |
| Duplicate check | Name/SKU/Barcode/EAN matched against catalog and own products |
| Idempotency | Same name from same seller within 2 minutes → rejected |

### Backend (Admin Products API)

| Check | Error |
|-------|-------|
| Invalid seller ID | 404 "Seller not found" |
| Invalid category ID | 404 "Category not found" |
| Missing tags | 400 "One or more tags not found" |
| Invalid attribute | 400 "One or more attributes not found" |
| Invalid attribute value | 400 "Attribute value not found for attribute {name}" |
| Invalid image URL | 400 "Invalid image URL: {url}" |
| Empty image URL | 400 "Each image must have a non-empty URL" |
| Delete with orders | 400 "Product cannot be deleted because it appears in past orders" |

---

## Status Lifecycle

```
              ┌─────────┐
              │  DRAFT   │ ← Created by Admin or Bulk Import
              └────┬─────┘
                   │ (Set price, stock, activate)
              ┌────▼─────┐
              │  ACTIVE   │ ← Visible on marketplace
              └────┬─────┘
                   │
         ┌────────┼────────┐
         ▼        ▼        ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ INACTIVE │ │  DRAFT   │ │ OUT_OF_STOCK │
   └──────────┘ └──────────┘ └──────────────┘
```

- **DRAFT**: Not visible. Requires price management before activation.
- **ACTIVE**: Visible on marketplace, searchable, purchasable.
- **INACTIVE**: Hidden from marketplace. Preserves order history.
- **OUT_OF_STOCK**: Stock depleted. Can be re-stocked and reactivated.

---

## API Endpoints Reference

### Admin Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admin/products` | ADMIN | Create product |
| PUT | `/admin/products/:id` | ADMIN | Update product |
| GET | `/admin/products` | ADMIN | List products (paginated, filterable) |
| DELETE | `/admin/products/:id` | ADMIN | Delete product |

### Seller Submissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/submissions` | SELLER roles | Create submission |
| GET | `/submissions` | SELLER roles | List own submissions |
| GET | `/submissions/:id` | SELLER roles | Get submission details |
| PUT | `/submissions/:id` | SELLER roles | Update submission |
| DELETE | `/submissions/:id` | SELLER roles | Delete submission |
| POST | `/submissions/:id/resubmit` | SELLER roles | Resubmit rejected |
| POST | `/submissions/bulk` | SELLER roles | Bulk create (max 50) |
| GET | `/submissions/browse-catalog` | SELLER roles | Browse catalog for vendor listing |
| GET | `/submissions/check-duplicates` | SELLER roles | Check for duplicate products |

### File Upload

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/uploads/single` | JWT | Upload single file |
| POST | `/uploads/multiple` | JWT | Upload multiple files (max 10) |

### Bulk Import/Export

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products/export/csv` | SELLER roles | Export products as JSON (frontend converts to CSV) |
| POST | `/products/import` | SELLER roles | Import products from array |

---

## Appendix: Changes Log

### Fixes Applied (Feb 2026)

1. **Added "Image URL" field to Admin Create page** — Admins can now paste a direct image URL in addition to uploading files.
2. **Added "Image URL" field to Admin Edit modal** — Same capability in the product editing interface.
3. **Raised admin image size limit from 250KB to 5MB** — Aligned with the backend upload controller's actual limit.
4. **Added backend URL validation for product images** — Both create and update endpoints now validate that image URLs are well-formed.
5. **Fixed bulk import image format handling** — Backend now accepts both pipe-separated URL strings (`url1|url2`) and JSON arrays (`[{url, alt, order}]`).
6. **Fixed deprecated `onKeyPress`** — Seller submit page now uses `onKeyDown` (React-recommended).

### Publish Gate & Collateral Enforcement (Feb 2026)

7. **Added publish-readiness backend gate** — Products CANNOT be set to ACTIVE unless they pass all required checks:
   - Product name present
   - Description at least 10 characters
   - Price > $0
   - At least one product image
   - Fandom or category assigned
8. **Added SEO fields to Product schema** — `metaTitle` and `metaDescription` added to Prisma Product model via migration `20260219120000_add_product_seo_and_dimensions`.
9. **Added shipping dimension fields** — `weight`, `length`, `width`, `height` added to Product model.
10. **Added SEO & Dimensions UI to Admin Create page** — Meta title (70 char limit), meta description (160 char limit), weight/length/width/height inputs.
11. **Added SEO & Dimensions UI to Admin Edit modal** — Same fields available when editing products.
12. **Added Publish Readiness Checklist** — Visual checklist in the edit modal showing required vs recommended items with pass/fail indicators.
13. **Added `GET /admin/products/:id/publish-readiness` API endpoint** — Returns structured readiness checklist for any product.
14. **Improved bulk publish error handling** — Bulk "Publish" action now reports which products failed and why (missing images, price, category, etc.).

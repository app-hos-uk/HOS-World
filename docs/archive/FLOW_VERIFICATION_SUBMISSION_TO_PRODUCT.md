# Product Submission → Approval → Product Visibility Flow – Verification

## Flow overview

1. **Seller submits product** → `POST /submissions` → `ProductSubmission` created (status `SUBMITTED`).
2. **Admin workflow** (Admin → Product Submissions): Procurement → Catalog → Marketing → Finance (approve).
3. **Publish** → `POST /publishing/publish/:submissionId` → `PublishingService.publish()` creates a `Product` and links it to the submission (`productId`, status `PUBLISHED`).
4. **Where the product appears**:
   - **Admin → Products → All Products** (`/admin/products`) – list from `GET /admin/products` (all products, any status).
   - **Seller → My Products** (`/seller/products`) – list from `GET /sellers/me/products` (seller’s products) plus pending submissions (no product yet).

## What was verified

### 1. Backend – submission to product

- **Submissions**: `POST /submissions` creates `ProductSubmission` with `productData` (including `images` as `{ url, alt?, order? }[]`).  
  Admin submission image thumbnails use `getImageUrl()` so both string and object shapes work.
- **Publishing**: `PublishingService.publish()`:
  - Requires `submission.status === 'FINANCE_APPROVED'` and `submission.catalogEntry`.
  - Calls `productsService.create(submission.seller.userId, { ... })` so the new product is tied to the seller.
  - Sets `submission.productId` and `submission.status = 'PUBLISHED'`.
  - **Fix applied**: If `catalogEntry.images` is missing or empty, images are taken from `productData.images` (supporting both string URLs and `{ url }` objects). Prevents publish from failing when catalog images are not set.

### 2. Admin – where to see approved products

- **Admin → Products → All Products** (`/admin/products`):
  - Uses `apiClient.getAdminProducts({ page, limit: 100 })` → `GET /admin/products`.
  - Backend: `AdminProductsService.getAllProducts()` returns `{ products, pagination }` for all products (no status filter), so **published products (and any other products) appear here**.
  - Frontend reads `response?.data?.products` (and fallbacks) and renders the table.

### 3. Seller – product list after submit and after approval

- **Seller → My Products** (`/seller/products`):
  - Uses `getSellerProducts()` → `GET /sellers/me/products` (all products for the authenticated seller, any status).
  - Also fetches `getSellerSubmissions()` and shows **pending submissions** (no `productId` yet) as “Pending review” so the list is not empty right after submit.
  - When a submission is published, it gets `productId`; it then disappears from the “pending” list and appears as a normal product from `GET /sellers/me/products`.

### 4. API contract

- **GET /admin/products**: Returns `{ data: { products, pagination }, message }`. Admin products page uses `response.data.products`. ✓
- **GET /sellers/me/products**: Returns `{ data: Product[], message }`. Seller products page uses it for the main list. ✓
- **Publish**: Creates product with `sellerId` from `submission.seller.userId` (resolved to Seller id in `productsService.create`). ✓

## Fix applied in this verification

- **PublishingService** (`services/api/src/publishing/publishing.service.ts`):  
  If `catalogEntry.images` is missing or empty, images are derived from `productData.images` (handling both string URLs and `{ url }` objects). This keeps publish working when the catalog step did not set images and avoids relying on a possibly undefined `catalogEntry.images`.

## How to manually test the flow

1. **Seller**: Log in as seller → Submit Product → fill form and submit.  
   - Go to My Products → submission should appear as “Pending review”.
2. **Admin**: Log in as admin → Product Submissions → run the workflow (Procurement approve → Catalog complete → Marketing complete → Finance approve).  
   - Use Publish (e.g. from Publishing API or UI if available) for the submission.
3. **Admin**: Products → All Products → the new product should appear in the list.
4. **Seller**: My Products → the same product should appear as a normal product (no longer only “Pending review”).

Conclusion: The flow from submission → approval → publish → product visible in Admin “All Products” and Seller “My Products” is consistent with the code; the only change made was the publishing image fallback above.

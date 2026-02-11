# Cross-seller duplicate detection

## Overview

Submissions from **different sellers/wholesalers** that represent the **same product** are grouped so procurement and catalogue can approve only one per product.

- **Detection**: Same product = exact SKU, barcode, or EAN, or name similarity ≥ 85%.
- **API**: `GET /api/duplicates/cross-seller-groups` (roles: PROCUREMENT, CATALOG, ADMIN).
- **Reject others**: `POST /api/duplicates/cross-seller-groups/reject-others` with `{ groupId, keepSubmissionId }` to reject all submissions in the group except the one to keep.

## Persisted group id (reporting)

- **Column**: `product_submissions.crossSellerGroupId` (nullable). Set by the assign job.
- **Assign job**: `POST /api/duplicates/cross-seller-groups/assign` (Admin only). Recomputes groups and writes `crossSellerGroupId` on each submission for reporting/analytics.
- **When to run**:
  - **On demand**: After bulk imports or when you need up-to-date group ids.
  - **Cron**: e.g. daily or hourly, call the assign endpoint with an Admin JWT:
    ```bash
    curl -X POST "https://your-api/api/duplicates/cross-seller-groups/assign" \
      -H "Authorization: Bearer $ADMIN_JWT"
    ```
- **Optional**: To run grouping on every new submission, call the assign endpoint from a background job or cron instead of from submission create to avoid slowing down creates.

## UI

- **Procurement / Catalog**: Review Submissions → toggle **Same product from multiple sellers**, or open `/procurement/submissions?view=cross-seller`. Use **Keep this & reject others** to reject all others in a group in one action.
- **Catalog dashboard**: Quick action **Same product from multiple sellers** links to the cross-seller view.

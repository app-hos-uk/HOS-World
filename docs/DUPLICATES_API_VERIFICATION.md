# Duplicates API – Endpoints & verification

## Base URL

- **Via gateway:** `https://<gateway>/api/duplicates`
- **Direct API:** `https://<api>/api/duplicates` (if bypassing gateway)

Gateway routes `/api/duplicates` to the product-service / monolith API (see `services/gateway/src/config/services.config.ts`).

---

## Endpoints summary

| Method | Path | Roles | Description |
|--------|------|--------|-------------|
| GET | `/api/duplicates/alerts` | PROCUREMENT, ADMIN | Duplicate alerts (vs existing products) |
| GET | `/api/duplicates/cross-seller-groups` | PROCUREMENT, CATALOG, ADMIN | Cross-seller duplicate groups |
| POST | `/api/duplicates/cross-seller-groups/assign` | ADMIN | Persist crossSellerGroupId for reporting |
| POST | `/api/duplicates/cross-seller-groups/reject-others` | PROCUREMENT, CATALOG, ADMIN | Reject all in group except one |
| GET | `/api/duplicates/submission/:submissionId` | WHOLESALER, B2C_SELLER, SELLER, PROCUREMENT, ADMIN | Duplicates for one submission |
| GET | `/api/duplicates/detect/:submissionId` | PROCUREMENT, ADMIN | Run duplicate detection for submission |

---

## Service functions (DuplicatesService)

| Method | Purpose |
|--------|---------|
| `findCrossSellerDuplicateGroups()` | Groups SUBMITTED/UNDER_REVIEW by same product across different sellers (SKU/barcode/EAN or name ≥85%). Returns `CrossSellerDuplicateGroup[]`. |
| `rejectOthersInGroup(groupId, keepSubmissionId)` | Rejects all submissions in the group except `keepSubmissionId` (status → PROCUREMENT_REJECTED, notes set). Returns `{ rejectedIds }`. |
| `assignCrossSellerGroupIds()` | Recomputes groups and sets `crossSellerGroupId` on each submission. Returns `{ groupsAssigned, submissionsUpdated }`. |
| `detectDuplicates(submissionId)` | Finds duplicates vs existing products (SKU/barcode/EAN/name). |
| `getDuplicatesForSubmission(submissionId)` | Returns stored duplicate detections for a submission. |
| `getSubmissionsWithDuplicates()` | Returns submissions that have duplicate alerts. |

---

## Manual verification (curl)

Replace `BASE` and `JWT` with your API base URL and a valid JWT for the required role.

### 1. GET cross-seller groups (Procurement/Catalog/Admin)

```bash
curl -s -X GET "$BASE/api/duplicates/cross-seller-groups" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json"
```

Expected: `200` with `{ "data": [ ... ], "message": "..." }`. Each group has `groupId`, `submissions`, `matchReasons`, `suggestedPrimaryId`.

### 2. POST reject others (after choosing one to keep)

```bash
curl -s -X POST "$BASE/api/duplicates/cross-seller-groups/reject-others" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"group-<id1>-<id2>","keepSubmissionId":"<uuid-to-keep>"}'
```

Expected: `200` with `{ "data": { "rejectedIds": [ ... ] }, "message": "..." }`.  
On invalid group: `404`. On keepSubmissionId not in group: `400`.

### 3. POST assign group ids (Admin only)

```bash
curl -s -X POST "$BASE/api/duplicates/cross-seller-groups/assign" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json"
```

Expected: `200` with `{ "data": { "groupsAssigned": N, "submissionsUpdated": M }, "message": "..." }`.

### 4. GET alerts (Procurement/Admin)

```bash
curl -s -X GET "$BASE/api/duplicates/alerts" \
  -H "Authorization: Bearer $JWT"
```

### 5. GET duplicates for submission

```bash
curl -s -X GET "$BASE/api/duplicates/submission/<submission-uuid>" \
  -H "Authorization: Bearer $JWT"
```

### 6. GET detect for submission

```bash
curl -s -X GET "$BASE/api/duplicates/detect/<submission-uuid>" \
  -H "Authorization: Bearer $JWT"
```

---

## Unit tests

Run the duplicates service tests:

```bash
cd services/api && pnpm test -- duplicates.service.spec
```

All 7 tests should pass (findCrossSellerDuplicateGroups ×2, rejectOthersInGroup ×3, assignCrossSellerGroupIds ×2).

This exercises:

- `findCrossSellerDuplicateGroups` (empty list, two submissions same product different sellers)
- `rejectOthersInGroup` (group not found, keepSubmissionId not in group, success)
- `assignCrossSellerGroupIds` (empty, and with one group of two submissions)

---

## Build check

```bash
cd services/api && pnpm run build
```

Ensures the duplicates controller and service compile and are registered in the app.

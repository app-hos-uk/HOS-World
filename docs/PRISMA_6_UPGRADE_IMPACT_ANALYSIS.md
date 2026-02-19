# Prisma 5.22.0 → 6.x Upgrade Impact Analysis

**Date:** 2026-02-18  
**Current:** Prisma 6.19.2 ✅ (upgraded from 5.22.0)  
**Target:** Prisma 6.x (latest 6.x)  
**Feasibility:** **HIGH** – Low risk, manageable effort  
**Status:** **COMPLETED** (2026-02-18)

---

## Executive Summary

| Aspect | Assessment |
|--------|------------|
| **Feasibility** | ✅ High – Breaking changes are minimal for this codebase |
| **Effort** | Low–Medium (~1–2 days) |
| **Risk** | Low |
| **Recommendation** | Proceed with upgrade; fix existing build errors first |

---

## 1. Prisma 6 Breaking Changes vs. This Codebase

### 1.1 Minimum Version Requirements ✅ PASS

| Requirement | Required | Current | Status |
|-------------|----------|---------|--------|
| Node.js (20.x) | 20.9.0+ | 20.20.0 | ✅ OK |
| TypeScript | 5.1.0+ | 5.9.3 | ✅ OK |

---

### 1.2 Implicit Many-to-Many Schema Change (PostgreSQL) ✅ NO IMPACT

**Change:** Prisma 6 changes implicit m-to-m relation tables from `UNIQUE INDEX` on (A, B) to `PRIMARY KEY` on (A, B).

**This codebase:** No implicit many-to-many relations found. All m-to-m relations use explicit join models (e.g. `ProductTag`, `TenantUser`, `ProductAttribute`). No `_ModelToModel` tables in migrations.

**Action:** None.

---

### 1.3 Full-Text Search Preview Feature ✅ NO IMPACT

**Change:** PostgreSQL users must switch from `fullTextSearch` to `fullTextSearchPostgres` preview feature.

**This codebase:** No `previewFeatures` in `schema.prisma`. No full-text search usage.

**Action:** None.

---

### 1.4 Buffer → Uint8Array for Bytes Fields ✅ NO IMPACT

**Change:** Prisma 6 uses `Uint8Array` instead of `Buffer` for `Bytes` fields.

**This codebase:** No `Bytes` fields in the Prisma schema. All `Buffer` usage is for crypto/encryption (e.g. `randomBytes`, `Buffer.from` for auth headers) – not Prisma.

**Action:** None.

---

### 1.5 NotFoundError Removed ⚠️ MINOR IMPACT

**Change:** `NotFoundError` removed. Use `PrismaClientKnownRequestError` with code `P2025` for `findUniqueOrThrow` / `findFirstOrThrow`.

**This codebase:** 3 usages of `findUniqueOrThrow`:

| File | Line | Notes |
|------|------|-------|
| `services/api/src/marketing/marketing.service.ts` | 239 | Returns result; no catch of NotFoundError |
| `services/api/src/products/volume-pricing.service.ts` | 97, 249 | Same – no explicit NotFoundError catch |

**Action:** Search for `NotFoundError` or `instanceof.*Error` around Prisma calls. If none catch `NotFoundError`, no change. If any do, update to:

```ts
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    // handle not found
  }
}
```

**Verified:** `grep NotFoundError` → 0 matches. No explicit `NotFoundError` handling. **No action required.**

---

### 1.6 New Reserved Model Names ✅ NO IMPACT

**Change:** `async`, `await`, `using` cannot be used as model names.

**This codebase:** No models named async, await, or using.

**Action:** None.

---

## 2. Scope of Change

### 2.1 Packages to Update

| Package/Service | Current | Action |
|-----------------|---------|--------|
| `packages/database-common` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/api` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/auth` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/admin` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/user` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/seller` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/search` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/product` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/payment` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/order` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/notification` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/inventory` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/influencer` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |
| `services/content` | prisma 5.22, @prisma/client 5.22 | Bump to 6.x |

**Total:** 14 packages.

---

### 2.2 Schema Location

- **Primary schema:** `services/api/prisma/schema.prisma`
- **Shared:** `packages/database-common` and other services reference the same schema (or a copy). Confirm schema sync strategy (e.g. shared package or symlink).

---

### 2.3 Migration Strategy

1. **Optional:** Create a dedicated migration for any implicit m-to-m changes.  
   **Result:** Not needed – no implicit m-to-m.

2. **Recommended:** After upgrading, run:
   ```bash
   cd services/api && pnpm exec prisma migrate dev --name upgrade-to-prisma-6
   ```
   This will generate a migration. If no schema changes are required, the migration may be empty or only contain no-op statements.

---

## 3. Pre-Existing Issues to Fix First

Before upgrading, address current build failures:

| File | Issue |
|------|-------|
| `services/api/src/products/products.service.ts` | TS2322: `status` type mismatch (string vs ProductStatus) |
| `services/api/src/publishing/publishing.service.ts` | TS2352: `pricingData` cast to `PricingData` |

Fixing these first will make the Prisma upgrade and verification smoother.

---

## 4. Upgrade Steps (Recommended Order)

1. Fix existing TypeScript/build errors in `products.service.ts` and `publishing.service.ts`.
2. Update `packages/database-common`: bump `prisma` and `@prisma/client` to `^6.0.0` (or latest 6.x).
3. Update all `services/*` that depend on Prisma: bump to `^6.0.0`.
4. Run `pnpm install` at repo root.
5. Run `prisma generate` in `services/api` (and any service that has its own schema).
6. Run `prisma migrate dev --name upgrade-to-prisma-6` in `services/api`.
7. Build all services: `pnpm run build`.
8. Run tests: `pnpm run test`.
9. Deploy to staging and run smoke tests before production.

---

## 5. Rollback Plan

- Keep Prisma 5.22.0 in a branch.
- If issues arise, revert package.json changes and `pnpm install`.
- Revert any migration if one was applied (use `prisma migrate resolve --rolled-back <migration_name>` if needed).

---

## 6. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Generated client API changes | Low | Medium | Prisma 5→6 is largely backward compatible; test after upgrade |
| Migration introduces schema drift | Low | High | Review migration SQL before applying; test on staging |
| NestJS/Prisma integration issues | Low | Medium | Use existing PrismaService pattern; no driver adapter change in 6 |
| Binary target / deployment | Low | Low | Keep `binaryTargets` in schema; Railway uses debian |

---

## 7. Conclusion

**Feasibility: HIGH**

- No implicit m-to-m relations.
- No Bytes fields, fullTextSearch, or NotFoundError handling.
- Node and TypeScript versions meet requirements.
- Main work: bumping versions in 14 packages, running generate/migrate, and fixing the 2 existing build errors.

**Estimated effort:** 1–2 days including testing.

**Recommendation:** Proceed with the upgrade after fixing the current build errors. Prisma 6 is a reasonable step before considering Prisma 7.

# Unused Code & Components Report

## Summary
This report identifies unused code, components, and files that can be safely removed to maintain a clean codebase.

---

## 1. Empty Directories

### `apps/web/src/app/admin/migration/`
- **Status**: Empty directory (migration page was deleted)
- **Action**: Remove directory
- **Reason**: The migration page was moved to `/admin/migration-features`, leaving an empty directory

---

## 2. Unused Package: `@hos-marketplace/ui-components`

### Location: `packages/ui-components/`
- **Status**: Placeholder package with no actual exports
- **Content**: Only exports empty object `export {};`
- **Usage**: Not imported anywhere in the codebase
- **Dependencies**: Has dependencies but nothing uses them
- **Action**: Remove entire package and references
- **Files to remove**:
  - `packages/ui-components/` (entire directory)
  - Remove from `apps/web/package.json`
  - Remove from `apps/web/next.config.js`
  - Remove from `pnpm-workspace.yaml` (if present)

---

## 3. Unused Utility Functions

### Location: `packages/utils/src/slug.ts`
- **Functions**:
  1. `generateUniqueSlug()` - Never used anywhere
  2. `extractSlugFromUrl()` - Never used anywhere
- **Action**: Remove these functions (keep `slugify()` as it's used)
- **Note**: `slugify()` is used, but there are duplicate implementations in:
  - `services/api/src/auth/auth.service.ts`
  - `services/api/src/products/products.service.ts`
  - `services/api/src/database/seed-all-roles.ts`
  - `services/api/src/admin/products.service.ts` (private method)
  - `services/api/src/sellers/sellers.service.ts` (private method)
  - `services/api/src/support/knowledge-base.service.ts` (private method)

**Recommendation**: Consolidate all slugify functions to use `@hos-marketplace/utils` package (future improvement, not removing now)

---

## 4. Placeholder Scripts (Optional)

### Location: `apps/web/scripts/`
- **Files**:
  1. `generate-placeholders.js` - Generates placeholder images
  2. `generate-placeholders.sh` - Shell script version
- **Status**: Development utility scripts
- **Action**: Keep for now (may be useful for development), but can be removed if not needed

---

## 5. Unused API Client Methods (Verify)

### Location: `packages/api-client/src/client.ts`
- **Methods to verify**:
  - `runGlobalFeaturesMigration()` - Check if still used
  - `runSQLDirectMigration()` - Check if still used
  - `verifyMigration()` - Check if still used

**Status**: These appear to be replaced by `runComprehensiveFeaturesMigration()` and `verifyComprehensiveFeaturesMigration()`

---

## 6. Documentation Files (Optional Cleanup)

### Files that could be removed if not needed:
- `LINT_AND_ERROR_FIXES.md` - Historical documentation
- `PHASE2_*.md` - Phase completion docs (multiple files)
- `PHASE6_*.md` - Phase completion docs
- `IMPLEMENTATION_SUMMARY*.md` - Implementation summaries
- `TEST_SUMMARY.md` - Test documentation
- `ALL_PHASES_COMPLETE.md` - Completion documentation

**Action**: Keep for reference, but can be archived or removed if not needed

---

## Removal Priority

### High Priority (Safe to Remove):
1. ✅ Empty `apps/web/src/app/admin/migration/` directory
2. ✅ Unused `@hos-marketplace/ui-components` package
3. ✅ Unused `generateUniqueSlug()` and `extractSlugFromUrl()` functions

### Medium Priority (Completed):
4. ✅ Unused API client methods (`runGlobalFeaturesMigration`, etc.) - **REMOVED**
5. ⚠️ Placeholder scripts (keep if useful for dev) - **KEPT** (useful for development)

### Low Priority (Optional):
6. 📄 Documentation files (keep for reference)

---

## Files Removed ✅

1. ✅ `apps/web/src/app/admin/migration/` (empty directory) - **REMOVED**
2. ✅ `packages/ui-components/` (entire package) - **REMOVED**
3. ✅ Remove unused functions from `packages/utils/src/slug.ts` - **REMOVED**
4. ✅ Update `apps/web/package.json` (remove ui-components dependency) - **UPDATED**
5. ✅ Update `apps/web/next.config.js` (remove ui-components from transpilePackages) - **UPDATED**
6. ✅ `runGlobalFeaturesMigration()`, `runSQLDirectMigration()`, and `verifyMigration()` in API client - **REMOVED** (replaced by comprehensive migration methods)

---

## Estimated Cleanup Impact

- **Directories**: 2
- **Files**: ~10-15 (including package files)
- **Lines of Code**: ~200-300
- **Dependencies**: 1 package removed
- **Build Time**: Slightly faster (fewer packages to process)


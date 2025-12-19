# No Products Available Issue Verification

## Issue Report
**Reported Issue**: "Could not test as Customer - No products are available"

## Investigation Summary

### Root Cause Analysis

1. **Product Status Filtering**:
   - `ProductsService.findAll()` filters products with `status: 'ACTIVE'` (line 208)
   - Only products with `ACTIVE` status are visible to customers
   - Products with `DRAFT`, `INACTIVE`, or `OUT_OF_STOCK` status are hidden

2. **Product Creation Default Status**:
   - Products are created with `status: 'DRAFT'` by default (schema.prisma line 220)
   - `ProductsService.createProduct()` defaults to `'DRAFT'` if no status provided (line 125)
   - `AdminProductsService.createProduct()` defaults to `'DRAFT'` if no status provided (line 126)

3. **Status Mismatch Issue**:
   - Admin API accepts `status?: 'DRAFT' | 'PUBLISHED'` (AdminProductsController line 47, 86)
   - ProductStatus enum has: `DRAFT`, `ACTIVE`, `INACTIVE`, `OUT_OF_STOCK` (NO 'PUBLISHED')
   - When admin sets status to 'PUBLISHED', it was being cast to `any` without mapping
   - This caused 'PUBLISHED' to be stored incorrectly or fail validation

4. **Product Publishing Workflow**:
   - Products go through a submission workflow: SUBMITTED → PROCUREMENT_APPROVED → ... → FINANCE_APPROVED → PUBLISHED
   - `PublishingService.publish()` correctly sets status to 'ACTIVE' when publishing (line 65)
   - However, direct product creation (bypassing workflow) doesn't automatically activate products

### Technical Details

**Files Involved**:
- `services/api/src/products/products.service.ts` (line 208): Filters by `status: 'ACTIVE'`
- `services/api/src/admin/products.service.ts` (line 126, 200): Status handling with 'PUBLISHED' mismatch
- `services/api/prisma/schema.prisma` (line 220, 245-250): ProductStatus enum definition
- `services/api/src/publishing/publishing.service.ts` (line 65): Sets status to 'ACTIVE' when publishing

**The Problem**:
1. Products created directly (not through submission workflow) default to `DRAFT` status
2. Admin API accepts 'PUBLISHED' but doesn't map it to 'ACTIVE'
3. Customers only see products with `ACTIVE` status
4. Result: No products visible to customers if all products are in `DRAFT` status

## Fixes Implemented

### 1. Status Mapping Fix
**File**: `services/api/src/admin/products.service.ts`

**In `createProduct()` method**:
- Changed: `status: (data.status as any) || 'DRAFT'`
- To: `status: data.status === 'PUBLISHED' ? 'ACTIVE' : (data.status as any) || 'DRAFT'`
- Maps 'PUBLISHED' to 'ACTIVE' during product creation

**In `updateProduct()` method**:
- Added status mapping after preparing updateData
- Maps 'PUBLISHED' to 'ACTIVE' during product updates

### 2. Documentation
Created this verification document to explain the issue and solution.

## Testing Recommendations

1. **Test Product Creation with ACTIVE Status**:
   ```bash
   # Create product with ACTIVE status via admin API
   POST /api/admin/products
   {
     "name": "Test Product",
     "description": "Test description",
     "price": 29.99,
     "status": "PUBLISHED"  # Should map to ACTIVE
   }
   ```

2. **Verify Product Visibility**:
   - Check that product appears in customer-facing `/api/products` endpoint
   - Verify product shows on `/products` page

3. **Test Status Updates**:
   ```bash
   # Update product status to PUBLISHED
   PUT /api/admin/products/{id}
   {
     "status": "PUBLISHED"  # Should map to ACTIVE
   }
   ```

4. **Verify All Status Values**:
   - Test with 'DRAFT' (should remain DRAFT, not visible to customers)
   - Test with 'PUBLISHED' (should become ACTIVE, visible to customers)
   - Test with 'ACTIVE' (should remain ACTIVE, visible to customers)
   - Test with 'INACTIVE' (should remain INACTIVE, not visible to customers)

## Additional Recommendations

1. **Create Test Products Script**:
   - Add a script to create sample products with ACTIVE status for testing
   - Include products with images, variations, and proper categorization

2. **Admin UI Enhancement**:
   - Update admin product creation/editing UI to show status options clearly
   - Display 'ACTIVE' instead of 'PUBLISHED' in status dropdown
   - Add tooltip explaining that ACTIVE products are visible to customers

3. **Product Status Documentation**:
   - Document that customers only see ACTIVE products
   - Explain the product lifecycle and status transitions
   - Provide guidance on when to use each status

## Conclusion

✅ **Issue Verified**: YES - The issue exists due to:
1. Products defaulting to DRAFT status
2. Status mismatch between admin API ('PUBLISHED') and ProductStatus enum ('ACTIVE')
3. Customer-facing API filtering only ACTIVE products

✅ **Fix Implemented**: Status mapping from 'PUBLISHED' to 'ACTIVE' in both create and update methods

⚠️ **Action Required**: 
- Test the fix by creating products with 'PUBLISHED' status
- Verify they appear in customer-facing product listings
- Consider creating sample products with ACTIVE status for testing


# ISO Country Code Implementation Guide

## Summary
Systematic implementation of ISO 3166-1 alpha-2 country codes across the HOS platform.
**Goal**: Replace free-text country names with standardized 2-letter codes (US, GB, AE, MY, etc.)

## Completed (Phase 1)

### Database
- ✅ Added `countryCode` fields to 10 models (User, Store, Customer, Seller, Address, FulfillmentCenter, LogisticsPartner, Warehouse, TaxZone, FoundingMember)
- ✅ Migration: `/services/api/prisma/migrations/20261012000000_add_iso_country_codes/migration.sql`
- ✅ Indexes created for all new fields
- ✅ Original `country` fields preserved for audit trail

### Shared Utilities
- ✅ Country list: `/apps/web/src/lib/countries.ts` (32 countries)
- ✅ React component: `/apps/web/src/components/CountrySelect.tsx`
- ✅ Utility: `/services/api/src/common/utils/country-code.ts` (already exists - normalizes display names to ISO)

### DTOs Updated (4 completed)
1. ✅ `CreateFoundingMemberDto` - Founding member registration
2. ✅ `RegisterDto` - User/seller registration  
3. ✅ `EnrollLoyaltyDto` - Enchanted Circle loyalty
4. ✅ `CreateAddressDto` - Shipping/billing addresses

### Services Updated (1 completed)
1. ✅ `FoundingMembersService.createMember()` - Uses normalizeCountryCode utility

### Forms Updated (1 completed)
1. ✅ `/apps/web/src/app/(landing)/components/FoundingMemberForm.tsx`

---

## Remaining Work (Phase 2)

### DTOs to Update (6 remaining)

1. **UpdateAddressDto** (`/services/api/src/addresses/dto/update-address.dto.ts`)
   - Add same validation as CreateAddressDto

2. **UpdateSellerDto** (`/services/api/src/sellers/dto/update-seller.dto.ts`)
   - Add countryCode validation for seller location updates

3. **Store DTOs** (likely in `/services/api/src/stores/`)
   - CreateStoreDto
   - UpdateStoreDto

4. **Warehouse DTOs** (likely in `/services/api/src/inventory/` or `/services/api/src/warehouses/`)
   - CreateWarehouseDto
   - UpdateWarehouseDto

5. **FulfillmentCenter DTOs** (likely in `/services/api/src/fulfillment/` or similar)
   - CreateFulfillmentCenterDto

6. **TaxZone DTOs** (`/services/api/src/tax/`)
   - CreateTaxZoneDto or similar

### Services to Update (9 remaining)

Pattern for each service:
```typescript
import { normalizeCountryCode } from '../common/utils/country-code';

// In create/update methods:
const normalizedCode = dto.countryCode 
  ? dto.countryCode.toUpperCase()
  : normalizeCountryCode(dto.country);

await prisma.model.create({
  data: {
    ...dto,
    country: dto.country?.trim() || null,
    countryCode: normalizedCode || null,
  }
});
```

Services to update:
1. `AuthService` - User registration (`/services/api/src/auth/auth.service.ts`)
2. `AddressesService` - Address CRUD
3. `SellersService` - Seller onboarding
4. `StoresService` - Store management
5. `WarehousesService` - Warehouse management
6. `FulfillmentService` - Fulfillment center management
7. `TaxService` - Tax zone configuration
8. `LogisticsService` - Logistics partner management
9. `CustomersService` - Customer profile management

### Frontend Forms to Update (many remaining)

**Pattern**: Replace text input or hardcoded dropdown with `<CountrySelect/>`:

```tsx
import { CountrySelect } from '@/components/CountrySelect';

// Replace:
<input name="country" />
// or
<select name="country">
  <option>United States</option>
  ...
</select>

// With:
<CountrySelect 
  name="countryCode" 
  required={true}
  className="..."
/>
```

Forms to update:
1. **User Registration** (`/apps/web/src/app/register/` or `/apps/web/src/components/auth/`)
2. **Seller Onboarding** (`/apps/web/src/app/seller/onboard/` or similar)
3. **Address Forms** 
   - Checkout address
   - Profile address management
   - Admin address forms
4. **Admin Forms**
   - Store creation/edit
   - Warehouse creation/edit
   - Fulfillment center management
   - Tax zone configuration
   - Seller management
5. **Loyalty Enrollment** (if it has a UI form)

### Testing & Validation

1. **Run Prisma Migration**
   ```bash
   cd services/api
   npx prisma migrate dev
   ```

2. **TypeScript Compilation**
   ```bash
   cd services/api && npx tsc --noEmit
   cd apps/web && npx tsc --noEmit
   ```

3. **Unit Tests**
   ```bash
   cd services/api && npx jest
   cd apps/web && npx jest
   ```

4. **Manual Testing Checklist**
   - [ ] Founding member registration works
   - [ ] User registration works  
   - [ ] Address creation works
   - [ ] Seller onboarding works
   - [ ] Admin forms save correctly
   - [ ] Existing data still displays (legacy `country` field)
   - [ ] New data saves ISO codes in `countryCode` field

### Data Migration (Optional - Run After All Code Changes)

Once all code changes are deployed, optionally backfill existing records:

```typescript
// Run once to normalize existing data
// services/api/scripts/backfill-country-codes.ts

import { PrismaClient } from '@prisma/client';
import { normalizeCountryCode } from '../src/common/utils/country-code';

const prisma = new PrismaClient();

const MODELS = [
  'user', 'store', 'customer', 'seller', 'address',
  'fulfillmentCenter', 'logisticsPartner', 'warehouse',
  'taxZone', 'foundingMember'
];

async function backfill() {
  for (const model of MODELS) {
    const records = await prisma[model].findMany({
      where: { 
        countryCode: null,
        country: { not: null }
      }
    });

    for (const record of records) {
      const code = normalizeCountryCode(record.country);
      if (code) {
        await prisma[model].update({
          where: { id: record.id },
          data: { countryCode: code }
        });
      }
    }
    
    console.log(`${model}: Updated ${records.length} records`);
  }
}

backfill().then(() => console.log('Done'));
```

---

## Quick Reference

### ISO Codes for Primary Markets
- `US` - United States
- `GB` - United Kingdom  
- `AE` - United Arab Emirates
- `MY` - Malaysia

### Validation Pattern
```typescript
@Length(2, 2)
@Matches(/^[A-Z]{2}$/)
countryCode: string;
```

### API Request Example
```json
{
  "firstName": "John",
  "countryCode": "US"
}
```

### Frontend Usage
```tsx
<CountrySelect 
  name="countryCode"
  value={formData.countryCode}
  onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
  required
/>
```

---

## Notes

- **Backwards Compatible**: Old `country` field still works during transition
- **No Data Loss**: Original values preserved in `country` column
- **Normalize on Save**: `normalizeCountryCode()` handles legacy input
- **Frontend**: Use shared `<CountrySelect/>` for consistency
- **32 Countries Supported**: Can add more to `/apps/web/src/lib/countries.ts`

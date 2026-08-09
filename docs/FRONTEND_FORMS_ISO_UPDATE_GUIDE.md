# Frontend Forms - ISO Country Code Update Guide

## ✅ Completed Forms
1. **Login/Registration** (`/apps/web/src/app/login/page.tsx`) ✓
2. **Founding Member Registration** (`/apps/web/src/app/(landing)/components/FoundingMemberForm.tsx`) ✓

---

## 📋 Remaining Forms to Update (9)

### Pattern for All Updates

Every form follows the same 4-step pattern. Use `/apps/web/src/app/login/page.tsx` as the reference implementation.

#### Step 1: Add Imports
```tsx
import { CountrySelect } from '@/components/CountrySelect';
import { COUNTRIES } from '@/lib/countries';
```

#### Step 2: Update State Variable
```tsx
// BEFORE:
const [country, setCountry] = useState('');

// AFTER:
const [countryCode, setCountryCode] = useState('');
```

#### Step 3: Replace Dropdown
```tsx
// BEFORE:
<select name="country" value={country} onChange={(e) => setCountry(e.target.value)}>
  <option value="">Select country</option>
  <option value="United States">United States</option>
  ...
</select>

// AFTER:
<CountrySelect
  name="countryCode"
  value={countryCode}
  onChange={(e) => setCountryCode(e.target.value)}
  required
  className={yourClassName}
/>
```

#### Step 4: Update API Payload
```tsx
// BEFORE:
const payload = {
  ...data,
  country: country,
};

// AFTER:
const payload = {
  ...data,
  countryCode: countryCode,
  country: COUNTRIES.find(c => c.code === countryCode)?.name || countryCode,
};
```

---

## Detailed Form-by-Form Instructions

### 1. Checkout Page (`/apps/web/src/app/checkout/page.tsx`)

**Lines to Update:**
- Line 33: `country: regionCountry` → Keep for display purposes
- Line 82: `country: regionCountryToFormValue(regionCountry) || 'United States'` → Change to `countryCode: 'US'`
- Guest checkout form state (`guestForm`)
- Shipping address display

**Special Considerations:**
- Uses `regionCountry` from `useCurrency()` hook
- Has guest checkout flow
- Address display and validation
- Shipping calculation depends on country

**Key Changes:**
```tsx
// Guest form initial state
const [guestForm, setGuestForm] = useState({
  // ...other fields
  countryCode: 'US',  // Changed from country: 'United States'
});

// When submitting guest checkout
await apiClient.guestCheckout({
  ...guestForm,
  country: COUNTRIES.find(c => c.code === guestForm.countryCode)?.name || guestForm.countryCode,
});
```

---

### 2. Seller Profile (`/apps/web/src/app/seller/profile/page.tsx`)

**What to Look For:**
- Seller business location input
- Warehouse address fields
- Operations contact address

**Pattern:**
- Find all `country` form fields
- Replace with `<CountrySelect name="countryCode" />`
- Update submit handlers to include both `countryCode` and `country`

---

### 3. Wholesaler Profile (`/apps/web/src/app/wholesaler/profile/page.tsx`)

**Similar to Seller Profile:**
- Business registration address
- Shipping/billing addresses
- Update `UpdateSellerDto` payload with `countryCode`

---

### 4. Customer Profile (`/apps/web/src/app/profile/page.tsx`)

**What to Update:**
- User profile country preference
- Possibly linked to shipping addresses
- Usually simpler than seller profiles

---

### 5. Admin Warehouses (`/apps/web/src/app/admin/warehouses/page.tsx`)

**Critical for Operations:**
- Warehouse location (affects shipping origin)
- Create/Edit warehouse forms
- Table display columns

**Example:**
```tsx
// Warehouse form
<CountrySelect
  name="countryCode"
  value={formData.countryCode}
  onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
  required
/>

// On submit
await apiClient.createWarehouse({
  ...formData,
  countryCode: formData.countryCode,
  country: COUNTRIES.find(c => c.code === formData.countryCode)?.name,
});
```

---

### 6. Admin Fulfillment Centers (`/apps/web/src/app/admin/fulfillment-centers/page.tsx`)

**Similar to Warehouses:**
- Fulfillment center location
- Affects order routing
- Create/Edit forms

---

### 7. Admin Tax Zones (`/apps/web/src/app/admin/tax-zones/page.tsx`)

**Tax Configuration:**
- Tax zone country selection
- May have multiple countries per zone
- Critical for tax calculation accuracy

**Special Case:**
```tsx
// If multi-select:
<CountrySelect
  name="countryCode"
  value={selectedCountries}
  onChange={handleMultiCountryChange}
  // May need custom multi-select implementation
/>
```

---

### 8. Admin Founding Members (`/apps/web/src/app/admin/founding-members/page.tsx`)

**Admin Management:**
- Viewing/editing founding member countries
- Bulk import functionality
- Display-only (may not need form updates)

**Note:** If this is display-only, ensure country codes are shown correctly when displaying data:
```tsx
// Display
{COUNTRIES.find(c => c.code === member.countryCode)?.name || member.country}
```

---

### 9. Admin Orders (`/apps/web/src/app/admin/orders/page.tsx`)

**Order Management:**
- Shipping/billing address display
- Address editing (if allowed)
- Usually display-only, but check for edit modals

---

## Currency Mapping Helper

When updating currency based on country selection, use ISO codes:

```tsx
const COUNTRY_CURRENCIES: Record<string, string> = {
  'US': 'USD',
  'GB': 'GBP',
  'AE': 'AED',
  'MY': 'MYR',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'PT': 'EUR',
  'IE': 'EUR',
  'AU': 'AUD',
  'CA': 'CAD',
  'SG': 'SGD',
  'JP': 'JPY',
  'CN': 'CNY',
  'IN': 'INR',
  'BR': 'BRL',
  'MX': 'MXN',
  // Add more as needed
};
```

---

## Testing Checklist

After updating each form:

- [ ] TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] Form displays country dropdown correctly
- [ ] Dropdown shows all 32 countries from `COUNTRIES` list
- [ ] Selected value persists on change
- [ ] API payload includes both `countryCode` and `country`
- [ ] Existing data displays correctly (uses `countryCode` if available, falls back to `country`)
- [ ] Currency updates automatically (if applicable)
- [ ] Address field labels update based on country (if using `getAddressFieldLabels`)

---

## Common Pitfalls

### 1. Forgetting to Send Both Fields
```tsx
// ❌ WRONG - Only sending countryCode
const payload = { countryCode };

// ✅ CORRECT - Send both for backward compatibility
const payload = {
  countryCode,
  country: COUNTRIES.find(c => c.code === countryCode)?.name || countryCode,
};
```

### 2. Not Handling Empty State
```tsx
// ❌ WRONG - Can cause undefined errors
<CountrySelect value={countryCode} />

// ✅ CORRECT - Default to empty string
<CountrySelect value={countryCode || ''} />
```

### 3. Currency Mapping with Display Names
```tsx
// ❌ WRONG - Using old display names
const currency = CURRENCIES['United States']; // Won't work

// ✅ CORRECT - Using ISO codes
const currency = COUNTRY_CURRENCIES[countryCode] || 'USD';
```

### 4. Display Values
```tsx
// ❌ WRONG - Showing ISO code to user
<p>Country: {countryCode}</p>

// ✅ CORRECT - Showing full name
<p>Country: {COUNTRIES.find(c => c.code === countryCode)?.name}</p>
```

---

## Verification Script

After completing all updates, run:

```bash
# Check for remaining hardcoded country dropdowns
cd /Users/sabuj/Desktop/HOS-Latest/apps/web
rg '<select.*country' --type tsx

# Check for remaining 'country' state variables (may have false positives)
rg 'useState.*country[^C]' --type tsx

# Verify all forms import CountrySelect
rg 'CountrySelect' src/app/*/page.tsx
```

---

## Priority Order

If time-constrained, update in this order:

1. ✅ **Login** (DONE) - Highest traffic
2. ✅ **Founding Member** (DONE) - Waitlist critical
3. **Checkout** - User-facing, affects orders
4. **Seller Profile** - Merchant onboarding
5. **Admin Warehouses** - Operational accuracy
6. **Admin Fulfillment Centers** - Operational accuracy
7. **Wholesaler Profile** - B2B onboarding
8. **Admin Tax Zones** - Tax accuracy
9. **Customer Profile** - Nice-to-have
10. **Admin Founding Members** - Admin-only, display
11. **Admin Orders** - Usually display-only

---

## Support

**Reference Implementation:** `/apps/web/src/app/login/page.tsx` (fully updated)

**Backend:** All DTOs and services already handle ISO codes correctly. No backend changes needed.

**Component API:**
```tsx
<CountrySelect
  id?: string;              // default: 'country'
  name?: string;            // default: 'countryCode'
  value?: string;           // ISO code (e.g., 'US')
  onChange?: (e) => void;
  required?: boolean;       // default: false
  disabled?: boolean;       // default: false
  className?: string;       // your styles
  placeholder?: string;     // default: 'Select country'
/>
```

---

**Last Updated:** Sunday, Aug 9, 2026
**Status:** 2 of 11 forms complete, 9 remaining
**Estimated Time:** ~30 mins per form (4-5 hours total for remaining 9)

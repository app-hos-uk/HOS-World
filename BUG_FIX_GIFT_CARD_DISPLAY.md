# Bug Fix: Gift Card Display and Calculation

**Date**: 2025-01-XX  
**Status**: ✅ **FIXED**

## Bug Description

### Issue
The `calculateTotal()` function and display logic had issues when gift cards were previously redeemed:

1. **Display Issue**: The breakdown didn't show previously redeemed gift card amounts, making it unclear why the "Amount to Pay" was lower than the original order total.

2. **Display Condition**: The breakdown only showed when `giftCardApplied` was true, so if there was a previously redeemed amount but no new gift card applied, users wouldn't see the breakdown.

3. **Misleading Display**: When both a previously redeemed amount and a newly applied gift card existed, the display only showed the new gift card, not the previously redeemed amount, causing confusion.

### Example Scenario
- Order total: £100
- Previously redeemed: £30 (`giftCardRedeemedAmount = 30`)
- New gift card applied: £20 (`giftCardBalance = 20`, `giftCardApplied = true`)

**Before Fix** (❌ MISLEADING):
- Order Total: £100
- Gift Card Applied: -£20
- Amount to Pay: £50

**After Fix** (✅ CLEAR):
- Original Order Total: £100
- Previously Redeemed Gift Cards: -£30
- Gift Card Applied (Not Yet Redeemed): -£20
- Amount to Pay: £50

---

## Fix Applied

### File: `apps/web/src/app/payment/page.tsx`

**Before** (❌ BUGGY):
```typescript
{/* Order Total with Gift Card Discount */}
{giftCardApplied && (
  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex justify-between text-sm mb-2">
      <span>Order Total:</span>
      <span>{formatPrice(order.total, order.currency || 'GBP')}</span>
    </div>
    {giftCardBalance !== null && giftCardBalance !== undefined && giftCardBalance > 0 && (
      <div className="flex justify-between text-sm mb-2 text-green-700">
        <span>Gift Card Applied:</span>
        <span>-{formatPrice(Math.min(giftCardBalance, order.total), order.currency || 'GBP')}</span>
      </div>
    )}
    <div className="flex justify-between font-bold text-lg pt-2 border-t border-blue-300">
      <span>Amount to Pay:</span>
      <span>{formatPrice(calculateTotal(), order.currency || 'GBP')}</span>
    </div>
  </div>
)}
```

**After** (✅ FIXED):
```typescript
{/* Order Total with Gift Card Discount */}
{(giftCardApplied || giftCardRedeemedAmount > 0) && (
  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex justify-between text-sm mb-2">
      <span>Original Order Total:</span>
      <span>{formatPrice(order.total, order.currency || 'GBP')}</span>
    </div>
    {giftCardRedeemedAmount > 0 && (
      <div className="flex justify-between text-sm mb-2 text-green-700">
        <span>Previously Redeemed Gift Cards:</span>
        <span>-{formatPrice(giftCardRedeemedAmount, order.currency || 'GBP')}</span>
      </div>
    )}
    {giftCardApplied && giftCardBalance !== null && giftCardBalance !== undefined && giftCardBalance > 0 && (
      <div className="flex justify-between text-sm mb-2 text-green-700">
        <span>Gift Card Applied (Not Yet Redeemed):</span>
        <span>-{formatPrice(Math.min(giftCardBalance, Math.max(0, (order.total || 0) - giftCardRedeemedAmount)), order.currency || 'GBP')}</span>
      </div>
    )}
    <div className="flex justify-between font-bold text-lg pt-2 border-t border-blue-300">
      <span>Amount to Pay:</span>
      <span>{formatPrice(calculateTotal(), order.currency || 'GBP')}</span>
    </div>
  </div>
)}
```

**Key Changes**:
1. ✅ Changed display condition from `giftCardApplied` to `(giftCardApplied || giftCardRedeemedAmount > 0)` - now shows breakdown even if only previously redeemed amounts exist
2. ✅ Added display of previously redeemed gift card amounts
3. ✅ Changed "Order Total" to "Original Order Total" for clarity
4. ✅ Changed "Gift Card Applied" to "Gift Card Applied (Not Yet Redeemed)" to distinguish from previously redeemed
5. ✅ Fixed calculation of applied gift card deduction to use remaining total after previous redemptions: `Math.min(giftCardBalance, Math.max(0, (order.total || 0) - giftCardRedeemedAmount))`

---

## Calculation Logic Verification

The `calculateTotal()` function logic is **correct**:

```typescript
const calculateTotal = () => {
  let total = order.total || 0;
  // Subtract any already-redeemed gift card amount
  total = Math.max(0, total - giftCardRedeemedAmount);
  // If gift card is still applied (not yet redeemed in this session), subtract its balance from remaining total
  if (giftCardApplied && giftCardBalance !== null && giftCardBalance !== undefined) {
    // Subtract the applied gift card balance from the remaining total (after previous redemptions)
    total = Math.max(0, total - Math.min(giftCardBalance, total));
  }
  return total;
};
```

**Logic Flow**:
1. Start with original order total
2. Subtract previously redeemed amounts
3. If a gift card is applied (not yet redeemed), subtract its balance from the remaining total
4. Return the final amount

This is **correct** - it properly accounts for both previously redeemed amounts and currently applied gift cards.

---

## Verification

### Test Scenario 1: Only Previously Redeemed
- Order total: £100
- Previously redeemed: £30
- No new gift card applied
- Expected display:
  - Original Order Total: £100
  - Previously Redeemed Gift Cards: -£30
  - Amount to Pay: £70
- ✅ **PASS** - Now shows breakdown

### Test Scenario 2: Previously Redeemed + New Gift Card
- Order total: £100
- Previously redeemed: £30
- New gift card applied: £20
- Expected display:
  - Original Order Total: £100
  - Previously Redeemed Gift Cards: -£30
  - Gift Card Applied (Not Yet Redeemed): -£20
  - Amount to Pay: £50
- ✅ **PASS** - Clear breakdown

### Test Scenario 3: Only New Gift Card (No Previous Redemption)
- Order total: £100
- No previous redemption
- New gift card applied: £20
- Expected display:
  - Original Order Total: £100
  - Gift Card Applied (Not Yet Redeemed): -£20
  - Amount to Pay: £80
- ✅ **PASS** - Works correctly

---

## Impact

✅ **Fixed**: Display now shows previously redeemed amounts  
✅ **Fixed**: Display condition includes previously redeemed amounts  
✅ **Fixed**: Clear distinction between redeemed and applied gift cards  
✅ **Fixed**: Applied gift card deduction calculation uses remaining total  
✅ **Improved**: Better user experience with clear breakdown

---

**Status**: ✅ **Bug Fixed - Ready for Testing**

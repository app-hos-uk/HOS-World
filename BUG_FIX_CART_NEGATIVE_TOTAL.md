# Bug Fix: Cart Total Calculation - Negative Total Prevention

**Date**: 2025-01-XX  
**Status**: ✅ **FIXED**

## Bug Description

### Issue
The cart total calculation doesn't constrain the result to a minimum of zero. If a discount exceeds the subtotal, the total becomes negative, which is invalid for payment processing.

### Problem Scenario
1. User has items totaling £50.00 (subtotal)
2. User applies a coupon with £60.00 discount
3. Shipping is £5.00
4. **Current calculation**: `50 - 60 + 5 = -5` ❌ **NEGATIVE TOTAL**
5. This causes:
   - Invalid payment processing
   - Confusing UI display (negative amount)
   - Potential payment gateway errors
   - Data inconsistency

### Root Cause
The calculation formula doesn't enforce a minimum value of zero:
```typescript
const total = (subtotal - discount + shipping);
```

---

## Fix Applied

### File: `apps/web/src/app/cart/page.tsx`

**Before** (❌ BUGGY):
```typescript
const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
const discount = cart.discount || 0;
const shipping = cart.shipping || 0;
const total = (subtotal - discount + shipping); // ❌ Can be negative
```

**After** (✅ FIXED):
```typescript
const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
const discount = cart.discount || 0;
const shipping = cart.shipping || 0;
const total = Math.max(0, subtotal - discount + shipping); // ✅ Minimum 0
```

**Key Change**:
- ✅ Added `Math.max(0, ...)` to ensure total never goes below zero
- ✅ Prevents negative totals even when discount exceeds subtotal
- ✅ Ensures valid payment processing

---

## Verification

### Test Scenario 1: Normal Case
- Subtotal: £50.00
- Discount: £10.00
- Shipping: £5.00
- Expected: `Math.max(0, 50 - 10 + 5) = 45` ✅ **PASS**

### Test Scenario 2: Discount Exceeds Subtotal
- Subtotal: £50.00
- Discount: £60.00
- Shipping: £5.00
- Expected: `Math.max(0, 50 - 60 + 5) = 0` ✅ **PASS** (was -5 before)

### Test Scenario 3: Free Shipping with Large Discount
- Subtotal: £30.00
- Discount: £35.00
- Shipping: £0.00
- Expected: `Math.max(0, 30 - 35 + 0) = 0` ✅ **PASS** (was -5 before)

### Test Scenario 4: Zero Subtotal
- Subtotal: £0.00
- Discount: £10.00
- Shipping: £5.00
- Expected: `Math.max(0, 0 - 10 + 5) = 0` ✅ **PASS** (was -5 before)

---

## Impact

✅ **Fixed**: Cart total never goes negative  
✅ **Fixed**: Payment processing remains valid  
✅ **Fixed**: UI displays correct (non-negative) amounts  
✅ **Improved**: Better handling of edge cases with large discounts  
✅ **Improved**: Prevents payment gateway errors from negative amounts

---

## Business Logic Note

When a discount exceeds the subtotal (including shipping), the total becomes £0.00. This is the correct behavior because:

1. **Customer pays nothing** - The discount fully covers the order
2. **Payment processing** - £0.00 is a valid payment amount (or can be handled as "fully covered by discount")
3. **User experience** - Clear indication that the order is free
4. **Data integrity** - No negative amounts in the system

If the business requires different behavior (e.g., minimum order value, shipping still charged), that should be handled at the discount/coupon validation level, not in the total calculation.

---

**Status**: ✅ **Bug Fixed - Ready for Testing**

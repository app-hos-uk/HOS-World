# Complete Flow Testing Guide

## Cart → Checkout → Payment Flow

### Prerequisites
1. User must be logged in
2. User must have at least one address in their profile
3. Cart must have at least one item

### Step 1: Cart Page (`/cart`)
**Features to test:**
- ✅ View cart items
- ✅ Update item quantities
- ✅ Remove items
- ✅ Apply coupon codes
- ✅ Remove coupon codes
- ✅ View order summary (subtotal, discount, shipping, total)
- ✅ Navigate to checkout

**Test Cases:**
1. Empty cart → Should show "Your cart is empty" message
2. Cart with items → Should display all items with quantities and prices
3. Quantity update → Should update cart and recalculate totals
4. Item removal → Should remove item and update totals
5. Coupon application → Should apply discount and update totals
6. Coupon removal → Should remove discount and update totals

**Error Handling:**
- Network errors → Show error toast, allow retry
- Invalid coupon → Show error message
- Cart fetch failure → Show error, allow retry

### Step 2: Checkout Page (`/checkout`)
**Features to test:**
- ✅ Select shipping address
- ✅ Calculate shipping costs
- ✅ Select shipping method
- ✅ Calculate tax based on location
- ✅ View order summary with all costs
- ✅ Create order and redirect to payment

**Test Cases:**
1. No addresses → Should prompt to add address
2. Address selection → Should trigger shipping calculation
3. Shipping calculation → Should show available shipping options
4. Shipping method selection → Should update shipping cost
5. Tax calculation → Should calculate tax based on address
6. Order creation → Should create order and redirect to payment

**Error Handling:**
- No addresses → Show message with link to add address
- Shipping calculation failure → Set shipping cost to 0, allow proceeding
- Tax calculation failure → Set tax to 0, allow proceeding
- Order creation failure → Show error, allow retry
- Empty cart → Redirect to cart page

### Step 3: Payment Page (`/payment?orderId=...`)
**Features to test:**
- ✅ Load order details
- ✅ Display seller information
- ✅ Display order summary
- ✅ Fetch available payment providers
- ✅ Select payment provider
- ✅ Apply gift card (optional)
- ✅ Process payment
- ✅ Redirect to order confirmation

**Test Cases:**
1. Invalid order ID → Should show "Order Not Found" error
2. Order loading → Should display order details
3. Payment provider loading → Should fetch and display available providers
4. Provider selection → Should update selected provider
5. Gift card validation → Should validate and apply gift card
6. Gift card removal → Should remove gift card and recalculate total
7. Payment processing → Should create payment intent and process payment
8. Full gift card coverage → Should complete payment without payment provider
9. Partial gift card coverage → Should apply gift card and process remaining amount

**Error Handling:**
- Order not found → Show error with links to orders/products
- Payment provider fetch failure → Use default providers (stripe, klarna)
- Gift card validation failure → Show error, allow retry
- Payment intent creation failure → Show error, allow retry
- Payment confirmation failure → Show error, allow retry
- Network errors → Show error toast, allow retry

## Edge Cases to Test

### Cart Edge Cases
1. **Concurrent updates**: Multiple tabs updating cart simultaneously
2. **Expired items**: Items removed from cart due to stock changes
3. **Price changes**: Product prices changed after adding to cart
4. **Invalid quantities**: Negative or zero quantities
5. **Expired coupons**: Coupon expired between application and checkout

### Checkout Edge Cases
1. **No shipping options**: Address with no available shipping methods
2. **Tax calculation failure**: Tax service unavailable
3. **Address validation**: Invalid or incomplete address
4. **Cart changes**: Cart modified during checkout
5. **Session expiry**: User session expires during checkout

### Payment Edge Cases
1. **Order already paid**: Attempting to pay for already paid order
2. **Order cancelled**: Order cancelled between checkout and payment
3. **Insufficient gift card balance**: Gift card balance less than order total
4. **Payment provider unavailable**: Selected provider not available
5. **Partial payment failure**: Gift card applied but payment provider fails

## Error Messages

### User-Friendly Error Messages
- "Your cart is empty" → Redirect to products
- "Please select a shipping address" → Show address selection
- "Failed to load order details" → Show error with retry option
- "Payment processing failed" → Show error with contact support option
- "No payment methods available" → Show error with contact support option

### Technical Error Handling
- Network errors → Retry with exponential backoff
- Validation errors → Show specific field errors
- Server errors → Log to console, show generic user message
- Timeout errors → Show timeout message, allow retry

## Success Flows

### Complete Success Flow
1. User adds items to cart
2. User views cart, applies coupon
3. User proceeds to checkout
4. User selects address, shipping method
5. System calculates shipping and tax
6. User creates order
7. User selects payment provider
8. User optionally applies gift card
9. User processes payment
10. User redirected to order confirmation

### Gift Card Only Flow
1. User adds items to cart
2. User proceeds to checkout
3. User creates order
4. User applies gift card that covers full amount
5. Payment completes without payment provider
6. User redirected to order confirmation

## Testing Checklist

- [ ] Cart page loads correctly
- [ ] Cart items display correctly
- [ ] Quantity updates work
- [ ] Item removal works
- [ ] Coupon application works
- [ ] Coupon removal works
- [ ] Checkout page loads correctly
- [ ] Address selection works
- [ ] Shipping calculation works
- [ ] Tax calculation works
- [ ] Order creation works
- [ ] Payment page loads correctly
- [ ] Payment providers load correctly
- [ ] Provider selection works
- [ ] Gift card validation works
- [ ] Gift card application works
- [ ] Payment processing works
- [ ] Error handling works for all cases
- [ ] Loading states display correctly
- [ ] Success redirects work correctly

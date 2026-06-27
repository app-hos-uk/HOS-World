# Frontend Integration Guide

This guide outlines how to integrate the newly implemented backend features into the frontend application.

## Overview

The following features have been implemented and need frontend integration:

1. **Promotion & Discount Engine** - Coupon codes, discounts
2. **Shipping Rules Engine** - Shipping options and rates
3. **Multi-Source Inventory** - Stock availability
4. **Customer Groups** - Group-based features
5. **Return Policies** - Return policy display
6. **Item-Level Returns** - Partial returns
7. **Payment Provider Framework** - Multiple payment methods
8. **Tax Zones & Classes** - Tax calculation

---

## 1. Promotion & Discount Engine

### API Client Methods
```typescript
// Already added to apiClient:
apiClient.validateCoupon(couponCode: string)
apiClient.applyCoupon(cartId: string, couponCode: string)
apiClient.removeCoupon(cartId: string)
apiClient.getPromotions()
```

### Cart Page Integration

**File**: `apps/web/src/app/cart/page.tsx`

**Updates Needed**:
1. Add coupon code input field
2. Display applied discount
3. Show promotion messages
4. Update cart total to include discount

**Example Implementation**:
```typescript
const [couponCode, setCouponCode] = useState('');
const [applyingCoupon, setApplyingCoupon] = useState(false);

const handleApplyCoupon = async () => {
  try {
    setApplyingCoupon(true);
    const response = await apiClient.applyCoupon(cart.id, couponCode);
    if (response.data) {
      setCart(response.data);
      toast.success('Coupon applied successfully!');
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to apply coupon');
  } finally {
    setApplyingCoupon(false);
  }
};

// In JSX:
{cart.discount > 0 && (
  <div className="text-green-600">
    Discount: -{formatPrice(cart.discount)}
  </div>
)}
```

---

## 2. Shipping Rules Engine

### API Client Methods
```typescript
apiClient.getShippingOptions({
  cartItems: [...],
  cartValue: total,
  destination: { country, state, city, postalCode },
  sellerId?: string
})
```

### Checkout Page Integration

**File**: Create `apps/web/src/app/checkout/page.tsx` or update existing checkout

**Updates Needed**:
1. Add shipping address form
2. Fetch shipping options based on address
3. Display shipping options with rates
4. Allow user to select shipping method
5. Update order total with shipping cost

**Example Implementation**:
```typescript
const [shippingOptions, setShippingOptions] = useState<any[]>([]);
const [selectedShipping, setSelectedShipping] = useState<any>(null);

const fetchShippingOptions = async (address: Address) => {
  try {
    const response = await apiClient.getShippingOptions({
      cartItems: cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      })),
      cartValue: cart.total,
      destination: {
        country: address.country,
        state: address.state,
        city: address.city,
        postalCode: address.postalCode
      }
    });
    setShippingOptions(response.data || []);
  } catch (error) {
    console.error('Failed to fetch shipping options:', error);
  }
};
```

---

## 3. Multi-Source Inventory

### API Client Methods
```typescript
apiClient.getProductInventory(productId: string)
```

### Product Page Integration

**File**: `apps/web/src/app/products/[id]/page.tsx` (if exists) or product card component

**Updates Needed**:
1. Display stock availability
2. Show "In Stock" / "Low Stock" / "Out of Stock" badges
3. Disable "Add to Cart" when out of stock

**Example Implementation**:
```typescript
const [inventory, setInventory] = useState<any>(null);

useEffect(() => {
  const fetchInventory = async () => {
    try {
      const response = await apiClient.getProductInventory(product.id);
      setInventory(response.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };
  if (product.id) fetchInventory();
}, [product.id]);

// In JSX:
{inventory && (
  <div className="stock-status">
    {inventory.summary.totalAvailable > 0 ? (
      <span className="text-green-600">
        In Stock ({inventory.summary.totalAvailable} available)
      </span>
    ) : (
      <span className="text-red-600">Out of Stock</span>
    )}
  </div>
)}
```

---

## 4. Customer Groups

### API Client Methods
```typescript
apiClient.getMyCustomerGroup()
```

### User Profile/Dashboard Integration

**File**: `apps/web/src/app/dashboard/page.tsx` or user profile component

**Updates Needed**:
1. Display customer group badge
2. Show group-specific benefits (discounts, etc.)

**Example Implementation**:
```typescript
const [customerGroup, setCustomerGroup] = useState<any>(null);

useEffect(() => {
  const fetchGroup = async () => {
    try {
      const response = await apiClient.getMyCustomerGroup();
      setCustomerGroup(response.data);
    } catch (error) {
      console.error('Failed to fetch customer group:', error);
    }
  };
  fetchGroup();
}, []);

// In JSX:
{customerGroup && (
  <div className="customer-group-badge">
    <span>{customerGroup.name}</span>
    {customerGroup.discountPercentage > 0 && (
      <span>{customerGroup.discountPercentage}% Discount</span>
    )}
  </div>
)}
```

---

## 5. Return Policies

### API Client Methods
```typescript
apiClient.getReturnPolicies(sellerId?, productId?)
apiClient.evaluateReturnPolicy(orderId, productId?)
```

### Product & Order Pages Integration

**File**: Product detail page and order detail page

**Updates Needed**:
1. Display return policy information on product pages
2. Show return eligibility on order pages
3. Display return window information

**Example Implementation**:
```typescript
const [returnPolicy, setReturnPolicy] = useState<any>(null);

useEffect(() => {
  const fetchPolicy = async () => {
    try {
      const response = await apiClient.getReturnPolicies(
        product.sellerId,
        product.id
      );
      if (response.data && response.data.length > 0) {
        setReturnPolicy(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch return policy:', error);
    }
  };
  if (product.id) fetchPolicy();
}, [product.id]);

// In JSX:
{returnPolicy && (
  <div className="return-policy">
    <h3>Return Policy</h3>
    <p>{returnPolicy.returnWindowDays} day return window</p>
  </div>
)}
```

---

## 6. Item-Level Returns

### Returns Page Integration

**File**: Create `apps/web/src/app/returns/page.tsx` or update existing returns

**Updates Needed**:
1. Allow selecting individual order items for return
2. Support partial quantity returns
3. Item-specific return reasons

**Example Implementation**:
```typescript
const [selectedItems, setSelectedItems] = useState<Array<{
  orderItemId: string;
  quantity: number;
  reason?: string;
}>>([]);

const handleCreateReturn = async (orderId: string) => {
  try {
    const response = await apiClient.createReturn({
      orderId,
      reason: 'Defective items',
      items: selectedItems
    });
    toast.success('Return request created successfully');
  } catch (error: any) {
    toast.error(error.message || 'Failed to create return');
  }
};
```

---

## 7. Payment Provider Framework

### API Client Methods
```typescript
apiClient.getPaymentProviders()
apiClient.createPaymentIntent({ orderId, paymentMethod? })
apiClient.confirmPayment({ paymentIntentId, orderId })
```

### Payment Page Integration

**File**: `apps/web/src/app/payment/page.tsx`

**Updates Needed**:
1. Fetch available payment providers
2. Display provider selection (if multiple)
3. Update payment intent creation to use selected provider
4. Handle provider-specific payment flows

**Example Implementation**:
```typescript
const [providers, setProviders] = useState<string[]>([]);
const [selectedProvider, setSelectedProvider] = useState<string>('stripe');

useEffect(() => {
  const fetchProviders = async () => {
    try {
      const response = await apiClient.getPaymentProviders();
      setProviders(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedProvider(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch payment providers:', error);
    }
  };
  fetchProviders();
}, []);

const handleCreatePaymentIntent = async () => {
  try {
    const response = await apiClient.createPaymentIntent({
      orderId: order.id,
      paymentMethod: selectedProvider
    });
    // Handle payment intent (e.g., redirect to Stripe Checkout)
  } catch (error: any) {
    toast.error(error.message || 'Failed to create payment intent');
  }
};

// In JSX:
{providers.length > 1 && (
  <div className="payment-provider-selection">
    <label>Payment Method:</label>
    <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
      {providers.map(provider => (
        <option key={provider} value={provider}>
          {provider.charAt(0).toUpperCase() + provider.slice(1)}
        </option>
      ))}
    </select>
  </div>
)}
```

---

## 8. Tax Zones & Classes

### API Client Methods
```typescript
apiClient.calculateTax({
  amount: number,
  taxClassId: string,
  location: { country, state?, city?, postalCode? }
})
```

### Checkout Page Integration

**File**: Checkout page

**Updates Needed**:
1. Calculate tax based on shipping address
2. Display tax breakdown
3. Update order total with tax

**Example Implementation**:
```typescript
const [taxCalculation, setTaxCalculation] = useState<any>(null);

const calculateTaxForOrder = async (address: Address, items: CartItem[]) => {
  try {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Get tax class from product (assuming product has taxClassId)
    const taxClassId = items[0]?.product?.taxClassId || 'default';
    
    const response = await apiClient.calculateTax({
      amount: total,
      taxClassId,
      location: {
        country: address.country,
        state: address.state,
        city: address.city,
        postalCode: address.postalCode
      }
    });
    setTaxCalculation(response.data);
  } catch (error) {
    console.error('Failed to calculate tax:', error);
  }
};

// In JSX:
{taxCalculation && (
  <div className="tax-breakdown">
    <div>Subtotal: {formatPrice(taxCalculation.amount)}</div>
    <div>Tax ({taxCalculation.rate * 100}%): {formatPrice(taxCalculation.tax)}</div>
    <div>Total: {formatPrice(taxCalculation.total)}</div>
  </div>
)}
```

---

## Component Updates Checklist

### Cart Page (`apps/web/src/app/cart/page.tsx`)
- [ ] Add coupon code input field
- [ ] Display applied discount
- [ ] Show promotion messages
- [ ] Update cart total calculation

### Checkout Page (create or update)
- [ ] Add shipping address form
- [ ] Fetch and display shipping options
- [ ] Calculate and display tax
- [ ] Show final order summary

### Product Pages
- [ ] Display inventory availability
- [ ] Show return policy information
- [ ] Display tax class (if applicable)

### Payment Page (`apps/web/src/app/payment/page.tsx`)
- [ ] Fetch available payment providers
- [ ] Add provider selection UI
- [ ] Update payment intent creation

### Returns Page (create or update)
- [ ] Add item-level return selection
- [ ] Support partial quantity returns
- [ ] Item-specific return reasons

### User Dashboard/Profile
- [ ] Display customer group badge
- [ ] Show group benefits

---

## Testing Checklist

After implementing frontend integration:

1. **Cart & Promotions**
   - [ ] Apply coupon code
   - [ ] Remove coupon
   - [ ] Verify discount calculation
   - [ ] Test invalid coupon codes

2. **Shipping**
   - [ ] Select shipping address
   - [ ] View shipping options
   - [ ] Select shipping method
   - [ ] Verify shipping cost in total

3. **Inventory**
   - [ ] View stock availability
   - [ ] Test out-of-stock products
   - [ ] Verify low stock warnings

4. **Payment**
   - [ ] View available providers
   - [ ] Select payment method
   - [ ] Complete payment flow

5. **Tax**
   - [ ] Calculate tax for different locations
   - [ ] Verify tax-inclusive vs exclusive
   - [ ] Display tax breakdown

6. **Returns**
   - [ ] Create item-level return
   - [ ] Select partial quantities
   - [ ] View return policy

---

## Notes

- All API methods are already added to `packages/api-client/src/client.ts`
- Use `apiClient` from `@/lib/api` in components
- Handle loading and error states appropriately
- Use toast notifications for user feedback
- Test with different user roles (customer, seller, admin)

---

## Next Steps

1. Update cart page with coupon functionality
2. Create/update checkout page with shipping and tax
3. Add inventory display to product pages
4. Update payment page with provider selection
5. Create returns page with item-level support
6. Add customer group display to user profile
7. Test all integrations end-to-end

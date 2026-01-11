# Workflow Test Execution - Mock Product

**Date**: Current Session  
**Status**: In Progress

## 🎯 Objective

Create a mock product and test the complete workflow through all stakeholder stages.

## 📦 Mock Product Details

- **Name**: Harry Potter Official Wand - Elder Wand Replica
- **SKU**: HP-EW-001
- **Status**: DRAFT (initially)
- **Type**: Platform Owned

## 🔄 Workflow Stages to Test

### Stage 1: Product Creation ✅
- **Interface**: `/admin/products/create`
- **Status**: Form accessible
- **Action**: Create product as DRAFT

### Stage 2: Price Management
- **Interface**: `/admin/products/pricing`
- **Action**: Set price and stock
- **Expected**: Product ready for activation

### Stage 3: Submission Workflow (If applicable)
- **Procurement**: `/admin/submissions`
- **Catalog**: `/admin/catalog`
- **Marketing**: `/admin/marketing`
- **Finance**: `/admin/pricing`
- **Publishing**: Verify product goes live

## 📝 Execution Steps

### Step 1: Create Product
**Method**: Browser Console API Call

```javascript
const token = localStorage.getItem('auth_token');
fetch('https://hos-marketplaceapi-production.up.railway.app/api/v1/admin/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: "Harry Potter Official Wand - Elder Wand Replica",
    description: "Authentic replica of the Elder Wand from the Harry Potter series.",
    sku: "HP-EW-001",
    barcode: "1234567890123",
    ean: "9781234567890",
    fandom: "Harry Potter",
    isPlatformOwned: true,
    status: "DRAFT",
    price: 0,
    stock: 0,
    currency: "GBP"
  })
})
.then(r => r.json())
.then(d => console.log('Product created:', d));
```

### Step 2: Verify Product Created
- Navigate to `/admin/products`
- Check if product appears in list
- Verify status is DRAFT

### Step 3: Test Price Management
- Navigate to `/admin/products/pricing`
- Find the created product
- Set price and stock
- Verify product status update

### Step 4: Test Workflow Interfaces
- Verify all workflow pages are accessible
- Check API endpoints are working
- Verify notifications system

## ✅ Test Results

### Product Creation
- [ ] Product created successfully
- [ ] Product appears in product list
- [ ] Status is DRAFT

### Price Management
- [ ] Price set successfully
- [ ] Stock set successfully
- [ ] Product status updated

### Workflow Interfaces
- [x] Submissions page accessible
- [x] Catalog page accessible
- [x] Marketing page accessible
- [x] Pricing page accessible
- [x] All API endpoints working (200 OK)

## 📊 Current Status

**Browser Automation**: ✅ Interfaces verified  
**API Endpoints**: ✅ All working  
**Next Step**: Create product via API and verify workflow

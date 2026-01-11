# Business Flow Testing Plan

## Prerequisites
- **Test Credentials Required**: To test business flows, we need login credentials for the following roles:
  - ADMIN
  - SELLER / B2C_SELLER
  - PROCUREMENT
  - FINANCE
  - CUSTOMER

## Testing Scope (Starting from Product Creation as Requested)

### 1. Product Creation Flow ⭐ (Priority - As Requested)
**Starting Point**: Create a Product

**Roles to Test**:
- ADMIN
- PROCUREMENT
- CATALOG team

**Steps to Test**:
1. Navigate to `/admin/products/create`
2. Fill in product details:
   - Name, Description
   - Category, Tags, Attributes
   - Images (max 4, 250KB each) - verify image parameters display
   - Note: Price management should be separate (tested in Flow 2)
3. Submit product creation
4. Verify product is created
5. Check product appears in products list
6. Verify product status (should be DRAFT initially)

**Expected Issues to Check**:
- Image size validation (250KB limit)
- Maximum 4 images
- Image parameters display (size, dimensions, format, uploadedAt)
- Product creation/edit/update functionality
- Error handling

### 2. Price Management Flow
**Roles to Test**:
- FINANCE
- ADMIN

**Steps to Test**:
1. Navigate to `/admin/products/pricing`
2. Select product
3. Set price, stock, tax rate
4. Verify price updates
5. Check price displays correctly in product listing

**Expected Issues to Check**:
- Separation from product creation (should be separate interface)
- Taxation fields available in UI
- Price updates correctly

### 3. Product Management Flow
**Roles to Test**:
- ADMIN
- PROCUREMENT

**Steps to Test**:
1. Navigate to `/admin/products`
2. View all products (including DRAFT status)
3. For DRAFT products, verify actions available:
   - Edit
   - Approve
   - Delete
4. Test Edit functionality:
   - Open edit modal
   - Update product details
   - Save changes
5. Test Approve functionality:
   - Approve DRAFT product
   - Verify status changes to ACTIVE
6. Test Delete functionality:
   - Delete product
   - Confirm deletion
   - Verify product removed

**Expected Issues to Check**:
- Edit/update not working (as mentioned)
- Actions available for DRAFT products
- Product approval workflow

### 4. Logistics Partner Management Flow
**Roles to Test**:
- ADMIN
- LOGISTICS

**Steps to Test**:
1. Navigate to `/admin/logistics`
2. Create new logistics partner:
   - Name, Type
   - Website
   - Contact Info (nested structure)
   - Active status
3. Verify partner creation
4. Test partner listing
5. Test partner edit/update
6. Test partner deletion

**Expected Issues to Check**:
- Unable to create logistics partner (as mentioned)
- Contact info structure (nested object)
- DTO mismatch issues

### 5. Order Management Flow
**Roles to Test**:
- CUSTOMER
- SELLER
- ADMIN
- FULFILLMENT

**Steps to Test**:
1. **Customer Flow**:
   - Browse products
   - Add to cart
   - Proceed to checkout
   - Complete payment
   - View order status

2. **Seller/Admin Flow**:
   - View orders
   - Update order status
   - Process fulfillment
   - Generate shipping labels

**Expected Issues to Check**:
- Order creation
- Payment processing
- Order status updates
- Fulfillment workflow

### 6. Admin Dashboard Flow
**Roles to Test**:
- ADMIN

**Steps to Test**:
1. Navigate to `/admin/dashboard`
2. Test all admin functions:
   - User management
   - Product management
   - Order management
   - Reports (Sales, Users, Products)
   - Settings

**Expected Issues to Check**:
- Dashboard loading
- All admin functions accessible
- Reports generation
- Data accuracy

### 7. Authentication & Authorization Flow
**Roles to Test**:
- All roles

**Steps to Test**:
1. Login with each role
2. Verify correct dashboard redirect
3. Test role-based access control
4. Test session management
5. Test logout

**Expected Issues to Check**:
- Internal error issues in all user logins (as reported)
- JWT token issues
- Tenant context resolution
- Role-based access restrictions

## Test Execution Notes

### Current Status
- **Production URL**: https://hos-marketplaceweb-production.up.railway.app
- **Login Page**: Accessible, no console errors visible
- **Test Credentials**: Required to proceed with logged-in flows

### Known Issues to Verify
1. ✅ Product creation - edit/update not working
2. ✅ Price management separation (implemented)
3. ✅ Product image size limit (250KB, max 4 images) - implemented
4. ✅ Product image parameters display - implemented
5. ❓ Taxation not available in UI - needs verification
6. ✅ Unable to create logistics partner - fixed
7. ✅ Draft products actions (Edit, Approve, Delete) - implemented

### Next Steps
1. **Obtain test credentials** for all roles
2. **Execute test plan** systematically starting with Product Creation Flow
3. **Document all issues** found during testing
4. **Create bug reports** for any new issues discovered
5. **Verify fixes** for known issues

## Testing Checklist

### Product Creation Flow
- [ ] Navigate to product creation page
- [ ] Fill product form successfully
- [ ] Upload images (verify 250KB limit)
- [ ] Verify max 4 images
- [ ] Check image parameters display
- [ ] Submit product creation
- [ ] Verify product created
- [ ] Test edit functionality
- [ ] Test update functionality

### Price Management Flow
- [ ] Navigate to price management page
- [ ] Select product
- [ ] Update price
- [ ] Update stock
- [ ] Update tax rate
- [ ] Verify changes saved
- [ ] Verify UI shows taxation fields

### Product Management Flow
- [ ] View all products
- [ ] Filter draft products
- [ ] Edit draft product
- [ ] Approve draft product
- [ ] Delete product
- [ ] Verify all actions work

### Logistics Partner Flow
- [ ] Navigate to logistics page
- [ ] Create new partner
- [ ] Fill contact info correctly
- [ ] Submit partner creation
- [ ] Verify partner created
- [ ] Edit partner
- [ ] Delete partner

### Authentication Flow
- [ ] Login as ADMIN
- [ ] Login as SELLER
- [ ] Login as PROCUREMENT
- [ ] Login as FINANCE
- [ ] Login as CUSTOMER
- [ ] Verify correct redirects
- [ ] Check for internal errors
- [ ] Test logout

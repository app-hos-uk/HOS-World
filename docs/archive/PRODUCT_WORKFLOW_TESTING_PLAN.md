# Product Workflow Testing Plan

**Date**: Current Session  
**Objective**: Create product with mock data and verify stakeholder workflow communication

## 📝 Mock Product Data

```json
{
  "name": "Harry Potter Official Wand - Elder Wand Replica",
  "description": "Authentic replica of the Elder Wand from the Harry Potter series. Made from high-quality materials with intricate detailing. Perfect for collectors and fans.",
  "sku": "HP-EW-001",
  "barcode": "1234567890123",
  "ean": "9781234567890",
  "fandom": "Harry Potter",
  "isPlatformOwned": true,
  "categoryId": "", // Will select from available categories
  "tagIds": [], // Will select from available tags
  "attributes": [],
  "images": [] // Will upload via form
}
```

## 🔄 Workflow Testing Steps

### Step 1: Product Creation (Catalog Team)
**Interface**: `/admin/products/create`
**Action**: Create product as DRAFT
**Expected Result**: 
- Product created with status: DRAFT
- No price/stock set (handled separately)
- Ready for price management

### Step 2: Price Management (Finance Team)
**Interface**: `/admin/products/pricing`
**Action**: Set price and stock
**Expected Result**:
- Price set
- Stock set
- Product can be activated

### Step 3: Workflow Verification (Submission Path)

For **Product Submissions** (Seller → Platform workflow):

#### 3a. Procurement Review
**Interface**: `/admin/submissions` or Procurement Dashboard
**Status**: SUBMITTED → PROCUREMENT_APPROVED
**Actions**:
- Review submission
- Approve/reject
- Set quantity (for wholesalers)
**Notification**: Auto status update to Catalog

#### 3b. Catalog Team
**Interface**: `/admin/catalog`
**Status**: PROCUREMENT_APPROVED → CATALOG_COMPLETED
**Actions**:
- Create catalog entry
- Complete catalog entry
**Notification**: ✅ Sent to Marketing team via NotificationsService

#### 3c. Marketing Team
**Interface**: `/admin/marketing`
**Status**: CATALOG_COMPLETED → MARKETING_COMPLETED
**Actions**:
- Create marketing materials
- Complete marketing materials
**Notification**: ✅ Sent to Finance team via NotificationsService

#### 3d. Finance Team
**Interface**: `/admin/pricing` or `/admin/finance`
**Status**: MARKETING_COMPLETED → FINANCE_PENDING → FINANCE_APPROVED
**Actions**:
- Review pricing
- Set pricing and margins
- Approve/reject
**Notification**: Auto status update to Publishing

#### 3e. Publishing
**Interface**: `/admin/publishing` or Publishing service
**Status**: FINANCE_APPROVED → PUBLISHED
**Actions**:
- Publish product
- Product goes live

## 🔔 Stakeholder Communication Verification

### Notifications Implemented

1. **Catalog → Marketing** ✅
   - Location: `services/api/src/catalog/catalog.service.ts:268-274`
   - Service: `NotificationsService.sendNotificationToRole('MARKETING', ...)`
   - Trigger: When catalog entry is completed

2. **Marketing → Finance** ✅
   - Location: `services/api/src/marketing/marketing.service.ts:236-242`
   - Service: `NotificationsService.sendNotificationToRole('FINANCE', ...)`
   - Trigger: When marketing materials are completed

### Status Flow (Automatic)

1. **Procurement → Catalog**: Automatic status update
2. **Catalog → Marketing**: Status update + Notification ✅
3. **Marketing → Finance**: Status update + Notification ✅
4. **Finance → Publishing**: Automatic status update

## 📊 Testing Checklist

### Direct Product Creation (Catalog Team)
- [ ] Access `/admin/products/create`
- [ ] Fill form with mock data
- [ ] Upload images (max 4, 250KB each)
- [ ] Select category
- [ ] Select tags
- [ ] Submit form
- [ ] Verify product created as DRAFT
- [ ] Verify product appears in product list

### Price Management (Finance Team)
- [ ] Access `/admin/products/pricing`
- [ ] Find DRAFT product
- [ ] Set price and stock
- [ ] Verify product status update

### Submission Workflow (Full Path)
- [ ] View submissions at `/admin/submissions`
- [ ] Check Procurement dashboard
- [ ] Check Catalog dashboard (`/admin/catalog`)
- [ ] Check Marketing dashboard (`/admin/marketing`)
- [ ] Check Finance dashboard (`/admin/finance` or `/admin/pricing`)
- [ ] Verify notifications are sent
- [ ] Verify status transitions

## 🎯 Expected Workflow Communication

### Notification Flow
```
Seller Submission
    ↓
Procurement (Approve)
    ↓ (Status: PROCUREMENT_APPROVED)
Catalog Team (Complete Entry)
    ↓ (Status: CATALOG_COMPLETED)
    📧 Notification → Marketing Team ✅
Marketing Team (Complete Materials)
    ↓ (Status: MARKETING_COMPLETED)
    📧 Notification → Finance Team ✅
Finance Team (Approve Pricing)
    ↓ (Status: FINANCE_APPROVED)
Publishing (Publish)
    ↓ (Status: PUBLISHED)
Product Live
```

## 📝 Notes

- Direct product creation (`/admin/products/create`) creates products as DRAFT
- This is separate from the submission workflow
- Submission workflow is for seller-submitted products
- Both paths eventually require finance approval for pricing
- Notifications are implemented for Catalog→Marketing and Marketing→Finance transitions

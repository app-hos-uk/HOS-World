# Phase 1 & Phase 2 Comprehensive Test Plan

**Date**: 2025-01-XX  
**Status**: 🧪 **TESTING IN PROGRESS**

## Overview

This document outlines comprehensive testing for Phase 1 (Promotion Engine, Shipping Rules, API Versioning) and Phase 2 (Customer Groups, Return Policies, Payment Framework) features.

---

## Phase 1 Testing

### 1. Promotion Engine Testing

#### Backend API Tests
- [ ] Create promotion (percentage discount)
- [ ] Create promotion (fixed amount discount)
- [ ] Create promotion (free shipping)
- [ ] Create promotion (buy X get Y)
- [ ] Get all active promotions
- [ ] Get promotion by ID
- [ ] Update promotion
- [ ] Create coupon for promotion
- [ ] Validate coupon
- [ ] Apply coupon to cart
- [ ] Remove coupon from cart
- [ ] Record coupon usage
- [ ] Apply automatic promotions to cart
- [ ] Promotion priority handling
- [ ] Promotion date validation
- [ ] Promotion conditions (cart value, product IDs, category IDs)
- [ ] Stackable promotions

#### Frontend Integration Tests
- [ ] Cart page shows applied promotions
- [ ] Cart page shows discount breakdown
- [ ] Coupon code input and validation
- [ ] Coupon application success/error messages
- [ ] Coupon removal functionality
- [ ] Discount calculation accuracy
- [ ] Total calculation with promotions

#### E2E Tests
- [ ] Complete flow: Add product → Apply coupon → Checkout → Payment
- [ ] Multiple promotions stacking
- [ ] Promotion expiration handling
- [ ] Invalid coupon code handling

---

### 2. Shipping Rules Testing

#### Backend API Tests
- [ ] Create shipping method
- [ ] Get all shipping methods
- [ ] Get shipping method by ID
- [ ] Update shipping method
- [ ] Create shipping rule (flat rate)
- [ ] Create shipping rule (weight-based)
- [ ] Create shipping rule (value-based)
- [ ] Create shipping rule (per-item)
- [ ] Calculate shipping rate
- [ ] Get shipping options for checkout
- [ ] Shipping rule priority handling
- [ ] Free shipping threshold
- [ ] Shipping rule conditions (weight, cart value, location)
- [ ] Multiple shipping options

#### Frontend Integration Tests
- [ ] Checkout page shows shipping options
- [ ] Shipping rate calculation
- [ ] Free shipping display
- [ ] Shipping method selection
- [ ] Shipping cost in order total

#### E2E Tests
- [ ] Complete flow: Cart → Checkout → Select Shipping → Payment
- [ ] Shipping rate calculation for different destinations
- [ ] Free shipping threshold behavior
- [ ] Weight-based shipping calculation

---

### 3. API Versioning Testing

#### Backend API Tests
- [ ] Root endpoint returns version info
- [ ] `/api/v1` prefix works
- [ ] Legacy `/api` endpoints still work
- [ ] Version header support
- [ ] API documentation accessible

#### Frontend Integration Tests
- [ ] API client uses correct version
- [ ] All API calls work with versioned endpoints
- [ ] Error handling for version mismatches

---

## Phase 2 Testing

### 1. Customer Groups Testing

#### Backend API Tests
- [ ] Create customer group
- [ ] Get all customer groups
- [ ] Get customer group by ID
- [ ] Update customer group
- [ ] Add customer to group
- [ ] Remove customer from group
- [ ] Get my customer group
- [ ] Group type validation
- [ ] Active/inactive status
- [ ] Group-based pricing (if implemented)

#### Frontend Admin UI Tests
- [ ] View all customer groups
- [ ] Create new customer group
- [ ] Edit customer group
- [ ] Deactivate customer group
- [ ] Filter by active/inactive
- [ ] View customer count per group
- [ ] Form validation
- [ ] Error handling

#### E2E Tests
- [ ] Admin creates customer group
- [ ] Admin assigns user to group
- [ ] Customer sees their group
- [ ] Group-based pricing applied (if implemented)

---

### 2. Return Policies Testing

#### Backend API Tests
- [ ] Create platform-wide return policy
- [ ] Create seller-specific return policy
- [ ] Create product-specific return policy
- [ ] Create category-specific return policy
- [ ] Get all return policies
- [ ] Get return policy by ID
- [ ] Get applicable return policy for product
- [ ] Check return eligibility
- [ ] Update return policy
- [ ] Delete return policy
- [ ] Policy priority handling
- [ ] Return window validation
- [ ] Restocking fee calculation
- [ ] Refund method validation

#### Frontend Admin UI Tests
- [ ] View all return policies
- [ ] Create new return policy (all scopes)
- [ ] Edit return policy
- [ ] Delete return policy
- [ ] Scope validation (only one scope)
- [ ] Form validation
- [ ] Error handling

#### Frontend Customer UI Tests
- [ ] View return policy on product page (if implemented)
- [ ] Return eligibility check
- [ ] Return window display

---

### 3. Return Requests Testing

#### Backend API Tests
- [ ] Create return request (full order)
- [ ] Create return request (partial - specific items)
- [ ] Get all return requests
- [ ] Get return request by ID
- [ ] Update return status (seller/admin)
- [ ] Return eligibility validation
- [ ] Return window validation
- [ ] Refund processing
- [ ] Return authorization workflow

#### Frontend Customer UI Tests
- [ ] View orders eligible for return
- [ ] Create return request for full order
- [ ] Create return request for specific items
- [ ] View return request status
- [ ] View return history
- [ ] Return reason selection
- [ ] Additional notes field
- [ ] Status badges
- [ ] Refund amount display

#### E2E Tests
- [ ] Complete flow: Order → Return Request → Status Update → Refund
- [ ] Partial return workflow
- [ ] Return window expiration
- [ ] Return authorization workflow

---

### 4. Payment Framework Testing

#### Backend API Tests
- [ ] Get available payment providers
- [ ] Create payment intent (Stripe)
- [ ] Create payment intent (Klarna)
- [ ] Create payment intent (with gift card adjustment)
- [ ] Confirm payment (Stripe)
- [ ] Confirm payment (Klarna)
- [ ] Payment webhook handling
- [ ] Refund payment
- [ ] Payment amount validation
- [ ] Currency conversion

#### Frontend Payment UI Tests
- [ ] Load payment providers
- [ ] Select payment method
- [ ] Gift card application
- [ ] Gift card validation
- [ ] Gift card removal
- [ ] Payment amount calculation
- [ ] Payment button states
- [ ] Error handling
- [ ] Success/error toasts
- [ ] Redirect to payment provider
- [ ] Payment confirmation

#### E2E Tests
- [ ] Complete flow: Cart → Checkout → Payment → Order Confirmation
- [ ] Gift card redemption flow
- [ ] Multiple payment providers
- [ ] Payment failure handling
- [ ] Payment success handling

---

## Test Execution Plan

### Step 1: Backend API Tests
Run unit and integration tests for all Phase 1 and Phase 2 features.

### Step 2: Frontend Component Tests
Test all UI components manually and with Playwright.

### Step 3: E2E Workflow Tests
Test complete user journeys from start to finish.

### Step 4: Performance Tests
Test API response times and frontend rendering performance.

### Step 5: Error Handling Tests
Test error scenarios and edge cases.

---

## Test Scripts

See the following test files:
- `test-phase1-promotions.sh` - Promotion engine tests
- `test-phase1-shipping.sh` - Shipping rules tests
- `test-phase2-customer-groups.sh` - Customer groups tests
- `test-phase2-return-policies.sh` - Return policies tests
- `test-phase2-return-requests.sh` - Return requests tests
- `test-phase1-phase2-e2e.spec.ts` - Playwright E2E tests

---

## Success Criteria

### Phase 1
- ✅ All promotion types work correctly
- ✅ Shipping rules calculate correctly
- ✅ API versioning is functional
- ✅ Frontend integrates with all features
- ✅ No critical bugs

### Phase 2
- ✅ Customer groups CRUD works
- ✅ Return policies CRUD works
- ✅ Return requests workflow works
- ✅ Payment framework is functional
- ✅ Admin UIs are functional
- ✅ Customer UIs are functional
- ✅ No critical bugs

---

**Status**: 🧪 **READY FOR TESTING**

# Phase 1 & Phase 2 UI Features - Test Plan

## Overview
This document outlines the end-to-end testing plan for all implemented UI features.

## ✅ Pre-Test Checklist
- [x] TypeScript compilation successful
- [x] All endpoints verified and documented
- [x] API client methods implemented
- [ ] Backend services running
- [ ] Test user accounts created (CUSTOMER, ADMIN, SELLER)
- [ ] Test products created

---

## 1. Wishlist Feature

### Test Cases

#### 1.1 Wishlist Page (`/wishlist`)
- [ ] **TC-WL-001**: Access wishlist page as authenticated user
  - Expected: Page loads with user's wishlist items
- [ ] **TC-WL-002**: Access wishlist page as unauthenticated user
  - Expected: Redirected to login or access denied
- [ ] **TC-WL-003**: Empty wishlist display
  - Expected: Shows "Your wishlist is empty" message with link to products
- [ ] **TC-WL-004**: Display wishlist items
  - Expected: Shows product images, names, prices correctly
- [ ] **TC-WL-005**: Remove item from wishlist
  - Steps: Click remove button on wishlist item
  - Expected: Item removed, success toast shown, item disappears from list
- [ ] **TC-WL-006**: Move item to cart
  - Steps: Click "Add to Cart" on wishlist item
  - Expected: Item added to cart, removed from wishlist, success toast shown

#### 1.2 Product Detail Page - Wishlist Button
- [ ] **TC-WL-007**: Display wishlist button on product page
  - Expected: Heart icon button visible (🤍 when not in wishlist, ❤️ when in wishlist)
- [ ] **TC-WL-008**: Add product to wishlist
  - Steps: Click wishlist button on product page (not in wishlist)
  - Expected: Button changes to filled heart, success toast, product added to wishlist
- [ ] **TC-WL-009**: Remove product from wishlist
  - Steps: Click wishlist button on product page (already in wishlist)
  - Expected: Button changes to empty heart, success toast, product removed from wishlist
- [ ] **TC-WL-010**: Wishlist button for unauthenticated user
  - Expected: Clicking shows "Please login" error toast
- [ ] **TC-WL-011**: Check wishlist status on page load
  - Expected: Button shows correct state (filled/empty) based on wishlist status

#### 1.3 Header Navigation
- [ ] **TC-WL-012**: Wishlist link in header (desktop)
  - Expected: "❤️ Wishlist" link visible in navigation for authenticated users
- [ ] **TC-WL-013**: Wishlist link in header (mobile)
  - Expected: "❤️ Wishlist" link visible in mobile menu for authenticated users
- [ ] **TC-WL-014**: Navigate to wishlist from header
  - Expected: Clicking link navigates to `/wishlist`

---

## 2. Product Reviews Feature

### Test Cases

#### 2.1 Display Reviews on Product Page
- [ ] **TC-RV-001**: Display reviews section
  - Expected: "Customer Reviews" section visible on product detail page
- [ ] **TC-RV-002**: Show average rating
  - Expected: Star rating (★) displayed correctly based on averageRating
- [ ] **TC-RV-003**: Show review count
  - Expected: "(X reviews)" text displayed correctly
- [ ] **TC-RV-004**: Display existing reviews
  - Expected: Reviews shown with title, user email, rating stars, comment, date
- [ ] **TC-RV-005**: Empty reviews state
  - Expected: Shows "No reviews yet. Be the first to review this product!"
- [ ] **TC-RV-006**: Loading state
  - Expected: Shows spinner while loading reviews

#### 2.2 Write Review Form
- [ ] **TC-RV-007**: Show review form button
  - Expected: "Write a Review" button visible for authenticated users
- [ ] **TC-RV-008**: Toggle review form
  - Steps: Click "Write a Review" button
  - Expected: Review form appears/disappears
- [ ] **TC-RV-009**: Submit review (valid data)
  - Steps: Fill in rating (5 stars), title, comment, submit
  - Expected: Review submitted, success toast, form closes, reviews refresh
- [ ] **TC-RV-010**: Submit review (invalid data)
  - Steps: Try to submit without title or comment
  - Expected: Form validation prevents submission
- [ ] **TC-RV-011**: Submit review as unauthenticated user
  - Expected: Shows "Please login" error toast
- [ ] **TC-RV-012**: Rating selection
  - Steps: Click different star ratings
  - Expected: Selected rating updates correctly
- [ ] **TC-RV-013**: Cancel review form
  - Steps: Click cancel button
  - Expected: Form closes, form data cleared

---

## 3. Enhanced Cart Discount Display

### Test Cases

- [ ] **TC-CT-001**: Display discount amount
  - Expected: Shows discount in green text with coupon code if applied
- [ ] **TC-CT-002**: Display savings message
  - Expected: Green box showing "You saved £X with coupon CODE!" when discount > 0
- [ ] **TC-CT-003**: No discount state
  - Expected: Discount line and savings box not shown when discount = 0
- [ ] **TC-CT-004**: Total calculation
  - Expected: Total correctly calculated as subtotal - discount + shipping
- [ ] **TC-CT-005**: Currency formatting
  - Expected: All prices formatted correctly with currency symbol

---

## 4. Admin Promotions Management

### Test Cases

#### 4.1 Promotions List
- [ ] **TC-PM-001**: Access promotions page as ADMIN
  - Expected: Page loads with promotions list
- [ ] **TC-PM-002**: Access promotions page as non-admin
  - Expected: Access denied message
- [ ] **TC-PM-003**: Display promotions table
  - Expected: Shows name, type, value, status, dates, actions columns
- [ ] **TC-PM-004**: Empty promotions state
  - Expected: Shows "No promotions found" message
- [ ] **TC-PM-005**: Loading state
  - Expected: Shows spinner while loading promotions

#### 4.2 Create Promotion
- [ ] **TC-PM-006**: Open create modal
  - Steps: Click "Create Promotion" button
  - Expected: Modal opens with form
- [ ] **TC-PM-007**: Create percentage promotion
  - Steps: Fill form (name, type: PERCENTAGE, value: 10, dates), submit
  - Expected: Promotion created, modal closes, list refreshes, success toast
- [ ] **TC-PM-008**: Create fixed amount promotion
  - Steps: Fill form (name, type: FIXED, value: 5.00), submit
  - Expected: Promotion created successfully
- [ ] **TC-PM-009**: Create free shipping promotion
  - Steps: Fill form (name, type: FREE_SHIPPING), submit
  - Expected: Promotion created successfully
- [ ] **TC-PM-010**: Form validation
  - Steps: Try to submit without required fields
  - Expected: Form validation prevents submission
- [ ] **TC-PM-011**: Cancel create modal
  - Steps: Click cancel button
  - Expected: Modal closes, form data cleared

#### 4.3 Promotion Display
- [ ] **TC-PM-012**: Show promotion status badge
  - Expected: ACTIVE promotions show green badge, others show gray
- [ ] **TC-PM-013**: Display promotion type correctly
  - Expected: PERCENTAGE shows "10%", FIXED shows formatted price
- [ ] **TC-PM-014**: Display dates correctly
  - Expected: Start and end dates formatted correctly

---

## 5. Bulk Product Import/Export (Seller)

### Test Cases

#### 5.1 Export Products
- [ ] **TC-BK-001**: Access bulk page as SELLER
  - Expected: Page loads with export/import sections
- [ ] **TC-BK-002**: Export products to CSV
  - Steps: Click "Export Products to CSV" button
  - Expected: CSV file downloads with filename `products-export-YYYY-MM-DD.csv`
- [ ] **TC-BK-003**: CSV file format
  - Expected: CSV contains correct columns: name, price, description, stock, etc.
- [ ] **TC-BK-004**: Export loading state
  - Expected: Button shows "Exporting..." during export

#### 5.2 Import Products
- [ ] **TC-BK-005**: Select CSV file
  - Steps: Click file input, select valid CSV file
  - Expected: File selected and displayed
- [ ] **TC-BK-006**: Import valid CSV
  - Steps: Select valid CSV, click "Import Products"
  - Expected: Products imported, success toast, results displayed
- [ ] **TC-BK-007**: Import results display
  - Expected: Shows success count, error count, error messages if any
- [ ] **TC-BK-008**: Import invalid CSV
  - Steps: Select invalid CSV file
  - Expected: Error toast with appropriate message
- [ ] **TC-BK-009**: Import loading state
  - Expected: Button shows "Importing..." during import
- [ ] **TC-BK-010**: CSV format instructions
  - Expected: Instructions visible explaining CSV format requirements

---

## 6. Address Management (Profile)

### Test Cases

#### 6.1 Address Tab
- [ ] **TC-AD-001**: Access addresses tab
  - Steps: Navigate to profile page, click "Addresses" tab
  - Expected: Addresses tab content displayed
- [ ] **TC-AD-002**: Display saved addresses
  - Expected: Shows all user addresses with street, city, state, postal code, country
- [ ] **TC-AD-003**: Show default address badge
  - Expected: Default address shows "Default" badge
- [ ] **TC-AD-004**: Empty addresses state
  - Expected: Shows "No addresses saved" message when no addresses exist

#### 6.2 Add Address
- [ ] **TC-AD-005**: Open add address form
  - Steps: Click "+ Add Address" button
  - Expected: Address form appears
- [ ] **TC-AD-006**: Add address (all fields)
  - Steps: Fill street, city, state, postal code, country, submit
  - Expected: Address created, success toast, form closes, list refreshes
- [ ] **TC-AD-007**: Add address as default
  - Steps: Check "Set as default address", submit
  - Expected: Address created and set as default
- [ ] **TC-AD-008**: Form validation
  - Steps: Try to submit without required fields (street, city, postal code, country)
  - Expected: Form validation prevents submission

#### 6.3 Edit Address
- [ ] **TC-AD-009**: Edit address
  - Steps: Click "Edit" on an address
  - Expected: Form opens with address data pre-filled
- [ ] **TC-AD-010**: Update address
  - Steps: Modify address fields, submit
  - Expected: Address updated, success toast, list refreshes

#### 6.4 Delete Address
- [ ] **TC-AD-011**: Delete address
  - Steps: Click "Delete" on an address, confirm
  - Expected: Address deleted, success toast, removed from list
- [ ] **TC-AD-012**: Cancel delete
  - Steps: Click "Delete", cancel confirmation
  - Expected: Address not deleted, stays in list

#### 6.5 Set Default Address
- [ ] **TC-AD-013**: Set default address
  - Steps: Click "Set Default" on non-default address
  - Expected: Address set as default, previous default badge removed, success toast

---

## 7. File Upload Component

### Test Cases

- [ ] **TC-UP-001**: Display file upload component
  - Expected: Upload button/area visible
- [ ] **TC-UP-002**: Upload single image
  - Steps: Select image file (< 5MB), upload
  - Expected: File uploads, preview shown, success toast, onUploadComplete called
- [ ] **TC-UP-003**: Upload multiple images
  - Steps: Select multiple image files, upload
  - Expected: All files upload, previews shown, success toast
- [ ] **TC-UP-004**: File size validation
  - Steps: Try to upload file > maxSize (5MB default)
  - Expected: Error toast, upload prevented
- [ ] **TC-UP-005**: Image preview
  - Expected: Uploaded images show preview thumbnails
- [ ] **TC-UP-006**: Remove uploaded file
  - Steps: Click remove button on preview
  - Expected: Preview removed, file removed from list
- [ ] **TC-UP-007**: Upload loading state
  - Expected: Shows "Uploading..." during upload process
- [ ] **TC-UP-008**: Upload error handling
  - Steps: Simulate upload error (network issue, server error)
  - Expected: Error toast with appropriate message

---

## 8. Integration Tests

### Test Cases

- [ ] **TC-INT-001**: Complete purchase flow with address
  - Steps: Add product to cart, go to checkout, select saved address, complete order
  - Expected: Order completed successfully with saved address
- [ ] **TC-INT-002**: Wishlist to cart flow
  - Steps: Add product to wishlist, view wishlist, move to cart, checkout
  - Expected: Seamless flow from wishlist to purchase
- [ ] **TC-INT-003**: Review after purchase
  - Steps: Complete purchase, navigate to product, write review
  - Expected: Review submitted successfully
- [ ] **TC-INT-004**: Promotion application
  - Steps: Admin creates promotion, user applies coupon in cart
  - Expected: Discount applied correctly, savings message shown

---

## Testing Environment Setup

### Prerequisites
1. Backend API running on configured URL
2. Database seeded with test data
3. Test user accounts:
   - Customer: customer@test.com / password
   - Admin: admin@test.com / password
   - Seller: seller@test.com / password
4. Test products created (at least 3-5 products)
5. Test promotions created (if testing promotions feature)

### Test Data Requirements
- Products with images
- Products with existing reviews
- Products in wishlist
- Saved addresses
- Active promotions
- CSV file for bulk import testing

---

## Known Issues & Limitations

1. **Promotions Delete**: Backend DELETE endpoint not implemented
   - Status: Frontend delete button disabled, TODO comment added
   - Impact: Admins cannot delete promotions via UI
   
2. **Review Pagination**: Backend supports pagination, frontend may need pagination UI
   - Status: Backend ready, frontend shows all reviews
   - Impact: Large product pages may have many reviews displayed

3. **Wishlist Pagination**: Similar to reviews
   - Status: Backend ready, frontend shows all items
   - Impact: Users with many wishlist items may see performance issues

---

## Test Execution Notes

- Test in Chrome, Firefox, Safari, and mobile browsers
- Test with slow network conditions (3G throttling)
- Test with ad blockers enabled/disabled
- Test with browser extensions that may interfere
- Test error scenarios (network failures, server errors)
- Test accessibility (keyboard navigation, screen readers)

---

## Success Criteria

All critical test cases (TC-*-001 through TC-*-010 for each feature) must pass before considering features production-ready.

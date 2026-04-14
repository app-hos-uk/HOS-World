# HOS Marketplace — Manual QA Testing Document

> **Version:** 1.0
> **Date:** April 14, 2026
> **Environment:**
> - **Web:** https://hos-marketplaceweb-production.up.railway.app
> - **API:** https://hos-marketplaceapi-production.up.railway.app/api
> - **API Docs:** https://hos-marketplaceapi-production.up.railway.app/api/docs

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Journey 1 — Guest Browsing & Guest Cart](#2-journey-1--guest-browsing--guest-cart)
3. [Journey 2 — Registration & Login](#3-journey-2--registration--login)
4. [Journey 3 — Customer Purchase Flow](#4-journey-3--customer-purchase-flow)
5. [Journey 4 — Order Management & Returns](#5-journey-4--order-management--returns)
6. [Journey 5 — Customer Account Features](#6-journey-5--customer-account-features)
7. [Journey 6 — Gift Cards](#7-journey-6--gift-cards)
8. [Journey 7 — Digital Product Downloads](#8-journey-7--digital-product-downloads)
9. [Journey 8 — Seller Onboarding & Management](#9-journey-8--seller-onboarding--management)
10. [Journey 9 — Wholesaler Flow](#10-journey-9--wholesaler-flow)
11. [Journey 10 — Influencer Program](#11-journey-10--influencer-program)
12. [Journey 11 — Admin Panel](#12-journey-11--admin-panel)
13. [Journey 12 — Staff Portals](#13-journey-12--staff-portals)
14. [Journey 13 — CMS Content Management](#14-journey-13--cms-content-management)
15. [Journey 14 — Newsletter & Marketing](#15-journey-14--newsletter--marketing)
16. [Journey 15 — Support & Tickets](#16-journey-15--support--tickets)
17. [Journey 16 — Notifications & Communication](#17-journey-16--notifications--communication)
18. [Journey 17 — Multi-Currency & Geolocation](#18-journey-17--multi-currency--geolocation)
19. [Journey 18 — Seller Subdomains](#19-journey-18--seller-subdomains)
20. [Phase 2 — Known Gaps (Not in Scope)](#20-phase-2--known-gaps-not-in-scope)

---

## 1. Test Environment Setup

### Test Accounts Required

| Role | How to Create |
|------|---------------|
| **Customer** | Register via `/login` with role = customer |
| **B2C Seller** | Register via `/login` with role = b2c_seller, then complete `/seller/onboarding` |
| **Wholesaler** | Register via `/login` with role = wholesaler, then complete `/seller/onboarding` |
| **Influencer** | Created via admin invitation at `/admin/influencers/invitations` |
| **Admin** | Use existing admin account (app@houseofspells.co.uk or mail@jsabu.com) |
| **Staff roles** | Admin creates users via `/admin/users` and assigns roles |

### Browser Requirements
- Latest Chrome, Firefox, or Safari
- DevTools open (Console tab) to catch client-side errors
- Clear cookies/localStorage between role switches

### Stripe Test Cards (for payment testing)

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Declined |

Use any future expiry (e.g. `12/30`) and any 3-digit CVC.

---

## 2. Journey 1 — Guest Browsing & Guest Cart

**Objective:** Verify anonymous users can browse products and manage a cart before logging in.

### TC-1.1: Homepage & Navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/` | Homepage loads with hero banner, featured products, fandom sections |
| 2 | Click a fandom link | Navigates to `/fandoms/[slug]` with filtered products |
| 3 | Click "Products" in nav | Navigates to `/products` with full catalog |
| 4 | Use the search bar in the header | Search results appear (Meilisearch-powered) |
| 5 | Click a seller name on a product | Navigates to seller storefront `/sellers/[slug]` |

### TC-1.2: Product Detail (Guest)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click any product from listing | Product detail page loads at `/products/[id]` |
| 2 | Verify images, description, price, reviews display | All sections render without errors |
| 3 | Select a variant (if available) | Variant selection updates price/availability |
| 4 | Click "Add to Cart" | Item is added to cart (no login required) |
| 5 | Check cart icon in header | Badge shows item count (e.g. "1") |

### TC-1.3: Guest Cart Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open DevTools → Application → Local Storage | `hos_guest_cart_session` key exists with a UUID value |
| 2 | Navigate to `/cart` (or click cart icon) | Cart page shows the added item(s) |
| 3 | Change quantity of an item | Quantity updates, subtotal recalculates |
| 4 | Remove an item | Item is removed from cart |
| 5 | Add multiple products from different pages | All items appear in cart |
| 6 | Close browser tab, reopen the site | Cart persists (same localStorage session) |

### TC-1.4: Guest Cart → Login Merge

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As guest, add 2-3 items to cart | Items visible in guest cart |
| 2 | Navigate to `/login` and sign in as a customer | Login succeeds |
| 3 | Check cart after login | Guest cart items are merged into the authenticated cart |
| 4 | Check localStorage | `hos_guest_cart_session` key is removed |
| 5 | Verify no duplicate items if the user had an existing cart | Items are merged (quantities combined if same product) |

### TC-1.5: Guest Cart → OAuth Merge

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As guest, add items to cart | Items visible in guest cart |
| 2 | Click Google/Facebook/Apple login | OAuth flow completes |
| 3 | Check cart after OAuth callback | Guest cart items are merged into authenticated cart |

### TC-1.6: Guest Cart → Registration Merge

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As guest, add items to cart | Items visible |
| 2 | Register a new customer account | Registration succeeds |
| 3 | Check cart after registration | Guest items are in the new account's cart |

---

## 3. Journey 2 — Registration & Login

### TC-2.1: Email/Password Registration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login/registration page loads |
| 2 | Switch to registration mode | Registration form appears |
| 3 | Fill in: first name, last name, email, password, country | Form accepts input |
| 4 | Select role: Customer | Role selector works |
| 5 | Submit registration | Account created, redirects to customer dashboard |
| 6 | Check that JWT token is stored | `auth_token` exists in localStorage |

### TC-2.2: Email/Password Login

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login form displays |
| 2 | Enter valid credentials | Login succeeds, redirects to role-appropriate dashboard |
| 3 | Enter wrong password (5+ times) | Account lockout message after max attempts |
| 4 | Enter non-existent email | Error message: "Invalid credentials" (no user enumeration) |

### TC-2.3: OAuth Login — Google

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Continue with Google" on login page | Redirects to Google consent screen |
| 2 | Authorize the app | Redirects to `/auth/callback` with token |
| 3 | Verify login success | User is redirected to appropriate dashboard |
| 4 | Check `/profile` | Profile shows Google-linked email |

### TC-2.4: OAuth Login — Facebook

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Continue with Facebook" | Redirects to Facebook login |
| 2 | Authorize | Callback processes, login succeeds |
| 3 | Verify user profile populates | Name and email from Facebook appear |

### TC-2.5: OAuth Login — Apple

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Sign in with Apple" | Redirects to Apple ID login |
| 2 | Authorize | JWT is verified using JWKS; login succeeds |
| 3 | Verify `sub` claim validation | Profile created with Apple ID |

### TC-2.6: Password Reset

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Forgot password?" on login page | Navigates to forgot password form |
| 2 | Enter registered email | Success message: "If an account exists, a reset email was sent" |
| 3 | Enter non-existent email | Same success message (no enumeration) |
| 4 | Check email inbox | Reset email received with a link |
| 5 | Click the reset link | Navigates to `/auth/reset-password?token=...` |
| 6 | Enter new password (meeting complexity requirements) | Password updated, redirects to login |
| 7 | Login with new password | Login succeeds |
| 8 | Try the reset link again | Error: token expired or already used |

### TC-2.7: Seller Registration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Register with role = `b2c_seller` | Account created |
| 2 | Redirect to `/seller/onboarding` | Onboarding wizard loads |
| 3 | Verify a `Customer` profile was also created | API: `GET /api/users/profile` returns `customerProfile` |

### TC-2.8: Wholesaler Registration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Register with role = `wholesaler` | Account created |
| 2 | Fill in B2B fields: company name, VAT, business registration, business type | Fields accepted |
| 3 | Redirect to `/seller/onboarding` | Onboarding wizard loads with B2B section pre-filled |

---

## 4. Journey 3 — Customer Purchase Flow

### TC-3.1: Cart to Checkout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as customer, add products to cart | Cart populates |
| 2 | Navigate to `/cart` | Cart page shows all items with prices |
| 3 | Apply a coupon code | Discount applied, total updates |
| 4 | Apply an invalid coupon | Error message displayed |
| 5 | Click "Proceed to Checkout" | Navigates to `/checkout` |

### TC-3.2: Multi-Step Checkout — Step 1: Address

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Checkout page loads at step 1 | Progress indicator shows "1 Address" as active |
| 2 | If no addresses exist, "Add New Address" prompt shows | Address form appears |
| 3 | If addresses exist, select one | Address radio button highlights |
| 4 | Click "Continue" without selecting address | Error toast: "Please select a shipping address" |
| 5 | Select address, click "Continue" | Moves to step 2 |

### TC-3.3: Multi-Step Checkout — Step 2: Shipping

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Step 2 loads showing shipping options | Available shipping methods display with prices |
| 2 | Select a shipping method | Method highlights, shipping cost shown |
| 3 | Click "Continue" without selecting method | Error toast: "Please select a shipping method" |
| 4 | If no shipping options available | Message: "No shipping options required" with Continue button |
| 5 | Click "Back" | Returns to step 1 with address still selected |
| 6 | Click "Continue" | Moves to step 3 |

### TC-3.4: Multi-Step Checkout — Step 3: Review

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Step 3 shows all order items | Product names, quantities, prices listed |
| 2 | Stock issues are flagged if any | Warning badges on items with insufficient stock |
| 3 | Click "Continue to confirm" | Moves to step 4 |
| 4 | If critical stock issues exist | Error toast prevents advancing |

### TC-3.5: Multi-Step Checkout — Step 4: Confirm & Place Order

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Step 4 shows order summary (centered layout) | Subtotal, shipping, tax, total all displayed |
| 2 | "Back to review" button visible | Clicking it returns to step 3 |
| 3 | Click "Place Order" | Order is created, redirects to `/payment?orderId=...` |
| 4 | Double-click "Place Order" quickly | Only one order is created (ref guard prevents duplicates) |

### TC-3.6: Payment — Stripe Card

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Payment page loads with order summary | Order details, amount, and provider selection shown |
| 2 | Select "Credit/Debit Card (Stripe)" | Stripe provider selected |
| 3 | Click "Pay Now" to initiate payment intent | Stripe Elements card input appears |
| 4 | Verify Stripe Elements iframe loads | Card number, expiry, CVC fields render inside Stripe iframe |
| 5 | Enter test card `4242 4242 4242 4242`, `12/30`, `123` | Card accepted by Stripe |
| 6 | Click "Pay $XX.XX" | Payment processes, success toast, redirects to `/orders/[id]` |
| 7 | Enter declined card `4000 0000 0000 9995` | Error message: card declined |
| 8 | Verify no Stripe publishable key scenario | Amber banner shows asking to set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

### TC-3.7: Payment — Gift Card

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On payment page, enter a valid gift card code | Gift card balance applied to order |
| 2 | Enter invalid gift card code | Error: "Gift card not found or has no balance" |
| 3 | Gift card covers full amount | No additional payment method needed |
| 4 | Gift card partially covers amount | Remaining balance shown, card payment required for rest |

### TC-3.8: Payment Error Recovery

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After a payment failure, error message displays | Clear error text shown |
| 2 | Click "Try Different Payment Method" | Form resets, can choose new provider |
| 3 | Retry with valid card | Payment succeeds |

---

## 5. Journey 4 — Order Management & Returns

### TC-4.1: Customer Order History

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/orders` | List of all customer orders displays |
| 2 | Click an order | Order detail page at `/orders/[id]` loads |
| 3 | Verify order timeline | Status history with timestamps shown |
| 4 | Click "Reorder" on a past order | Items added to cart |

### TC-4.2: Order Tracking

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/track-order` | Tracking form displays |
| 2 | Enter a valid order number | Order status and tracking info shown |
| 3 | Enter invalid order number | Error: order not found |

### TC-4.3: Return Request

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From order detail, click "Request Return" | Return form appears |
| 2 | Select items and reason | Form validates |
| 3 | Submit return | Return request created, visible at `/returns` |
| 4 | Navigate to `/returns` | List of return requests shown |
| 5 | Click a return request | Detail page at `/returns/[id]` with status |

---

## 6. Journey 5 — Customer Account Features

### TC-5.1: Profile Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/profile` | Profile page loads with current info |
| 2 | Update first name, last name | Changes saved on submit |
| 3 | Navigate to `/profile/change-password` | Password change form loads |
| 4 | Enter current password + new password | Password updated |
| 5 | Enter wrong current password | Error: "Current password is incorrect" |
| 6 | Try change password for OAuth-only user (no password set) | Error: "Your account uses social login and has no password set" |

### TC-5.2: Wishlist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On a product detail page, click "Add to Wishlist" | Product added to wishlist |
| 2 | Navigate to `/wishlist` | Wishlisted products displayed |
| 3 | Click "Move to Cart" | Item removed from wishlist, added to cart |
| 4 | Click "Remove" on a wishlist item | Item removed |

### TC-5.3: Collections

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/collections` | User's collections listed |
| 2 | Click "Create Collection" | Form at `/collections/new` |
| 3 | Enter name, add products | Collection created |
| 4 | View collection detail | Products in collection displayed |

### TC-5.4: Notifications

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click notification bell in header | Notification dropdown appears |
| 2 | Navigate to `/notifications` | Full notification list with read/unread status |
| 3 | Mark a notification as read | Visual indicator updates |

---

## 7. Journey 6 — Gift Cards

### TC-6.1: Gift Card Catalog

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/gift-cards` | Gift card listing page loads |
| 2 | Navigate to `/gift-cards/purchase` | Purchase form with amount buttons |
| 3 | Verify amounts are fetched from API | Amounts match `GET /api/gift-cards/catalog` response |
| 4 | If API is unavailable | Default amounts (25, 50, 100, 250, 500) shown |

### TC-6.2: Gift Card Purchase

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select an amount (e.g. $50) | Amount highlights, form updates |
| 2 | Enter custom amount (if allowed) | Custom field accepts input |
| 3 | Fill in recipient email, sender name, message | Fields validate |
| 4 | Submit purchase | Confirmation dialog appears |
| 5 | Confirm purchase | Gift card created, code displayed |

### TC-6.3: Gift Card Redemption

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/gift-cards` | "Redeem" option available |
| 2 | Enter a valid gift card code | Balance added to account |
| 3 | Enter an already-redeemed code | Error message |
| 4 | Enter invalid code | Error: code not found |

---

## 8. Journey 7 — Digital Product Downloads

### TC-7.1: View Digital Purchases

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Purchase a product tagged as "digital" | Order completes |
| 2 | Navigate to `/downloads` | Digital product listed with download status |
| 3 | Verify status shows "available" | Download count and max downloads shown |

### TC-7.2: Download Digital Product

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Download" on a digital product | `POST /api/digital-products/:id/download` called |
| 2 | Download count increments | Remaining downloads decreases by 1 |
| 3 | File download initiates | Redirect to signed URL, file downloads |
| 4 | Repeat until max downloads reached | Status changes to "limit_reached", download blocked |
| 5 | After expiry period (365 days) | Status changes to "expired" |

---

## 9. Journey 8 — Seller Onboarding & Management

### TC-8.1: Seller Onboarding

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Register as B2C Seller | Redirected to `/seller/onboarding` |
| 2 | Step 1 — Store Info: enter store name, description | Fields validate (store name required) |
| 3 | Upload store logo (optional) | Image uploads or skipped |
| 4 | Click "Continue" | Moves to location step |
| 5 | Step 2 — Location: select country/region | Location saved |
| 6 | Step 3 — Theme: select storefront theme | Theme preview shows |
| 7 | Complete onboarding | Redirected to seller dashboard |

### TC-8.2: Seller Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/seller/dashboard` | Dashboard with sales stats, recent orders |
| 2 | Verify KPI cards load | Revenue, orders, products counts shown |

### TC-8.3: Product Submission

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/seller/submit-product` | Product submission form loads |
| 2 | Fill in name, description, price, category | Fields validate |
| 3 | Upload product images | Images preview |
| 4 | Submit for approval | Product enters "PENDING" status |
| 5 | Navigate to `/seller/submissions` | Submitted product visible |

### TC-8.4: Seller Order Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/seller/orders` | Orders for this seller listed |
| 2 | Click an order | Order detail with items, customer, status |
| 3 | Accept an order | Status updates to accepted |
| 4 | Reject an order with reason | Status updates to rejected |

### TC-8.5: Bulk Product Import

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/seller/products/bulk` | Bulk import page loads |
| 2 | Download template | Excel/CSV template downloads |
| 3 | Upload filled template | Products imported, results shown |
| 4 | Upload malformed file | Error report with line-by-line issues |

### TC-8.6: Seller Themes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/seller/themes` | Theme selection page loads |
| 2 | Select a theme | Preview updates |
| 3 | Save theme | Storefront reflects new theme |
| 4 | Visit `/sellers/[slug]` | Theme applied to public storefront |

---

## 10. Journey 9 — Wholesaler Flow

### TC-9.1: Wholesaler Onboarding

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Register as wholesaler | Account created |
| 2 | Navigate to `/wholesaler/onboarding` | Redirects to `/seller/onboarding` with B2B message |
| 3 | On seller onboarding step 1, B2B section appears | Company name (required), VAT, business reg #, business type fields shown |
| 4 | Leave company name empty, click Continue | Error toast: "Company name is required for wholesaler accounts" |
| 5 | Fill company name and other B2B fields | Fields save via `PUT /api/users/profile` |
| 6 | Complete remaining onboarding steps | Onboarding finished |

### TC-9.2: Wholesaler Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/wholesaler/dashboard` | Dashboard loads for wholesaler role |
| 2 | Navigate to `/wholesaler/products` | Product listing for this wholesaler |
| 3 | Navigate to `/wholesaler/orders` | Orders for this wholesaler |
| 4 | Navigate to `/wholesaler/bulk` | Bulk import page |

---

## 11. Journey 10 — Influencer Program

### TC-10.1: Influencer Invitation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin creates invitation at `/admin/influencers/invitations` | Invitation created with token |
| 2 | Invitee clicks invitation link `/influencer-invite/[token]` | Registration page with pre-filled info |
| 3 | Complete registration | Account created with INFLUENCER role |
| 4 | Guest cart merges after signup | Any guest cart items transfer |

### TC-10.2: Influencer Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/influencer/dashboard` | Dashboard with earnings summary |
| 2 | Navigate to `/influencer/earnings` | Detailed commission and payout history |

### TC-10.3: Product Links

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/influencer/product-links` | Existing links listed |
| 2 | Create a new product link | Link generated with custom slug |
| 3 | Verify link URL format | URL uses `/i/[customSlug]` format |
| 4 | Visit the generated link in incognito | Redirects to product page with referral tracking |
| 5 | Delete a product link | Link removed from list |

### TC-10.4: Influencer Storefront

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/influencer/storefront` | Storefront curation page |
| 2 | Add/remove products from storefront | Products update |
| 3 | Visit public storefront `/i/[slug]` | Public page shows curated products |

### TC-10.5: Referral Commission (Campaign Filtering)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin creates a campaign with specific product/category IDs | Campaign saved |
| 2 | Customer uses influencer referral link and purchases | Order placed |
| 3 | Only eligible items (matching campaign product/category IDs) generate commission | Commission calculated on filtered items only |
| 4 | Non-matching items in same order | No commission on those items |

---

## 12. Journey 11 — Admin Panel

### TC-11.1: Admin Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin | Redirected to `/admin/dashboard` |
| 2 | Verify KPI cards | Platform-wide metrics load (users, orders, revenue) |
| 3 | Verify charts | Sales charts render without errors |

### TC-11.2: User Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/users` | User list with search and filters |
| 2 | Click a user | User detail with profile, role, activity |
| 3 | Change user role | Role updated |
| 4 | Navigate to `/admin/activity` | Activity log with timestamps |
| 5 | Navigate to `/admin/permissions` | Custom role/permission management |
| 6 | Navigate to `/admin/privacy-audit` | GDPR audit records |

### TC-11.3: Order Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/orders` | All platform orders listed |
| 2 | Click an order | Full detail with items, customer, seller, status |
| 3 | Update order status | Status changes, timeline updates |
| 4 | Navigate to `/admin/shipments` | Shipment tracking list |
| 5 | Navigate to `/admin/discrepancies` | Order discrepancy reports |

### TC-11.4: Product & Catalog Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/products` | Product list with filters |
| 2 | Click "Create Product" | Form at `/admin/products/create` |
| 3 | Navigate to `/admin/categories` | Category tree management |
| 4 | Navigate to `/admin/attributes` | Attribute CRUD |
| 5 | Navigate to `/admin/tags` | Tag management |
| 6 | Navigate to `/admin/reviews` | Review moderation |
| 7 | Navigate to `/admin/submissions` | Product approval queue |
| 8 | Navigate to `/admin/vendor-products` | Vendor product oversight |

### TC-11.5: Seller Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/sellers` | Seller list with status |
| 2 | Navigate to `/admin/seller-applications` | Pending applications |
| 3 | Approve/reject a seller application | Status updates |
| 4 | Navigate to `/admin/seller-analytics` | Seller performance metrics |

### TC-11.6: Influencer Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/influencers` | Influencer list |
| 2 | Click an influencer | Detail at `/admin/influencers/[id]` |
| 3 | Navigate to `/admin/influencers/campaigns` | Campaign management |
| 4 | Navigate to `/admin/influencers/commissions` | Commission records |
| 5 | Navigate to `/admin/influencers/payouts` | Payout management |
| 6 | Navigate to `/admin/influencers/invitations` | Create/manage invitations |

### TC-11.7: Finance & Pricing

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/finance` | Finance overview |
| 2 | Navigate to `/admin/pricing` | Pricing rules |
| 3 | Navigate to `/admin/promotions` | Coupon/promotion CRUD |
| 4 | Navigate to `/admin/settlements` | Settlement records |
| 5 | Navigate to `/admin/tax-zones` | Tax zone configuration |

### TC-11.8: Logistics & Inventory

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/fulfillment-centers` | Center list |
| 2 | Navigate to `/admin/warehouses` | Warehouse management |
| 3 | Navigate to `/admin/warehouses/transfers` | Transfer management |
| 4 | Navigate to `/admin/inventory` | Inventory levels |
| 5 | Navigate to `/admin/logistics` | Logistics overview |

### TC-11.9: Admin System Settings

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/settings` | General settings page |
| 2 | Navigate to `/admin/settings/integrations` | Integration catalog |
| 3 | Configure a shipping integration | Settings saved |
| 4 | Configure a tax integration | Settings saved |
| 5 | Navigate to `/admin/webhooks` | Webhook management |
| 6 | Navigate to `/admin/domains` | Custom domain configuration |
| 7 | Navigate to `/admin/search` | Meilisearch index management |
| 8 | Navigate to `/admin/themes` | Platform theme management |

### TC-11.10: Reports

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/reports` | Report overview |
| 2 | Navigate to `/admin/reports/sales` | Sales report with filters and charts |
| 3 | Navigate to `/admin/reports/users` | User analytics |
| 4 | Navigate to `/admin/reports/products` | Product performance |
| 5 | Navigate to `/admin/reports/inventory` | Inventory report |
| 6 | Navigate to `/admin/reports/platform` | Platform-wide metrics |
| 7 | Export a report | Excel file downloads |

### TC-11.11: Role Switching

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use RoleSwitcher component | Admin can view platform as any role |
| 2 | Switch to CUSTOMER | Dashboard and nav change to customer view |
| 3 | Switch back to ADMIN | Full admin access restored |

---

## 13. Journey 12 — Staff Portals

### TC-12.1: Procurement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as PROCUREMENT user | Redirected to `/procurement/dashboard` |
| 2 | View dashboard | Procurement KPIs shown |
| 3 | Navigate to `/procurement/submissions` | Product submissions to review |
| 4 | Approve/reject a submission | Status updates |

### TC-12.2: Fulfillment

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as FULFILLMENT user | Dashboard at `/fulfillment/dashboard` |
| 2 | Navigate to `/fulfillment/centers` | Fulfillment center list |
| 3 | Navigate to `/fulfillment/shipments` | Shipment list |
| 4 | Click a shipment | Detail at `/fulfillment/shipments/[id]` |
| 5 | Update shipment status | Status changes |

### TC-12.3: Catalog

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as CATALOG user | Dashboard at `/catalog/dashboard` |
| 2 | Navigate to `/catalog/entries` | Catalog entry management |

### TC-12.4: Marketing

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as MARKETING user | Dashboard at `/marketing/dashboard` |
| 2 | Navigate to `/marketing/campaigns` | Campaign list |
| 3 | Navigate to `/marketing/materials` | Marketing materials |

### TC-12.5: Finance

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as FINANCE user | Dashboard at `/finance/dashboard` |
| 2 | Navigate to `/finance/pricing` | Pricing management |
| 3 | Navigate to `/finance/payouts` | Payout records |
| 4 | Navigate to `/finance/reports/fees` | Fee report |
| 5 | Navigate to `/finance/reports/revenue` | Revenue report |

---

## 14. Journey 13 — CMS Content Management

### TC-13.1: CMS Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as CMS_EDITOR | Dashboard at `/cms/dashboard` |
| 2 | Verify dashboard loads | Content stats shown |

### TC-13.2: Page Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/cms/pages` | Page list from Strapi |
| 2 | Create a new page | Page editor loads |
| 3 | Edit and save | Changes saved to Strapi |
| 4 | Delete a page | Page removed |

### TC-13.3: Banner Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/cms/banners` | Banner list |
| 2 | Create/edit a banner | Banner form works |
| 3 | Verify banner appears on homepage | Homepage hero section updates |

### TC-13.4: Blog Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/cms/blog` | Blog post list |
| 2 | Create a new blog post | Editor loads |
| 3 | Publish a post | Status changes to published |

### TC-13.5: Media Library

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/cms/media` | Media file list from Strapi uploads |
| 2 | Verify files load from `GET /api/cms/media` | Images/files listed |
| 3 | Delete a media file | File removed from Strapi |

---

## 15. Journey 14 — Newsletter & Marketing

### TC-14.1: Newsletter Subscription (Public)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find newsletter signup on homepage/footer | Email input field visible |
| 2 | Enter email and subscribe | Success: "Subscribed successfully" |
| 3 | Subscribe same email again | Handled gracefully (already subscribed) |
| 4 | Check status via `GET /api/newsletter/status?email=...` | Returns subscription status |

### TC-14.2: Newsletter Unsubscribe

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `POST /api/newsletter/unsubscribe` with email | Subscription removed |
| 2 | Verify status changes to unsubscribed | Status confirms |

### TC-14.3: Newsletter Campaign (Admin/Marketing)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as ADMIN or MARKETING user | Access granted |
| 2 | Navigate to `/admin/newsletter` | Newsletter management page |
| 3 | View subscriber list | Subscribers loaded from `GET /api/newsletter/subscriptions` |
| 4 | Send a campaign via `POST /api/newsletter/campaigns/send` | Emails queued to all active subscribers |
| 5 | Verify optional tag filtering | Only matching subscribers receive email when tagKey/tagValue set |

---

## 16. Journey 15 — Support & Tickets

### TC-15.1: Knowledge Base (Public)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/support/kb` | Knowledge base articles listed |
| 2 | Click an article | Article detail at `/support/kb/[slug]` |

### TC-15.2: Create Support Ticket

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/support/new` | Ticket creation form |
| 2 | Fill in subject, description, category | Fields validate |
| 3 | Submit (must be logged in) | Ticket created |
| 4 | Navigate to `/support/tickets` | Ticket visible in list |

### TC-15.3: Ticket Messaging

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click a ticket at `/support/tickets/[id]` | Ticket detail with message thread |
| 2 | Add a reply | Message appears in thread |
| 3 | Admin responds from `/admin/support` | Customer sees admin reply |

---

## 17. Journey 16 — Notifications & Communication

### TC-16.1: In-App Notifications

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger a notification (e.g. place an order) | Notification bell shows indicator |
| 2 | Click bell icon | Notification dropdown with message |
| 3 | Navigate to `/notifications` | Full notification history |

### TC-16.2: Email Notifications

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Register a new account | Welcome email received (check SMTP logs) |
| 2 | Place an order | Order confirmation email sent |
| 3 | Request password reset | Reset email received |

---

## 18. Journey 17 — Multi-Currency & Geolocation

### TC-17.1: Currency Selection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find currency selector in header | Dropdown with USD, EUR, GBP, AED, etc. |
| 2 | Change currency to EUR | All prices on page update to EUR |
| 3 | Add item to cart | Cart prices in selected currency |
| 4 | Navigate through checkout | Consistent currency throughout |

### TC-17.2: Geolocation Detection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First visit (no preference set) | Currency auto-detected based on IP geolocation |
| 2 | Override by selecting different currency | Override persists across sessions |

---

## 19. Journey 18 — Seller Subdomains

### TC-18.1: Subdomain Routing

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Visit `{seller-slug}.houseofspells.com` | Seller storefront loads |
| 2 | Verify URL stays as subdomain | Browser shows subdomain URL, not `/sellers/[slug]` |
| 3 | Browse products on subdomain | Products filtered to this seller |
| 4 | Add to cart from subdomain | Cart works normally |
| 5 | Checkout from subdomain | Standard checkout flow |

### TC-18.2: Local Development Subdomains

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Visit `{slug}.localhost:3000` | Seller storefront loads locally |
| 2 | Main domain `localhost:3000` shows homepage | No subdomain rewrite |

---

## 20. Phase 2 — Known Gaps (Not in Scope)

The following features are documented in the comprehensive overview but are **not yet implemented** or are **incomplete**. These are explicitly **out of scope** for this QA cycle and will be addressed in Phase 2.

### P2-1: Mobile App

**Status:** Scaffolding only (Expo + React Native project structure exists but no functional screens).

**What's missing:**
- No app screens beyond placeholder welcome page
- No navigation stack
- No API integration
- No push notifications
- Not submitted to App Store or Google Play

### P2-2: Loyalty Points System

**Status:** Schema and service exist but not wired end-to-end.

**What's missing:**
- Points are **never awarded automatically** on order completion — `awardPoints()` exists in `gamification.service.ts` but is not called from `orders.service.ts`
- No **redemption flow** at checkout (cannot spend points to reduce order total)
- Two separate `loyaltyPoints` fields on `User` and `Customer` models are **not unified** — only `User.loyaltyPoints` is updated by the gamification service
- No points display on customer dashboard tied to real purchase activity

### P2-3: Seller Subscription Billing

**Status:** Schema fields exist on the `Seller` model but are informational only.

**What's missing:**
- No **Stripe Billing** integration (no recurring charges, no subscription creation)
- No **plan enforcement** (e.g. product limits by tier, feature gating)
- No subscription lifecycle management (upgrade, downgrade, cancel, expiry enforcement)
- Admin can manually update `subscriptionPlan`, `monthlySubscriptionFee`, `subscriptionExpiresAt` but there's no automated billing

### P2-4: Gamification — Quests & Leaderboard

**Status:** Models exist in Prisma schema but service layer is incomplete.

**What's missing:**
- **Quests:** `Quest` and `UserQuest` tables exist but there are no service methods to track quest progress, mark completion, or award rewards
- **Leaderboard:** `getLeaderboard` accepts `timeframe` and `category` filter parameters but the Prisma query **ignores them** — always returns the same global ranking
- The gamification points system and loyalty points system are two separate, unconnected systems

---

*End of QA Testing Document — Version 1.0*

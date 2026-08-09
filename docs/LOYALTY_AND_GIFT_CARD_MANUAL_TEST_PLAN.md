# Loyalty & Gift Card — Manual Test Plan

**Audience:** QA / Manual Testers
**Last updated:** August 2026

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Loyalty — Enrolment Tests](#2-loyalty--enrolment-tests)
3. [Loyalty — Earn Points Tests](#3-loyalty--earn-points-tests)
4. [Loyalty — Redemption Tests](#4-loyalty--redemption-tests)
5. [Loyalty — Tier Tests](#5-loyalty--tier-tests)
6. [Loyalty — Points Expiry Tests](#6-loyalty--points-expiry-tests)
7. [Loyalty — Referral Tests](#7-loyalty--referral-tests)
8. [Loyalty — POS Voucher Tests](#8-loyalty--pos-voucher-tests)
9. [Loyalty — Admin Tests](#9-loyalty--admin-tests)
10. [Gift Card — Creation Tests](#10-gift-card--creation-tests)
11. [Gift Card — Redemption Tests](#11-gift-card--redemption-tests)
12. [Gift Card — Refund Tests](#12-gift-card--refund-tests)
13. [Gift Card — Admin Tests](#13-gift-card--admin-tests)
14. [Integration Tests](#14-integration-tests)
15. [Edge Cases & Negative Tests](#15-edge-cases--negative-tests)
16. [API Endpoint Tests](#16-api-endpoint-tests)

---

## 1. Test Environment Setup

### Pre-conditions

- [ ] Staging environment is deployed and accessible
- [ ] Database is seeded with default loyalty tiers, earn rules, and redemption options
- [ ] Feature flags enabled: `LOYALTY_PROGRAMME`, `POS_INTEGRATION` (if testing POS)
- [ ] Environment variables set:
  - `LOYALTY_ENABLED=true`
  - `LOYALTY_REDEMPTION_AT_CHECKOUT=true`
  - `LOYALTY_POS_VOUCHER_ENABLED=true` (for POS tests)
  - `NEXT_PUBLIC_LOYALTY_ENABLED=true`
- [ ] Test user accounts created:
  - `tester-customer@test.com` — standard customer
  - `tester-admin@test.com` — admin user
  - `tester-newuser@test.com` — fresh user (not enrolled)
- [ ] At least one vendor with products in `ACTIVE` status
- [ ] Stripe test mode configured for payment tests

### Test Data

| Data | Value |
|------|-------|
| Default earn rate | 1 pt/$1 |
| Minimum redemption | 100 points |
| Point value | $0.01 |
| Gift card test code format | `XXXX-XXXX-XXXX-XXXX` |

---

## 2. Loyalty — Enrolment Tests

### TC-L-001: Customer self-enrolment

| Field | Detail |
|-------|--------|
| **Pre-condition** | Logged in as customer, NOT enrolled in loyalty |
| **Steps** | 1. Navigate to `/loyalty` <br> 2. Click "Join The Enchanted Circle" / enrol button <br> 3. Confirm enrolment |
| **Expected** | - Membership created at "Initiate" tier <br> - Balance shows 100 points (signup bonus) <br> - Transaction ledger shows `EARN` entry with source `SIGNUP` <br> - Loyalty dashboard renders with tier info |
| **Pass** | [ ] |

### TC-L-002: Auto-enrolment on first purchase

| Field | Detail |
|-------|--------|
| **Pre-condition** | Logged in as customer, NOT enrolled |
| **Steps** | 1. Add product to cart <br> 2. Complete checkout and pay <br> 3. Navigate to `/loyalty` |
| **Expected** | - Membership auto-created <br> - Purchase points awarded <br> - Signup bonus (100 pts) also awarded |
| **Pass** | [ ] |

### TC-L-003: Prevent duplicate enrolment

| Field | Detail |
|-------|--------|
| **Pre-condition** | Already enrolled |
| **Steps** | 1. Call `POST /loyalty/enroll` again |
| **Expected** | - Returns existing membership (no error) <br> - No duplicate signup bonus |
| **Pass** | [ ] |

### TC-L-004: Unenrolled user cannot redeem

| Field | Detail |
|-------|--------|
| **Pre-condition** | Not enrolled |
| **Steps** | 1. Attempt `POST /loyalty/redeem` |
| **Expected** | - Error returned (membership not found or insufficient points) |
| **Pass** | [ ] |

---

## 3. Loyalty — Earn Points Tests

### TC-L-010: Purchase earn — standard rate

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer, Initiate tier (1.0× multiplier) |
| **Steps** | 1. Add $50 worth of products to cart <br> 2. Complete checkout and pay <br> 3. Check loyalty balance |
| **Expected** | - 50 points earned <br> - Transaction shows `EARN`, source `PURCHASE`, channel `WEB` |
| **Pass** | [ ] |

### TC-L-011: Purchase earn — tier multiplier

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer at "Dragon Keeper" tier (2.0× multiplier). Admin adjust points to reach threshold if needed. |
| **Steps** | 1. Place $50 order <br> 2. Check points earned |
| **Expected** | - 100 points earned (50 base × 2.0 multiplier) |
| **Pass** | [ ] |

### TC-L-012: Purchase earn — vendor with custom earn rate

| Field | Detail |
|-------|--------|
| **Pre-condition** | Vendor has `loyaltyEarnRate = 2` (2 pts per $1) |
| **Steps** | 1. Purchase $30 product from that vendor <br> 2. Check points |
| **Expected** | - 60 points earned (30 × 2) before tier multiplier |
| **Pass** | [ ] |

### TC-L-013: Purchase earn — vendor with loyalty disabled

| Field | Detail |
|-------|--------|
| **Pre-condition** | Vendor has `loyaltyEnabled = false` |
| **Steps** | 1. Purchase product from that vendor <br> 2. Check points |
| **Expected** | - 0 points earned for that line item |
| **Pass** | [ ] |

### TC-L-014: Profile completion bonus

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled, profile incomplete |
| **Steps** | 1. Navigate to profile settings <br> 2. Fill in all required fields (name, phone, address, DOB) <br> 3. Save |
| **Expected** | - 50 points credited <br> - Transaction shows `EARN`, source `PROFILE_COMPLETE` <br> - Bonus awarded only once |
| **Pass** | [ ] |

### TC-L-015: Review earn — text review

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled, has a completed order |
| **Steps** | 1. Navigate to order/product <br> 2. Submit a text-only review |
| **Expected** | - 25 points earned (REVIEW) |
| **Pass** | [ ] |

### TC-L-016: Review earn — photo review

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled |
| **Steps** | 1. Submit a review with photo attachment |
| **Expected** | - 50 points earned (PHOTO_REVIEW) |
| **Pass** | [ ] |

### TC-L-017: Review earn — rate limit (max 3/month)

| Field | Detail |
|-------|--------|
| **Pre-condition** | Already submitted 3 reviews this month |
| **Steps** | 1. Submit a 4th review |
| **Expected** | - Review is saved but 0 bonus points awarded <br> - No error for the review itself |
| **Pass** | [ ] |

### TC-L-018: Social share earn

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled |
| **Steps** | 1. Trigger social share event (via share button on product page) |
| **Expected** | - 10 points earned <br> - Max 5 per day respected |
| **Pass** | [ ] |

### TC-L-019: Check-in earn

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled |
| **Steps** | 1. Call `POST /loyalty/check-in` |
| **Expected** | - 15 points earned <br> - Second call same day returns 0 or error |
| **Pass** | [ ] |

### TC-L-020: Bonus campaign earn multiplier

| Field | Detail |
|-------|--------|
| **Pre-condition** | Active bonus campaign with 2.0× multiplier |
| **Steps** | 1. Place $20 order (Initiate tier, 1.0×) <br> 2. Check points |
| **Expected** | - 40 points earned (20 base × 2.0 campaign) <br> - Transaction references campaign |
| **Pass** | [ ] |

---

## 4. Loyalty — Redemption Tests

### TC-L-030: Redeem discount at checkout

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled, 500+ points balance, items in cart |
| **Steps** | 1. Proceed to checkout <br> 2. See loyalty widget <br> 3. Select "$5 Discount" (500 pts) <br> 4. Verify order total reduced by $5 <br> 5. Complete payment |
| **Expected** | - Points deducted: 500 <br> - Order total reduced by $5 <br> - Order record shows `loyaltyPointsRedeemed=500`, `loyaltyDiscountAmount=5` <br> - Transaction shows `BURN`, channel `MARKETPLACE_CHECKOUT` |
| **Pass** | [ ] |

### TC-L-031: Remove loyalty reward at checkout

| Field | Detail |
|-------|--------|
| **Pre-condition** | Loyalty reward already applied to cart |
| **Steps** | 1. Click "Remove" on the loyalty widget <br> 2. Verify order total returns to original |
| **Expected** | - Points restored to balance <br> - Cart `pendingLoyaltyPoints` cleared <br> - Order total back to original |
| **Pass** | [ ] |

### TC-L-032: Redeem free shipping

| Field | Detail |
|-------|--------|
| **Pre-condition** | 200+ points, order with shipping charge |
| **Steps** | 1. At checkout, select "Free Shipping Upgrade" (200 pts) <br> 2. Verify shipping cost removed |
| **Expected** | - 200 points deducted <br> - Shipping charge = $0 |
| **Pass** | [ ] |

### TC-L-033: Insufficient points — redemption blocked

| Field | Detail |
|-------|--------|
| **Pre-condition** | Less than 100 points balance |
| **Steps** | 1. Proceed to checkout <br> 2. Check loyalty widget |
| **Expected** | - Widget hidden or shows "insufficient points" message <br> - No redemption options available |
| **Pass** | [ ] |

### TC-L-034: Redeem from rewards catalogue

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled, sufficient points |
| **Steps** | 1. Navigate to `/loyalty/rewards` <br> 2. Select a DISCOUNT reward <br> 3. Confirm redemption |
| **Expected** | - Points deducted <br> - Coupon code generated (`HOS-LYL-XXXXX`) <br> - Coupon valid for 30 days |
| **Pass** | [ ] |

### TC-L-035: Redeem below minimum threshold

| Field | Detail |
|-------|--------|
| **Pre-condition** | 50 points (below 100 minimum) |
| **Steps** | 1. Attempt to redeem any option |
| **Expected** | - Blocked with "minimum 100 points" message |
| **Pass** | [ ] |

### TC-L-036: Reward coupon actually works at checkout

| Field | Detail |
|-------|--------|
| **Pre-condition** | A DISCOUNT redemption option with Value set (e.g. $5), member holds enough points |
| **Steps** | 1. Redeem the reward and copy the `HOS-LYL-…` code <br> 2. Add items to cart and apply the code as a coupon <br> 3. Complete the order <br> 4. Try the same code on a second order |
| **Expected** | - $5 comes off the first order <br> - A `Promotion` + `Coupon` pair exists for the code <br> - Second use is rejected (one use only) |
| **Pass** | [ ] |

### TC-L-037: DISCOUNT reward with no Value is refused

| Field | Detail |
|-------|--------|
| **Pre-condition** | A DISCOUNT option saved with an empty Value |
| **Steps** | 1. Attempt to redeem it |
| **Expected** | - Redemption fails with a configuration message <br> - **No points are deducted** and no code is returned |
| **Pass** | [ ] |

### TC-L-038: Retried redemption does not burn twice

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled with enough points |
| **Steps** | 1. `POST /loyalty/redeem` with an `idempotencyKey` <br> 2. Send the exact same request again |
| **Expected** | - Same `redemptionId` and coupon code returned <br> - Points deducted once only |
| **Pass** | [ ] |

---

## 5. Loyalty — Tier Tests

### TC-L-040: Tier upgrade on review

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer at Initiate with 950 totalPointsEarned |
| **Steps** | 1. Earn 50+ more points (e.g., profile complete bonus) <br> 2. Wait for tier review (or trigger manually) |
| **Expected** | - Tier upgrades to Spellcaster (threshold: 1,000) <br> - Multiplier becomes 1.25× |
| **Pass** | [ ] |

### TC-L-041: Tier multiplier applied to next purchase

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer at Spellcaster (1.25×) |
| **Steps** | 1. Place $100 order |
| **Expected** | - 125 points earned (100 × 1.25) |
| **Pass** | [ ] |

### TC-L-042: Tier progress display

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer |
| **Steps** | 1. Navigate to `/loyalty` <br> 2. Check tier progress bar |
| **Expected** | - Current tier displayed <br> - Progress bar shows % toward next tier <br> - Next tier threshold visible |
| **Pass** | [ ] |

### TC-L-043: Invite-only tier not auto-assigned

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer with 20,000+ totalPointsEarned |
| **Steps** | 1. Trigger tier review |
| **Expected** | - Remains at Archmage Circle (15,000 threshold) <br> - Does NOT auto-promote to Council of Realms (invite-only) |
| **Pass** | [ ] |

---

## 6. Loyalty — Points Expiry Tests

### TC-L-050: Points expire after 24 months

| Field | Detail |
|-------|--------|
| **Pre-condition** | Transaction older than 24 months with `expiresAt = null`. (Requires DB manipulation or time-travel in test.) |
| **Steps** | 1. Trigger expiry cron job |
| **Expected** | - EXPIRE transaction created <br> - Balance reduced <br> - Original earn tx marked with `expiresAt` |
| **Pass** | [ ] |

### TC-L-051: Expiry skipped if insufficient balance

| Field | Detail |
|-------|--------|
| **Pre-condition** | Old earn of 500pts, current balance = 100 (already spent most) |
| **Steps** | 1. Trigger expiry job |
| **Expected** | - Only 100pts expired (capped at current balance) or skipped if implementation requires full balance |
| **Pass** | [ ] |

### TC-L-052: Expiry disabled when set to 0

| Field | Detail |
|-------|--------|
| **Pre-condition** | `LOYALTY_POINTS_EXPIRY_MONTHS=0` |
| **Steps** | 1. Trigger expiry job |
| **Expected** | - Job exits early, no expirations processed |
| **Pass** | [ ] |

---

## 7. Loyalty — Referral Tests

### TC-L-060: Generate referral code

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer |
| **Steps** | 1. Navigate to `/loyalty/referral` <br> 2. Click "Generate Referral Code" |
| **Expected** | - Unique referral code created <br> - Share URL displayed |
| **Pass** | [ ] |

### TC-L-061: Referral conversion — both parties earn

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer A has referral code |
| **Steps** | 1. New user B visits referral URL <br> 2. User B registers <br> 3. User B makes first purchase |
| **Expected** | - User B gets 200 points (REFERRAL_REFEREE) <br> - User A gets 500 points (REFERRAL_REFERRER) <br> - Referral record created with conversion status |
| **Pass** | [ ] |

### TC-L-062: Self-referral blocked

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer uses their own referral code |
| **Steps** | 1. Visit own referral URL <br> 2. Attempt to register/purchase |
| **Expected** | - No referral bonus awarded to self |
| **Pass** | [ ] |

---

## 8. Loyalty — POS Voucher Tests

### TC-L-070: Redeem points for POS voucher

| Field | Detail |
|-------|--------|
| **Pre-condition** | Staff auth, customer with 500+ points, `LOYALTY_POS_VOUCHER_ENABLED=true` |
| **Steps** | 1. `POST /loyalty/lookup` with customer email <br> 2. `POST /loyalty/pos/redeem-for-voucher` with amount=5 (500 pts) <br> 3. Check Lightspeed for new gift card |
| **Expected** | - 500 points deducted <br> - POS voucher status = `ISSUED` <br> - Lightspeed gift card created with $5 balance <br> - Metrics counter `loyalty_pos_voucher_issued_total` incremented |
| **Pass** | [ ] |

### TC-L-071: POS voucher — amount below minimum

| Field | Detail |
|-------|--------|
| **Pre-condition** | Attempt voucher for $0.50 (below $1 min) |
| **Steps** | 1. `POST /loyalty/pos/redeem-for-voucher` with amount=0.5 |
| **Expected** | - Rejected with validation error |
| **Pass** | [ ] |

### TC-L-072: POS voucher — amount above maximum

| Field | Detail |
|-------|--------|
| **Pre-condition** | Attempt voucher for $600 (above $500 max) |
| **Steps** | 1. `POST /loyalty/pos/redeem-for-voucher` with amount=600 |
| **Expected** | - Rejected with validation error |
| **Pass** | [ ] |

### TC-L-073: POS voucher — Lightspeed failure rollback

| Field | Detail |
|-------|--------|
| **Pre-condition** | Lightspeed API unavailable / returns error |
| **Steps** | 1. Attempt POS voucher creation |
| **Expected** | - Points are reversed (restored to balance) <br> - Voucher status = `FAILED` <br> - Metrics counter `loyalty_pos_voucher_failed_total` incremented |
| **Pass** | [ ] |

### TC-L-074: POS voucher — idempotency

| Field | Detail |
|-------|--------|
| **Pre-condition** | Use same idempotency key for two requests |
| **Steps** | 1. `POST /loyalty/pos/redeem-for-voucher` with key=ABC <br> 2. Repeat same call with key=ABC |
| **Expected** | - Second call returns the same voucher (no duplicate) <br> - Points only deducted once |
| **Pass** | [ ] |

---

## 9. Loyalty — Admin Tests

### TC-L-080: Admin adjust points (add)

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. Admin > Loyalty > Members <br> 2. Find test customer <br> 3. Adjust: +200 points, reason "Goodwill" |
| **Expected** | - Balance increases by 200 <br> - ADJUST transaction logged with reason |
| **Pass** | [ ] |

### TC-L-081: Admin adjust points (deduct)

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer has 300+ points |
| **Steps** | 1. Adjust: -100 points, reason "Correction" |
| **Expected** | - Balance decreases by 100 <br> - ADJUST transaction logged <br> - Lifetime earned points also drop by 100 |
| **Pass** | [ ] |

### TC-L-081b: Deduction that drops the member below their tier

| Field | Detail |
|-------|--------|
| **Pre-condition** | Member just above a tier threshold (e.g. Spellcaster at 1,050 lifetime points, threshold 1,000) |
| **Steps** | 1. Adjust: -100 points, reason "Over-award correction" |
| **Expected** | - Lifetime earned points become 950 <br> - Member is moved back to the lower tier <br> - Their multiplier reverts on the next order |
| **Pass** | [ ] |

### TC-L-082: Admin edit earn rule

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. Admin > Loyalty > Earn Rules <br> 2. Edit PURCHASE rule: change points to 2 <br> 3. Save <br> 4. Place test order |
| **Expected** | - New orders earn 2 pts/$1 <br> - Old orders unaffected |
| **Pass** | [ ] |

### TC-L-083: Admin disable earn rule

| Field | Detail |
|-------|--------|
| **Pre-condition** | REVIEW earn rule active |
| **Steps** | 1. Edit REVIEW rule → uncheck Is Active <br> 2. Submit a review |
| **Expected** | - Review saved normally <br> - 0 bonus points awarded |
| **Pass** | [ ] |

### TC-L-084: Admin edit tier thresholds

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin |
| **Steps** | 1. Admin > Loyalty > Tiers <br> 2. Change Spellcaster threshold from 1,000 to 800 <br> 3. Trigger tier review |
| **Expected** | - Members with 800-999 points now qualify for Spellcaster |
| **Pass** | [ ] |

### TC-L-085: Admin create bonus campaign

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin |
| **Steps** | 1. Admin > Loyalty > Campaigns > Add Campaign <br> 2. Set: name="Test 2x", multiplier=2.0, dates=today to tomorrow <br> 3. Place test order |
| **Expected** | - Campaign appears in list <br> - Orders during campaign period earn 2× base |
| **Pass** | [ ] |

### TC-L-086: Admin view transactions ledger

| Field | Detail |
|-------|--------|
| **Pre-condition** | Transactions exist |
| **Steps** | 1. Admin > Loyalty > Transactions <br> 2. Filter by type, date, member |
| **Expected** | - Transactions display correctly <br> - Filters work <br> - Types shown: EARN, BURN, EXPIRE, ADJUST, BONUS |
| **Pass** | [ ] |

---

## 10. Gift Card — Creation Tests

### TC-GC-001: Admin creates digital gift card

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. Admin > Gift Cards <br> 2. Issue New Card: amount=$50, type=digital, recipient="Test User", email="test@test.com" <br> 3. Save |
| **Expected** | - Card created with status `ACTIVE` <br> - Code in `XXXX-XXXX-XXXX-XXXX` format <br> - Balance = $50 <br> - PURCHASE transaction recorded |
| **Pass** | [ ] |

### TC-GC-002: Admin creates physical gift card

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. Issue New Card: amount=$100, type=physical |
| **Expected** | - Card created with type=`physical`, status=`ACTIVE`, balance=$100 |
| **Pass** | [ ] |

### TC-GC-003: Gift card code uniqueness

| Field | Detail |
|-------|--------|
| **Pre-condition** | Multiple gift cards |
| **Steps** | 1. Create 10 gift cards in succession |
| **Expected** | - All codes are unique <br> - No I, O, 0, 1 characters in codes |
| **Pass** | [ ] |

### TC-GC-004: Gift card catalogue endpoint

| Field | Detail |
|-------|--------|
| **Steps** | 1. `GET /gift-cards/catalog` |
| **Expected** | - Returns denominations: [25, 50, 100, 250, 500] <br> - Publicly accessible (no auth) |
| **Pass** | [ ] |

---

## 11. Gift Card — Redemption Tests

### TC-GC-010: Full redemption at checkout

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with $50 balance, order total = $30 |
| **Steps** | 1. Add items to cart (total $30) <br> 2. Proceed to checkout, then payment <br> 3. Enter gift card code <br> 4. Apply |
| **Expected** | - $30 deducted from gift card <br> - Remaining balance = $20 <br> - Order marked paid (gift card covers full amount) <br> - No Stripe charge |
| **Pass** | [ ] |

### TC-GC-011: Partial redemption + Stripe

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with $20 balance, order total = $50 |
| **Steps** | 1. Apply gift card <br> 2. Pay remaining $30 via Stripe |
| **Expected** | - Gift card balance = $0, status = `REDEEMED` <br> - Stripe charges $30 <br> - Order marked paid |
| **Pass** | [ ] |

### TC-GC-012: Invalid gift card code

| Field | Detail |
|-------|--------|
| **Steps** | 1. Enter fake code "AAAA-BBBB-CCCC-DDDD" at payment |
| **Expected** | - Error: "Invalid gift card code" <br> - No balance change |
| **Pass** | [ ] |

### TC-GC-013: Expired gift card

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with `expiresAt` in the past |
| **Steps** | 1. Enter expired card code at payment |
| **Expected** | - Rejected: card expired |
| **Pass** | [ ] |

### TC-GC-014: Fully redeemed gift card

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with balance = $0 |
| **Steps** | 1. Enter code at payment |
| **Expected** | - Rejected: no remaining balance |
| **Pass** | [ ] |

### TC-GC-015: Gift card validation endpoint

| Field | Detail |
|-------|--------|
| **Steps** | 1. `GET /gift-cards/validate/XXXX-XXXX-XXXX-XXXX` (valid code) |
| **Expected** | - Returns `{ valid: true, currency, expiresAt }` <br> - Does NOT expose balance (security) |
| **Pass** | [ ] |

### TC-GC-016: Validation endpoint — rate limit

| Field | Detail |
|-------|--------|
| **Steps** | 1. Call `GET /gift-cards/validate/:code` 6 times in 1 minute |
| **Expected** | - 6th call returns 429 Too Many Requests |
| **Pass** | [ ] |

### TC-GC-017: Gift card assigned to specific user

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card already assigned to User A |
| **Steps** | 1. User B attempts to redeem the same code |
| **Expected** | - Rejected: card belongs to another user |
| **Pass** | [ ] |

### TC-GC-018: First use assigns card to user

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with no `userId` assigned |
| **Steps** | 1. Logged-in user redeems the card |
| **Expected** | - Card's `userId` set to current user <br> - Redemption succeeds |
| **Pass** | [ ] |

---

## 12. Gift Card — Refund Tests

### TC-GC-020: Order cancellation restores gift card balance

| Field | Detail |
|-------|--------|
| **Pre-condition** | Order paid with gift card ($30 redeemed) |
| **Steps** | 1. Cancel the order (admin or customer) |
| **Expected** | - Gift card balance restored by $30 <br> - REFUND transaction created <br> - Card status back to `ACTIVE` if was `REDEEMED` |
| **Pass** | [ ] |

### TC-GC-021: Admin manual refund

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with redemption history |
| **Steps** | 1. Admin > Gift Cards > select card <br> 2. Click Refund <br> 3. Confirm |
| **Expected** | - Balance restored (up to original amount) <br> - REFUND transaction logged |
| **Pass** | [ ] |

### TC-GC-022: Refund cannot exceed original amount

| Field | Detail |
|-------|--------|
| **Pre-condition** | $50 card, fully refunded once already |
| **Steps** | 1. Attempt another refund |
| **Expected** | - Rejected: balance already at original amount |
| **Pass** | [ ] |

---

## 13. Gift Card — Admin Tests

### TC-GC-030: Admin lists all gift cards

| Field | Detail |
|-------|--------|
| **Steps** | 1. Admin > Gift Cards <br> 2. Verify list loads <br> 3. Filter by status (ACTIVE, REDEEMED, EXPIRED) <br> 4. Filter by type (digital, physical) |
| **Expected** | - Cards listed with code (partially masked), balance, status <br> - Filters work correctly |
| **Pass** | [ ] |

### TC-GC-031: Admin views gift card transactions

| Field | Detail |
|-------|--------|
| **Steps** | 1. Click on a gift card in admin list <br> 2. View transaction history |
| **Expected** | - All transactions shown: PURCHASE, REDEMPTION, REFUND <br> - Each shows amount, balanceAfter, date |
| **Pass** | [ ] |

### TC-GC-032: Customer views own gift cards

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer with gift cards |
| **Steps** | 1. Navigate to `/gift-cards` |
| **Expected** | - Own cards listed with masked codes <br> - Balance visible for each card |
| **Pass** | [ ] |

### TC-GC-033: Customer views gift card detail

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to `/gift-cards/[id]` |
| **Expected** | - Full code shown <br> - Balance, status, recent transactions visible |
| **Pass** | [ ] |

---

## 14. Integration Tests

### TC-INT-001: Loyalty + Gift Card combined at checkout

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer with 500 loyalty points + $20 gift card, order = $40 |
| **Steps** | 1. At checkout, apply $5 loyalty discount (500 pts) <br> 2. At payment, apply gift card <br> 3. Pay remaining via Stripe |
| **Expected** | - Loyalty burns 500 pts, order reduced to $35 <br> - Gift card covers $20, customer pays $15 via Stripe <br> - Order shows both `loyaltyDiscountAmount=5` and gift card redemption <br> - Customer earns purchase points on original pre-discount amount |
| **Pass** | [ ] |

### TC-INT-002: Loyalty earn after gift card full coverage

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card covers entire order (no Stripe charge) |
| **Steps** | 1. Pay fully with gift card <br> 2. Check loyalty points earned |
| **Expected** | - Order marked as paid <br> - Loyalty points earned on the order total (before gift card) |
| **Pass** | [ ] |

### TC-INT-003: POS sale import triggers loyalty earn

| Field | Detail |
|-------|--------|
| **Pre-condition** | POS integration enabled, customer enrolled |
| **Steps** | 1. Create a sale in Lightspeed POS for an enrolled customer <br> 2. Wait for POS import job <br> 3. Check loyalty balance |
| **Expected** | - Points earned based on POS sale amount <br> - Transaction shows channel `HOS_OUTLET_POS` |
| **Pass** | [ ] |

### TC-INT-004: POS sale void claws back points

| Field | Detail |
|-------|--------|
| **Pre-condition** | POS sale already imported and points earned |
| **Steps** | 1. Void the sale in Lightspeed <br> 2. Wait for next POS import |
| **Expected** | - ADJUST transaction (negative) created <br> - Balance reduced by previously earned points |
| **Pass** | [ ] |

### TC-INT-005: POS gift card reconciliation

| Field | Detail |
|-------|--------|
| **Pre-condition** | POS voucher issued via loyalty |
| **Steps** | 1. Wait for recon job (or trigger manually) <br> 2. Check recon results |
| **Expected** | - Voucher matched in Lightspeed <br> - No discrepancies if card untouched <br> - Discrepancies logged if balance differs |
| **Pass** | [ ] |

---

## 15. Edge Cases & Negative Tests

### TC-EDGE-001: Concurrent redemption race condition

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer has exactly 100 points |
| **Steps** | 1. Simultaneously submit two 100-point redemptions (use two browser tabs or API calls) |
| **Expected** | - Exactly one succeeds <br> - The other fails with insufficient points <br> - Balance never goes negative |
| **Pass** | [ ] |

### TC-EDGE-002: Gift card concurrent redemption

| Field | Detail |
|-------|--------|
| **Pre-condition** | Gift card with $10, two orders of $10 each |
| **Steps** | 1. Simultaneously redeem on both orders |
| **Expected** | - Exactly one succeeds <br> - Other fails: insufficient balance <br> - Serializable isolation prevents double-spend |
| **Pass** | [ ] |

### TC-EDGE-003: Loyalty disabled mid-checkout

| Field | Detail |
|-------|--------|
| **Pre-condition** | Loyalty reward applied to cart |
| **Steps** | 1. Admin disables `LOYALTY_PROGRAMME` flag <br> 2. Customer attempts to complete order |
| **Expected** | - Graceful handling: either reward removed or order still completes <br> - No crash or 500 error |
| **Pass** | [ ] |

### TC-EDGE-004: Zero-value order with loyalty

| Field | Detail |
|-------|--------|
| **Pre-condition** | Order total = $5, loyalty discount = $5 |
| **Steps** | 1. Apply $5 loyalty discount <br> 2. Proceed to payment |
| **Expected** | - Order total = $0 <br> - No Stripe charge required <br> - Order marked as paid |
| **Pass** | [ ] |

### TC-EDGE-005: Gift card with special characters in code input

| Field | Detail |
|-------|--------|
| **Steps** | 1. Enter code with extra spaces, lowercase, no dashes |
| **Expected** | - System normalises input (trim, uppercase) or rejects clearly |
| **Pass** | [ ] |

### TC-EDGE-006: Unauthenticated gift card redeem attempt

| Field | Detail |
|-------|--------|
| **Steps** | 1. Call `POST /gift-cards/redeem` without auth token |
| **Expected** | - 401 Unauthorized |
| **Pass** | [ ] |

### TC-EDGE-007: Admin adjusts points to negative balance

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer has 50 points |
| **Steps** | 1. Admin adjusts -100 points |
| **Expected** | - Rejected (balance cannot go negative) OR adjusted to 0 <br> - No negative balances in the system |
| **Pass** | [ ] |

### TC-EDGE-008: Double-tap on store check-in

| Field | Detail |
|-------|--------|
| **Pre-condition** | CHECK_IN rule with maxPerDay = 1, member not yet checked in today |
| **Steps** | 1. Fire two check-ins for the same store at the same moment |
| **Expected** | - Exactly one award <br> - The other returns "Check-in limit reached for this store today" <br> - One CHECK_IN transaction in the ledger |
| **Pass** | [ ] |

### TC-EDGE-009: Duplicate engagement award attempts

| Field | Detail |
|-------|--------|
| **Pre-condition** | A review, quest, or quiz that has already paid points |
| **Steps** | 1. Re-trigger the same award (re-approve the review, replay the quest completion) |
| **Expected** | - No second award <br> - Ledger shows one transaction for that source id |
| **Pass** | [ ] |

### TC-EDGE-010: POS sale voided after the member spent the points

| Field | Detail |
|-------|--------|
| **Pre-condition** | POS sale earned 100 points; member has since spent down to 30 |
| **Steps** | 1. Void the sale in Lightspeed and let the sync run |
| **Expected** | - Void completes (does not error) <br> - 30 points clawed back, balance 0 <br> - Ledger metadata records requested 100 / applied 30 <br> - Warning logged with the shortfall |
| **Pass** | [ ] |

### TC-EDGE-011: Birthday job run twice in a day

| Field | Detail |
|-------|--------|
| **Pre-condition** | Member with today's birthday, bonus already awarded |
| **Steps** | 1. Trigger `LOYALTY_BIRTHDAY_BONUS` again (or run two workers) |
| **Expected** | - No second bonus <br> - One BIRTHDAY transaction for the year |
| **Pass** | [ ] |

### TC-EDGE-012: Expiry horizon changed in Settings

| Field | Detail |
|-------|--------|
| **Pre-condition** | Points expiry set to 24 months, warning emails enabled |
| **Steps** | 1. Change expiry to 12 months in Admin > Loyalty > Settings <br> 2. Trigger the expiry-warning scan and the expiry sweep |
| **Expected** | - Both use 12 months <br> - Warnings go to members ~30 days from the 12-month mark, not the 24-month mark |
| **Pass** | [ ] |

### TC-EDGE-013: Reward code used by a different account

| Field | Detail |
|-------|--------|
| **Pre-condition** | Member A redeemed a DISCOUNT reward and has the code |
| **Steps** | 1. Sign in as Member B <br> 2. Enter Member A's code at checkout |
| **Expected** | - Rejected with "This coupon belongs to another account" <br> - Code still works for Member A |
| **Pass** | [ ] |

### TC-EDGE-014: Reward promotion never auto-applies

| Field | Detail |
|-------|--------|
| **Pre-condition** | At least one live loyalty reward coupon (or any admin promotion that has coupon codes) |
| **Steps** | 1. As an unrelated shopper, build a cart and go to checkout without entering any code |
| **Expected** | - No loyalty/coupon promotion is applied automatically <br> - Public automatic promotions still apply as before |
| **Pass** | [ ] |

### TC-EDGE-015: Card refund that settles after approval

| Field | Detail |
|-------|--------|
| **Pre-condition** | Approved return on a card order where the Stripe refund comes back `pending` |
| **Steps** | 1. Approve the return (refund stays pending) <br> 2. Deliver the `charge.refunded` webhook <br> 3. Re-deliver the same webhook |
| **Expected** | - Return goes to COMPLETED once <br> - Returned lines are restocked exactly once <br> - Vendor ledger records the refund once <br> - Influencer attribution reversed <br> - Full return: order `REFUNDED`; partial return: order status unchanged, `paymentStatus` `REFUNDED` |
| **Pass** | [ ] |

### TC-EDGE-015b: Refund raised in the Stripe dashboard

| Field | Detail |
|-------|--------|
| **Pre-condition** | Order with a return that was already refunded and COMPLETED |
| **Steps** | 1. Refund the same payment intent again directly in Stripe <br> 2. Let the webhook arrive |
| **Expected** | - Refund is recorded as a transaction on the order <br> - The old return is not re-completed, not restocked, and no loyalty reversal runs <br> - With two unsettled return refunds on one order, the log says the refund could not be attributed |
| **Pass** | [ ] |

### TC-EDGE-015c: Admin gift-card refund followed by a return

| Field | Detail |
|-------|--------|
| **Pre-condition** | Order of $100 paid $40 by gift card and $60 by card; admin has already refunded the $40 from Admin > Gift Cards |
| **Steps** | 1. Approve a full return for the same order |
| **Expected** | - The gift card is not credited a second time (balance stays at the $40 restore) <br> - Log warns the gift-card portion was short <br> - Loyalty reverses on the $60 that actually settled <br> - Reversing the order of the two actions gives the same end balance |
| **Pass** | [ ] |

### TC-EDGE-016: Clawback capped by balance, then topped up

| Field | Detail |
|-------|--------|
| **Pre-condition** | Order earned 200 points; member has spent down so only 50 remain; refund settles in two parts (gift card first, card later) |
| **Steps** | 1. Let the gift-card portion settle <br> 2. Let the card portion settle after the member earns more points |
| **Expected** | - First pass claws what was available <br> - Second pass claws the remainder rather than being treated as a replay <br> - Total clawed never exceeds the target for the refunded share |
| **Pass** | [ ] |

### TC-EDGE-017: Restored burn corrects lifetime redeemed

| Field | Detail |
|-------|--------|
| **Pre-condition** | Member redeemed 300 points at checkout; `totalPointsRedeemed` reflects it |
| **Steps** | 1. Cancel or fully refund that order with restore-burn enabled |
| **Expected** | - Points credited back <br> - `totalPointsRedeemed` drops by 300 (never below 0) <br> - A replayed reversal changes nothing |
| **Pass** | [ ] |

### TC-EDGE-018: Gift card redeemed twice on one order

| Field | Detail |
|-------|--------|
| **Pre-condition** | One gift card redeemed twice against the same order (e.g. $20 then $15) |
| **Steps** | 1. Admin > Gift Cards > Refund, pick that order <br> 2. Submit the full $35 |
| **Expected** | - UI max and API cap agree at $35 <br> - Refund succeeds and balance is restored <br> - A second refund attempt for the same order is capped at what is left |
| **Pass** | [ ] |

---

## 16. API Endpoint Tests

Quick reference for API-level testing. Use Postman, curl, or automated API tests.

### Loyalty Endpoints

| # | Method | Endpoint | Auth | Test |
|---|--------|----------|------|------|
| 1 | POST | `/loyalty/enroll` | JWT | Enrolment |
| 2 | GET | `/loyalty/membership` | JWT | Fetch balance, tier |
| 3 | GET | `/loyalty/transactions?page=1&limit=20` | JWT | Paginated history |
| 4 | GET | `/loyalty/tier-progress` | JWT | Tier info |
| 5 | GET | `/loyalty/redemption-options` | JWT | Rewards catalogue |
| 6 | POST | `/loyalty/redeem` | JWT | Burn points (send `idempotencyKey` and replay it — must not burn twice) |
| 7 | GET | `/loyalty/referral` | JWT | Referral code |
| 8 | POST | `/loyalty/referral/generate` | JWT | Generate code |
| 9 | GET | `/loyalty/card` | JWT | Digital card + QR |
| 10 | POST | `/loyalty/check-in` | JWT | Store check-in |
| 11 | POST | `/loyalty/lookup` | Staff API key | POS lookup |
| 12 | POST | `/loyalty/pos/redeem-for-voucher` | Staff API key | POS voucher |
| 13 | POST | `/cart/loyalty` | JWT | Apply reward to cart |
| 14 | DELETE | `/cart/loyalty` | JWT | Remove reward |
| 15 | GET | `/config/loyalty-enabled` | Public | Feature check |

### Admin Loyalty Endpoints

| # | Method | Endpoint | Test |
|---|--------|----------|------|
| 1 | GET | `/admin/loyalty/dashboard` | Dashboard KPIs |
| 2 | GET/PUT | `/admin/loyalty/tiers/:id` | Tier CRUD |
| 3 | GET/POST/PUT/DELETE | `/admin/loyalty/earn-rules` | Earn rule CRUD |
| 4 | GET/POST/PUT/DELETE | `/admin/loyalty/redemption-options` | Reward CRUD |
| 5 | GET/POST/PUT/DELETE | `/admin/loyalty/campaigns` | Campaign CRUD |
| 6 | GET | `/admin/loyalty/members` | Member list |
| 7 | POST | `/admin/loyalty/adjust` | Point adjustment |
| 8 | GET | `/admin/loyalty/transactions` | Full ledger |

### Gift Card Endpoints

| # | Method | Endpoint | Auth | Test |
|---|--------|----------|------|------|
| 1 | GET | `/gift-cards/catalog` | Public | Denominations |
| 2 | POST | `/gift-cards` | Admin | Issue card |
| 3 | GET | `/gift-cards/validate/:code` | Public (rate-limited) | Validation |
| 4 | POST | `/gift-cards/redeem` | JWT | Redeem |
| 5 | GET | `/gift-cards/my-gift-cards` | JWT | User's cards |
| 6 | GET | `/gift-cards/admin/all` | Admin | All cards |
| 7 | GET | `/gift-cards/:id/transactions` | JWT (owner) | History |
| 8 | POST | `/gift-cards/:id/refund` | Admin | Refund |

---

## Test Execution Checklist

| Area | Total Cases | Passed | Failed | Blocked |
|------|-------------|--------|--------|---------|
| Enrolment (TC-L-001 to 004) | 4 | | | |
| Earn Points (TC-L-010 to 020) | 11 | | | |
| Redemption (TC-L-030 to 035) | 6 | | | |
| Tiers (TC-L-040 to 043) | 4 | | | |
| Points Expiry (TC-L-050 to 052) | 3 | | | |
| Referrals (TC-L-060 to 062) | 3 | | | |
| POS Voucher (TC-L-070 to 074) | 5 | | | |
| Admin Loyalty (TC-L-080 to 086) | 7 | | | |
| Gift Card Creation (TC-GC-001 to 004) | 4 | | | |
| Gift Card Redemption (TC-GC-010 to 018) | 9 | | | |
| Gift Card Refund (TC-GC-020 to 022) | 3 | | | |
| Gift Card Admin (TC-GC-030 to 033) | 4 | | | |
| Integration (TC-INT-001 to 005) | 5 | | | |
| Edge Cases (TC-EDGE-001 to 007) | 7 | | | |
| **Total** | **75** | | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Product Owner | | | |
| Dev Lead | | | |

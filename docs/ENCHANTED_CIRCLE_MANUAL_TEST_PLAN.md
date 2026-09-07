# Enchanted Circle Campaign — Manual Test Plan

**Audience:** QA / Manual Testers
**Date:** September 2026
**Build:** `6e198bca` (master)
**Environment:**
- **Web:** https://houseofspells.com
- **API:** https://api.houseofspells.com/api

---

## Table of Contents

1. [Overview of Changes](#1-overview-of-changes)
2. [Pre-conditions & Test Data](#2-pre-conditions--test-data)
3. [QR Enrolment — `/loyalty/join` Page](#3-qr-enrolment--loyaltyjoin-page)
4. [Loyalty Card — QR Code Display](#4-loyalty-card--qr-code-display)
5. [Campaign Management — Admin UI](#5-campaign-management--admin-ui)
6. [Loyalty Settings — Campaign Section](#6-loyalty-settings--campaign-section)
7. [Earn Engine — Gift Card Exclusion & Qualifying Subtotal](#7-earn-engine--gift-card-exclusion--qualifying-subtotal)
8. [Earn Engine — Threshold Bonus Points](#8-earn-engine--threshold-bonus-points)
9. [POS Voucher — Welcome Reward Purchase Minimum](#9-pos-voucher--welcome-reward-purchase-minimum)
10. [Campaign Performance Analytics Dashboard](#10-campaign-performance-analytics-dashboard)
11. [Store-Scoped Campaigns](#11-store-scoped-campaigns)
12. [POS Staff Enrolment & Lookup](#12-pos-staff-enrolment--lookup)
13. [Regression — Existing Loyalty Flows](#13-regression--existing-loyalty-flows)
14. [API Endpoint Reference](#14-api-endpoint-reference)
15. [Edge Cases & Negative Tests](#15-edge-cases--negative-tests)
16. [Test Execution Checklist](#16-test-execution-checklist)
17. [Sign-off](#17-sign-off)

---

## 1. Overview of Changes

This release adds the "Enchanted Circle" campaign layer on top of the existing loyalty programme. Key changes:

| Feature | What's new |
|---------|-----------|
| **QR enrolment page** | Public `/loyalty/join` page — customers scan an in-store QR, register, and see their Welcome Reward immediately |
| **PERCENTAGE_OF_QUALIFYING campaign type** | New campaign type that awards bonus points as a percentage of spend above a configurable threshold |
| **Store-scoped campaigns** | Campaigns can be limited to specific stores via `storeIds` |
| **Gift card exclusion** | `qualifyingSubtotal` on Order rows excludes gift card line items from threshold calculations |
| **Campaign performance dashboard** | New admin page at `/admin/loyalty-analytics/campaign-performance` |
| **Loyalty settings — campaign fields** | `campaignMinPurchaseThreshold`, `campaignBonusEarnRate`, `campaignBonusPointsPerDollar` added to settings |
| **POS voucher purchase minimum** | Welcome Reward redemption now requires a minimum merchandise purchase (configurable) |
| **Loyalty card QR** | `/loyalty/card` page now renders a scannable QR code with a `showValue` toggle |
| **CustomerQr component** | New `showValue` and `alt` props for accessibility and cleaner display |

---

## 2. Pre-conditions & Test Data

### Environment Setup

- [ ] Staging/production is deployed and accessible (Railway status: all services SUCCESS)
- [ ] Feature flags enabled: `LOYALTY_PROGRAMME`, `POS_INTEGRATION`
- [ ] Environment variables set:
  - `LOYALTY_ENABLED=true`
  - `LOYALTY_POS_VOUCHER_ENABLED=true`
  - `NEXT_PUBLIC_LOYALTY_ENABLED=true`
- [ ] At least one store exists in the system (for store-scoped campaign tests)
- [ ] At least one vendor with products in `ACTIVE` status
- [ ] At least one product that is a gift card (name contains "gift card")
- [ ] At least one regular merchandise product (non-gift-card)

### Test Accounts

| Role | Account | Notes |
|------|---------|-------|
| **Admin** | `admin@hos.test` or `app@houseofspells.co.uk` | Full access |
| **Customer (enrolled)** | `customer@hos.test` | Has loyalty membership, balance > 0 |
| **Customer (new)** | Use a fresh email for each `/loyalty/join` test | Not yet registered |
| **Staff** | Any user with store-staff access | For POS lookup tests |

### Reference Values

| Setting | Default | Where to check |
|---------|---------|---------------|
| Campaign threshold | Configured in Admin > Loyalty > Settings | `campaignMinPurchaseThreshold` |
| Bonus earn rate | Configured in Admin > Loyalty > Settings | `campaignBonusEarnRate` (e.g. 0.20 = 20%) |
| Points per currency unit | Configured in Admin > Loyalty > Settings | `campaignBonusPointsPerDollar` (e.g. 100) |
| Welcome reward minimum | Same as threshold or `welcomeRewardMinPurchase` | Admin > Loyalty > Settings |

---

## 3. QR Enrolment — `/loyalty/join` Page

### TC-EC-001: New customer registers via QR join page

| Field | Detail |
|-------|--------|
| **Pre-condition** | Not logged in, not registered |
| **Steps** | 1. Navigate to `/loyalty/join` (or scan in-store QR that links here) <br> 2. Fill in first name, last name, email, phone, password <br> 3. Accept GDPR consent checkbox <br> 4. Click "Join The Enchanted Circle" |
| **Expected** | - Account created <br> - Loyalty membership auto-created at Initiate tier <br> - Signup bonus (100 pts) awarded <br> - Success screen shows first name, "Your reward is ready" or welcome amount <br> - QR code displayed on success screen <br> - User is logged in automatically |
| **Pass** | [ ] |

### TC-EC-002: QR join page with referral code

| Field | Detail |
|-------|--------|
| **Pre-condition** | Valid referral URL: `/loyalty/join?ref=HOS-XXXXX` |
| **Steps** | 1. Open the referral URL <br> 2. Complete registration |
| **Expected** | - Referral code field pre-populated <br> - Referral credited after first purchase <br> - Referrer gets their referral bonus |
| **Pass** | [ ] |

### TC-EC-003: Already-registered user visits join page

| Field | Detail |
|-------|--------|
| **Pre-condition** | Already logged in as enrolled member |
| **Steps** | 1. Navigate to `/loyalty/join` |
| **Expected** | - Shows existing card / QR code instead of the registration form <br> - "You're already a member" state <br> - Link to view loyalty card |
| **Pass** | [ ] |

### TC-EC-004: Join page — duplicate email

| Field | Detail |
|-------|--------|
| **Pre-condition** | Email already exists in system |
| **Steps** | 1. Navigate to `/loyalty/join` <br> 2. Enter an already-registered email <br> 3. Submit form |
| **Expected** | - Clear error message: "already registered" or "please sign in" <br> - Login link shown <br> - No duplicate account created |
| **Pass** | [ ] |

### TC-EC-005: Join page — validation errors

| Field | Detail |
|-------|--------|
| **Steps** | 1. Submit form with: <br> - Empty first name <br> - Invalid email format <br> - Password without uppercase/digit/special <br> - GDPR consent unchecked |
| **Expected** | - Inline validation errors for each field <br> - Form does NOT submit <br> - Password requirements hint visible |
| **Pass** | [ ] |

### TC-EC-006: Join page — no auth required

| Field | Detail |
|-------|--------|
| **Steps** | 1. Open `/loyalty/join` in incognito/private window <br> 2. Verify the page loads without a login redirect |
| **Expected** | - Page loads fully without requiring auth <br> - Middleware does not redirect to `/login` |
| **Pass** | [ ] |

### TC-EC-007: Join page — SEO metadata

| Field | Detail |
|-------|--------|
| **Steps** | 1. View page source or inspect `<head>` for `/loyalty/join` |
| **Expected** | - `<title>` is "Join the Enchanted Circle" <br> - `<meta name="description">` is present and meaningful |
| **Pass** | [ ] |

---

## 4. Loyalty Card — QR Code Display

### TC-EC-010: QR code renders on loyalty card page

| Field | Detail |
|-------|--------|
| **Pre-condition** | Logged in as enrolled customer |
| **Steps** | 1. Navigate to `/loyalty/card` |
| **Expected** | - QR code image renders (SVG data URL, approximately 220px) <br> - Card number displayed below QR <br> - Points balance visible <br> - "Show this code at the till" hint text <br> - No raw JSON payload visible (showValue=false) |
| **Pass** | [ ] |

### TC-EC-011: QR code is scannable

| Field | Detail |
|-------|--------|
| **Pre-condition** | QR rendered on card page |
| **Steps** | 1. Use a QR scanner app (phone camera or dedicated app) to scan the QR <br> 2. Read the decoded payload |
| **Expected** | - Payload is valid JSON: `{"t":"hos-loyalty","c":"HOS-XXXXXXXX"}` <br> - Card number in payload matches the one displayed on screen |
| **Pass** | [ ] |

### TC-EC-012: Card page — alt text for accessibility

| Field | Detail |
|-------|--------|
| **Steps** | 1. Inspect the `<img>` element for the QR code on `/loyalty/card` |
| **Expected** | - `alt` attribute is "Enchanted Circle loyalty card" (not empty or generic) |
| **Pass** | [ ] |

---

## 5. Campaign Management — Admin UI

### TC-EC-020: Create PERCENTAGE_OF_QUALIFYING campaign

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. Navigate to Admin > Loyalty > Campaigns <br> 2. Click "Add Campaign" <br> 3. Set name = "Summer Enchanted Circle" <br> 4. Set type = "% of spend above threshold" <br> 5. Set purchase threshold, bonus rate, and points per currency unit <br> 6. Set date range (today to next month) <br> 7. Optionally select specific stores <br> 8. Save |
| **Expected** | - Campaign appears in list <br> - Type shows "X% above $Y" format (not "Xx multiplier") <br> - Store names listed (or "All stores" if none selected) <br> - Date range displayed correctly |
| **Pass** | [ ] |

### TC-EC-021: Edit existing PERCENTAGE_OF_QUALIFYING campaign

| Field | Detail |
|-------|--------|
| **Pre-condition** | Campaign from TC-EC-020 exists |
| **Steps** | 1. Click "Edit" on the campaign <br> 2. Verify threshold, earn rate, and points per dollar are pre-populated <br> 3. Change threshold from e.g. $85 to $100 <br> 4. Add/remove stores <br> 5. Save |
| **Expected** | - Updated values reflected in list <br> - Conditions JSON saved correctly with new threshold <br> - Store assignments updated |
| **Pass** | [ ] |

### TC-EC-022: Campaign form shows threshold fields only for PERCENTAGE_OF_QUALIFYING

| Field | Detail |
|-------|--------|
| **Steps** | 1. Select type "Multiplier" → verify threshold/rate/points fields are hidden <br> 2. Select type "Bonus Points" → verify threshold/rate/points fields are hidden <br> 3. Select type "% of spend above threshold" → verify threshold/rate/points fields appear |
| **Expected** | - Conditional form fields toggle correctly based on campaign type |
| **Pass** | [ ] |

### TC-EC-023: Campaign defaults pulled from settings

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin > Loyalty > Settings has threshold = 85, rate = 0.20, pts per dollar = 100 |
| **Steps** | 1. Click "Add Campaign" <br> 2. Select type "% of spend above threshold" <br> 3. Check pre-filled values |
| **Expected** | - Threshold pre-filled: 85 <br> - Rate pre-filled: 0.20 <br> - Points per dollar pre-filled: 100 <br> - Values are NOT hardcoded — they come from settings API |
| **Pass** | [ ] |

### TC-EC-024: Store selection in campaign form

| Field | Detail |
|-------|--------|
| **Pre-condition** | At least 2 stores exist |
| **Steps** | 1. Create a new campaign <br> 2. In "Applicable Stores" section, check one store <br> 3. Verify "1 store selected" counter <br> 4. Uncheck all stores <br> 5. Verify "Applies to all stores" message |
| **Expected** | - Stores listed with names and codes <br> - Checkboxes work correctly <br> - Counter updates in real time <br> - Empty = global campaign |
| **Pass** | [ ] |

---

## 6. Loyalty Settings — Campaign Section

### TC-EC-030: Campaign settings fields visible

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. Navigate to Admin > Loyalty > Settings <br> 2. Scroll to "Enchanted Circle campaign" section |
| **Expected** | - "Minimum purchase threshold" field visible with currency symbol <br> - "Bonus earn rate" field visible (fraction format hint) <br> - "Bonus points per currency unit" field visible <br> - All three fields have current values (not empty, not NaN) |
| **Pass** | [ ] |

### TC-EC-031: Update campaign settings

| Field | Detail |
|-------|--------|
| **Steps** | 1. Change threshold to 100, rate to 0.25, points to 150 <br> 2. Save <br> 3. Reload page |
| **Expected** | - Values persist after reload <br> - Source indicator shows "database" (not "env") <br> - New campaigns pick up these defaults |
| **Pass** | [ ] |

### TC-EC-032: Campaign settings — zero and boundary values

| Field | Detail |
|-------|--------|
| **Steps** | 1. Set threshold = 0 <br> 2. Save |
| **Expected** | - Setting accepted (0 = no threshold, all purchases earn bonus) <br> - Campaign performance dashboard shows threshold as $0 |
| **Pass** | [ ] |

---

## 7. Earn Engine — Gift Card Exclusion & Qualifying Subtotal

### TC-EC-040: Online order with gift card lines excluded

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer. Cart has $50 merchandise + $25 gift card = $75 total |
| **Steps** | 1. Complete checkout and pay <br> 2. Check loyalty transaction ledger (Admin > Loyalty > Transactions or API) <br> 3. Check the order in the database or admin panel |
| **Expected** | - `qualifyingSubtotal` on the Order = $50 (not $75) <br> - Base earn points calculated on $50 (not $75) <br> - If a threshold campaign is active and threshold is $85, this order does NOT qualify for bonus |
| **Pass** | [ ] |

### TC-EC-041: Online order — all merchandise, no gift cards

| Field | Detail |
|-------|--------|
| **Pre-condition** | Cart with $100 of regular merchandise only |
| **Steps** | 1. Complete checkout <br> 2. Check `qualifyingSubtotal` on the Order |
| **Expected** | - `qualifyingSubtotal` = order subtotal (no exclusion needed) <br> - Points earned on full amount |
| **Pass** | [ ] |

### TC-EC-042: POS sale — gift card excluded

| Field | Detail |
|-------|--------|
| **Pre-condition** | POS import configured, sale includes gift card + merchandise |
| **Steps** | 1. Record sale in POS with a gift card line and a merchandise line <br> 2. Wait for POS import sync <br> 3. Check loyalty earn transaction |
| **Expected** | - Points earned only on merchandise total <br> - Gift card line excluded from qualifying amount |
| **Pass** | [ ] |

---

## 8. Earn Engine — Threshold Bonus Points

### TC-EC-050: Order above threshold earns bonus points

| Field | Detail |
|-------|--------|
| **Pre-condition** | Active PERCENTAGE_OF_QUALIFYING campaign. Threshold = $85, rate = 0.20, pts/$1 = 100. Enrolled customer. |
| **Steps** | 1. Place a $120 merchandise-only order <br> 2. Check loyalty transactions |
| **Expected** | - Base earn: 120 points (1 pt/$1 at Initiate tier) <br> - Bonus: ($120 − $85) × 0.20 × 100 = 700 bonus points <br> - Transaction ledger shows both a PURCHASE earn and a BONUS earn <br> - Total: 820 points added |
| **Pass** | [ ] |

### TC-EC-051: Order exactly at threshold — no bonus

| Field | Detail |
|-------|--------|
| **Pre-condition** | Same campaign. Threshold = $85. |
| **Steps** | 1. Place an $85.00 merchandise-only order <br> 2. Check loyalty transactions |
| **Expected** | - Base earn: 85 points <br> - Bonus: ($85 − $85) × 0.20 × 100 = 0 bonus points <br> - No bonus transaction created |
| **Pass** | [ ] |

### TC-EC-052: Order below threshold — no bonus

| Field | Detail |
|-------|--------|
| **Pre-condition** | Same campaign. Threshold = $85. |
| **Steps** | 1. Place a $60 order <br> 2. Check loyalty transactions |
| **Expected** | - Base earn: 60 points <br> - No bonus points <br> - No bonus transaction |
| **Pass** | [ ] |

### TC-EC-053: Order above threshold but gift card reduces qualifying below threshold

| Field | Detail |
|-------|--------|
| **Pre-condition** | Threshold = $85. Cart: $90 merchandise + $50 gift card = $140 total. |
| **Steps** | 1. Complete checkout <br> 2. Check qualifying subtotal and bonus |
| **Expected** | - `qualifyingSubtotal` = $90 (gift card excluded) <br> - Bonus: ($90 − $85) × 0.20 × 100 = 100 bonus points <br> - Base earn on $90 |
| **Pass** | [ ] |

### TC-EC-054: No active campaign — no bonus points

| Field | Detail |
|-------|--------|
| **Pre-condition** | No active PERCENTAGE_OF_QUALIFYING campaigns (deactivated or expired) |
| **Steps** | 1. Place a $150 order <br> 2. Check loyalty transactions |
| **Expected** | - Base earn only (150 points) <br> - No bonus transaction |
| **Pass** | [ ] |

---

## 9. POS Voucher — Welcome Reward Purchase Minimum

### TC-EC-060: Welcome reward blocked below purchase minimum

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer with signup bonus (100 pts). `welcomeRewardMinPurchase` or `campaignMinPurchaseThreshold` = $85. Customer's basket has $40 merchandise. |
| **Steps** | 1. Staff looks up customer via `/store/lookup` <br> 2. Staff attempts to redeem Welcome Reward (signup bonus) for a POS voucher <br> 3. Enter merchandise total: $40 |
| **Expected** | - Redemption blocked <br> - Error message indicates minimum purchase requirement <br> - Points NOT deducted |
| **Pass** | [ ] |

### TC-EC-061: Welcome reward allowed at purchase minimum

| Field | Detail |
|-------|--------|
| **Pre-condition** | Same customer. Merchandise total = $85. |
| **Steps** | 1. Staff enters merchandise total: $85 <br> 2. Attempts Welcome Reward redemption |
| **Expected** | - Redemption succeeds <br> - Points deducted <br> - POS voucher / gift card issued |
| **Pass** | [ ] |

### TC-EC-062: Merchandise total input validation

| Field | Detail |
|-------|--------|
| **Steps** | On `/store/lookup` page: <br> 1. Enter negative number in merchandise total → verify error <br> 2. Enter non-numeric text → verify error <br> 3. Leave empty → verify validation message <br> 4. Enter 0 → verify it's accepted (but redemption may be blocked by minimum) |
| **Expected** | - Client-side validation prevents invalid submissions <br> - Only non-negative numbers accepted |
| **Pass** | [ ] |

### TC-EC-063: Non-welcome redemptions bypass purchase minimum

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer with 500+ points (beyond signup bonus) |
| **Steps** | 1. Redeem a standard reward (not Welcome Reward) at POS <br> 2. Do not provide merchandise total |
| **Expected** | - Redemption succeeds without a purchase minimum check <br> - Only the "first redemption of signup bonus" is gated |
| **Pass** | [ ] |

---

## 10. Campaign Performance Analytics Dashboard

### TC-EC-070: Dashboard loads with data

| Field | Detail |
|-------|--------|
| **Pre-condition** | Admin logged in. At least one PERCENTAGE_OF_QUALIFYING campaign exists with some orders during its date range. |
| **Steps** | 1. Navigate to Admin > Loyalty Analytics > Campaign Performance <br> (or `/admin/loyalty-analytics/campaign-performance`) |
| **Expected** | - Page loads without errors <br> - 4 KPI cards visible: New Registrations, Avg Transaction Value, Threshold Rate, Total Points Awarded <br> - Daily revenue chart renders <br> - "Welcome rewards vs loyalty bonus" table visible <br> - "Campaign quick reference" bar shows threshold and bonus rate values |
| **Pass** | [ ] |

### TC-EC-071: Date range auto-snaps to campaign dates

| Field | Detail |
|-------|--------|
| **Steps** | 1. Select a specific campaign from the dropdown <br> 2. Observe the date range picker |
| **Expected** | - Date range automatically adjusts to the campaign's start and end dates <br> - Snapping happens only once (no infinite re-render) |
| **Pass** | [ ] |

### TC-EC-072: Filter by campaign

| Field | Detail |
|-------|--------|
| **Steps** | 1. Select "All bonus campaigns" from dropdown <br> 2. Note the KPIs <br> 3. Select a specific campaign <br> 4. Compare KPIs |
| **Expected** | - Data changes to reflect the selected campaign <br> - "Active filter: [Campaign Name]" appears in quick reference box |
| **Pass** | [ ] |

### TC-EC-073: Filter by store

| Field | Detail |
|-------|--------|
| **Pre-condition** | Store-scoped campaigns exist |
| **Steps** | 1. Select "All stores" <br> 2. Note KPIs <br> 3. Select a specific store <br> 4. Compare KPIs |
| **Expected** | - Data filters to the selected store <br> - Metrics reflect only that store's transactions |
| **Pass** | [ ] |

### TC-EC-074: Empty state — no data

| Field | Detail |
|-------|--------|
| **Steps** | 1. Select a date range with no loyalty activity (e.g. far future) |
| **Expected** | - KPIs show 0 values <br> - Revenue chart shows "No loyalty member revenue in this range" <br> - No errors or crashes |
| **Pass** | [ ] |

### TC-EC-075: Threshold and bonus values are dynamic (not hardcoded)

| Field | Detail |
|-------|--------|
| **Steps** | 1. Admin > Loyalty > Settings — change threshold from $85 to $100 <br> 2. Go to Campaign Performance dashboard <br> 3. Check the "Campaign quick reference" bar |
| **Expected** | - Threshold shows $100 (not $85) <br> - Values sourced from backend settings, not frontend hardcodes |
| **Pass** | [ ] |

### TC-EC-076: Link from analytics health page

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to Admin > Loyalty Analytics (health page) <br> 2. Find "Campaign performance →" link <br> 3. Click it |
| **Expected** | - Navigates to `/admin/loyalty-analytics/campaign-performance` <br> - Link is present alongside CLV, Attribution, Fandom Trends, etc. |
| **Pass** | [ ] |

---

## 11. Store-Scoped Campaigns

### TC-EC-080: Global campaign applies to all contexts

| Field | Detail |
|-------|--------|
| **Pre-condition** | Campaign with `storeIds = []` (no stores selected = global) |
| **Steps** | 1. Web checkout order (no store context) <br> 2. POS sale at any store |
| **Expected** | - Bonus points awarded in both cases <br> - Campaign listed as active for all contexts |
| **Pass** | [ ] |

### TC-EC-081: Store-scoped campaign only applies to matching store

| Field | Detail |
|-------|--------|
| **Pre-condition** | Campaign with `storeIds = ["store-london-soho"]` |
| **Steps** | 1. POS sale at London Soho store → check if bonus awarded <br> 2. POS sale at a different store → check if bonus awarded <br> 3. Web checkout (no store context) → check if bonus awarded |
| **Expected** | - Soho store: bonus awarded <br> - Other store: bonus NOT awarded <br> - Web checkout: bonus NOT awarded (store-scoped campaigns excluded when no storeId) |
| **Pass** | [ ] |

### TC-EC-082: Campaign list shows store names

| Field | Detail |
|-------|--------|
| **Steps** | 1. Admin > Loyalty > Campaigns <br> 2. Check a store-scoped campaign in the list |
| **Expected** | - "Stores: London Soho, Times Square" (resolved names, not UUIDs) <br> - Global campaigns show "Stores: All stores" |
| **Pass** | [ ] |

---

## 12. POS Staff Enrolment & Lookup

### TC-EC-090: Staff enrols new customer at POS

| Field | Detail |
|-------|--------|
| **Pre-condition** | Staff logged in on `/store/lookup` |
| **Steps** | 1. Search for a non-existent customer email <br> 2. If POS enrolment is supported, fill in customer details <br> 3. Enrol them |
| **Expected** | - Account created <br> - Loyalty membership created <br> - Signup bonus awarded <br> - QR code available for the customer |
| **Pass** | [ ] |

### TC-EC-091: Staff looks up existing member

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer is already enrolled |
| **Steps** | 1. Search by email or card number on `/store/lookup` |
| **Expected** | - Member found <br> - Email masked (e.g. `t****r@test.com`) <br> - Surname reduced to initial <br> - Card number visible <br> - Points balance visible <br> - Phone last 4 digits only <br> - No unnecessary PII leaked |
| **Pass** | [ ] |

---

## 13. Regression — Existing Loyalty Flows

These are existing flows that must NOT be broken by the new campaign changes.

### TC-REG-001: Self-enrolment still works

| Field | Detail |
|-------|--------|
| **Steps** | 1. Log in as unenrolled customer <br> 2. Navigate to `/loyalty` <br> 3. Click enrol |
| **Expected** | - Membership created, 100 pts signup bonus |
| **Pass** | [ ] |

### TC-REG-002: Auto-enrolment on purchase still works

| Field | Detail |
|-------|--------|
| **Steps** | 1. Unenrolled customer completes a purchase |
| **Expected** | - Membership auto-created <br> - Purchase points + signup bonus awarded |
| **Pass** | [ ] |

### TC-REG-003: MULTIPLIER campaign type still works

| Field | Detail |
|-------|--------|
| **Pre-condition** | Active MULTIPLIER campaign (e.g. 2×) |
| **Steps** | 1. Place a $50 order at Initiate tier |
| **Expected** | - 100 points earned (50 × 2.0 campaign multiplier) <br> - No threshold bonus (different campaign type) |
| **Pass** | [ ] |

### TC-REG-004: Redemption at checkout still works

| Field | Detail |
|-------|--------|
| **Pre-condition** | Enrolled customer with 500+ points |
| **Steps** | 1. Apply a $5 discount reward at checkout <br> 2. Complete order |
| **Expected** | - 500 points deducted <br> - Order total reduced by $5 <br> - Coupon issued and applied |
| **Pass** | [ ] |

### TC-REG-005: POS voucher redemption still works (non-welcome)

| Field | Detail |
|-------|--------|
| **Pre-condition** | Customer with 500+ pts (beyond signup bonus) |
| **Steps** | 1. Staff redeems for POS voucher via `/store/lookup` |
| **Expected** | - Points deducted <br> - Gift card issued in Lightspeed <br> - No purchase minimum check for non-welcome burns |
| **Pass** | [ ] |

### TC-REG-006: Tier progress and multiplier unchanged

| Field | Detail |
|-------|--------|
| **Steps** | 1. Check `/loyalty/tier-progress` or `/loyalty` dashboard |
| **Expected** | - Tier name, progress bar, and multiplier display correctly <br> - No visual regressions |
| **Pass** | [ ] |

### TC-REG-007: Referral flow still works

| Field | Detail |
|-------|--------|
| **Steps** | 1. Generate referral code <br> 2. New user registers via referral link <br> 3. New user makes first purchase |
| **Expected** | - Both parties earn referral points |
| **Pass** | [ ] |

### TC-REG-008: Points expiry still works

| Field | Detail |
|-------|--------|
| **Steps** | 1. Trigger expiry cron job (or wait for scheduled run) |
| **Expected** | - Old points expired according to configured months <br> - No interaction with campaign bonus points |
| **Pass** | [ ] |

### TC-REG-009: Admin dashboard still loads

| Field | Detail |
|-------|--------|
| **Steps** | 1. Admin > Loyalty (dashboard) |
| **Expected** | - All KPIs load <br> - Member count, total points, redemptions visible <br> - No errors |
| **Pass** | [ ] |

### TC-REG-010: Admin navigation includes campaign performance link

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate the admin sidebar / loyalty analytics sub-pages |
| **Expected** | - "Campaign performance" link appears in analytics navigation <br> - All other analytics pages (CLV, Attribution, Fandom Trends, Tiers) still accessible |
| **Pass** | [ ] |

---

## 14. API Endpoint Reference

### New / Modified Endpoints

| # | Method | Endpoint | Auth | What to test |
|---|--------|----------|------|-------------|
| 1 | GET | `/admin/loyalty-analytics/campaign-performance` | Admin JWT | Returns `CampaignPerformance` object with threshold, bonusEarnRate, revenuePerDay |
| 2 | POST | `/loyalty/pos/redeem-for-voucher` | Staff key | Now accepts optional `purchaseSubtotal` in body |
| 3 | POST | `/loyalty/join` (web page) | Public | No API auth — browser-based form |
| 4 | GET | `/loyalty/card` | JWT | Returns `qrPayload` for QR rendering |
| 5 | GET | `/admin/loyalty/settings` | Admin JWT | Now returns `campaignMinPurchaseThreshold`, `campaignBonusEarnRate`, `campaignBonusPointsPerDollar` |
| 6 | PUT | `/admin/loyalty/settings` | Admin JWT | Accepts the three new campaign fields |
| 7 | POST/PUT | `/admin/loyalty/campaigns` | Admin JWT | Now accepts `storeIds`, `conditions` (with threshold, earnRate, pointsPerDollar) |

### Quick cURL Tests

**Campaign Performance:**
```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/loyalty-analytics/campaign-performance?from=2026-08-01&to=2026-09-30" | jq .
```

**POS Voucher with Purchase Subtotal:**
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -H "x-api-key: $STAFF_KEY" \
  "$API_BASE/loyalty/pos/redeem-for-voucher" \
  -d '{"membershipId":"...","points":100,"idempotencyKey":"test-123","storeId":"...","purchaseSubtotal":85}' | jq .
```

**Loyalty Settings (read):**
```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/loyalty/settings" | jq '.settings | {campaignMinPurchaseThreshold, campaignBonusEarnRate, campaignBonusPointsPerDollar}'
```

---

## 15. Edge Cases & Negative Tests

### TC-EDGE-EC-001: Gift-card-only order earns zero qualifying subtotal

| Field | Detail |
|-------|--------|
| **Pre-condition** | Cart contains ONLY gift cards ($100 worth) |
| **Steps** | 1. Complete checkout |
| **Expected** | - `qualifyingSubtotal` = $0 <br> - Zero base earn points on qualifying amount <br> - No bonus points (below any threshold) |
| **Pass** | [ ] |

### TC-EDGE-EC-002: Campaign settings fallback when database fails

| Field | Detail |
|-------|--------|
| **Pre-condition** | Database temporarily unavailable (simulate or test on staging) |
| **Steps** | 1. Attempt to load campaign performance page |
| **Expected** | - Graceful fallback to environment defaults or 0 <br> - No 500 crash <br> - Error message shown if data unavailable |
| **Pass** | [ ] |

### TC-EDGE-EC-003: Campaign with overlapping dates

| Field | Detail |
|-------|--------|
| **Pre-condition** | Two active PERCENTAGE_OF_QUALIFYING campaigns overlapping |
| **Steps** | 1. Place a qualifying order |
| **Expected** | - Only one bonus applied (system should use the first matching or most specific) <br> - No double-counting of bonus points |
| **Pass** | [ ] |

### TC-EDGE-EC-004: Deactivated campaign does not award bonus

| Field | Detail |
|-------|--------|
| **Steps** | 1. Deactivate a campaign (isActive = false) <br> 2. Place a qualifying order |
| **Expected** | - No bonus awarded <br> - Base earn still works normally |
| **Pass** | [ ] |

### TC-EDGE-EC-005: QR join page — rapid double-submit

| Field | Detail |
|-------|--------|
| **Steps** | 1. Fill in the join form <br> 2. Click submit twice rapidly |
| **Expected** | - Only one account created <br> - No duplicate signup bonus <br> - Button disabled during submission |
| **Pass** | [ ] |

### TC-EDGE-EC-006: Campaign performance with very large date range

| Field | Detail |
|-------|--------|
| **Steps** | 1. Set date range to 1 year <br> 2. Load campaign performance |
| **Expected** | - Page loads (may be slow) <br> - Revenue chart renders with all days <br> - No timeout or crash |
| **Pass** | [ ] |

### TC-EDGE-EC-007: Analytics uses qualifyingSubtotal not subtotal

| Field | Detail |
|-------|--------|
| **Pre-condition** | Orders exist with both gift card and merchandise lines |
| **Steps** | 1. Open campaign performance dashboard <br> 2. Check threshold rate metric |
| **Expected** | - "Transactions above threshold" counts only those where qualifyingSubtotal >= threshold <br> - Orders where total is above threshold but qualifyingSubtotal is below are NOT counted |
| **Pass** | [ ] |

---

## 16. Test Execution Checklist

| Area | Test Cases | Passed | Failed | Blocked |
|------|-----------|--------|--------|---------|
| QR Enrolment (TC-EC-001 to 007) | 7 | | | |
| Loyalty Card QR (TC-EC-010 to 012) | 3 | | | |
| Campaign Admin UI (TC-EC-020 to 024) | 5 | | | |
| Loyalty Settings (TC-EC-030 to 032) | 3 | | | |
| Gift Card Exclusion (TC-EC-040 to 042) | 3 | | | |
| Threshold Bonus Points (TC-EC-050 to 054) | 5 | | | |
| POS Welcome Min (TC-EC-060 to 063) | 4 | | | |
| Campaign Analytics (TC-EC-070 to 076) | 7 | | | |
| Store-Scoped Campaigns (TC-EC-080 to 082) | 3 | | | |
| POS Staff (TC-EC-090 to 091) | 2 | | | |
| Regression (TC-REG-001 to 010) | 10 | | | |
| Edge Cases (TC-EDGE-EC-001 to 007) | 7 | | | |
| **Total** | **59** | | | |

---

## 17. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Product Owner | | | |
| Dev Lead | | | |

---

## Appendix: Automated Test Coverage

The following automated tests already pass and cover the core logic. Manual testing focuses on UI behaviour, end-to-end flows, and real-data scenarios that unit tests cannot replicate.

| Suite | Tests | Status |
|-------|-------|--------|
| API (138 suites) | 1,479 tests | All passing |
| Web (6 suites) | 53 tests | All passing |
| Loyalty-specific (16 suites) | 174 tests | All passing |

Key automated coverage areas:
- `earn.engine.spec.ts` — gift card exclusion, threshold bonus calculation, campaign qualifying helpers
- `burn.engine.spec.ts` — welcome reward purchase minimum, channel validation, idempotency
- `campaign.service.spec.ts` — store-scoped filtering
- `loyalty-settings.service.spec.ts` — normalize fallback symmetry, caching, env defaults
- `loyalty-analytics.service.spec.ts` — campaign performance metrics, qualifyingSubtotal usage
- `pos-voucher.service.spec.ts` — idempotency, store scoping, Lightspeed rollback
- `CustomerQr.test.tsx` — showValue prop, alt text, QR rendering

# Loyalty & Gift Card — Addition & Redemption Process Guide

**Programme name:** The Enchanted Circle
**Audience:** Admin team, Marketing team, Customer Support
**Last updated:** August 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Loyalty Points — How Customers Earn](#2-loyalty-points--how-customers-earn)
3. [Loyalty Points — How Customers Redeem](#3-loyalty-points--how-customers-redeem)
4. [Tier System](#4-tier-system)
5. [Gift Cards — Lifecycle](#5-gift-cards--lifecycle)
6. [Common Customer Queries & Answers](#6-common-customer-queries--answers)
7. [Admin Actions Reference](#7-admin-actions-reference)
8. [Glossary](#8-glossary)

---

## 1. Overview

The Enchanted Circle is our loyalty programme integrated across the marketplace (web) and House of Spells outlet (POS). Customers earn points on purchases and engagement activities, then redeem them for discounts, free shipping, gift cards, raffle entries, and more.

Gift Cards are a separate system — digital or physical cards with a monetary balance that customers can use at checkout. They are also used as the payout mechanism when loyalty points are redeemed at the POS outlet.

### Key Numbers

| Parameter | Value |
|-----------|-------|
| Default earn rate | **1 point per £1 spent** |
| Point value | **£0.01 per point** (100 points = £1) |
| Minimum redemption | **100 points** |
| Points expiry | **24 months** from date earned |
| Gift card denominations | £25, £50, £100, £250, £500 |

---

## 2. Loyalty Points — How Customers Earn

### 2.1 Purchase Points (Automatic)

When a customer completes an order (web or POS), points are awarded automatically:

| Scenario | Earn Rate |
|----------|-----------|
| Standard purchase | 1 point per £1 spent |
| Vendor with custom earn rate | Vendor's configured rate per £1 |
| Vendor with loyalty disabled | No points earned |

**Tier multiplier** is applied on top of the base earn. For example, a Dragon Keeper tier member (2.0×) earning on a £50 order gets 100 points instead of 50.

**When points appear:** Points are credited when the order is marked as paid. For POS sales, points are credited when the sale is imported (typically within minutes).

### 2.2 Engagement Points (Automatic)

| Activity | Points | Limit |
|----------|--------|-------|
| Sign up / enrol in programme | 100 | Once |
| Complete profile | 50 | Once |
| Submit a product review | 25 | 3 per month |
| Submit a photo review | 50 | 3 per month |
| Share on social media | 10 | 5 per day |
| Refer a friend (referrer bonus) | 500 | Unlimited |
| Referred friend bonus | 200 | Once (on first purchase) |
| In-store check-in | 15 | 1 per day |
| Complete a quiz | 25 | 4 per month |
| Birthday bonus | 200 | Once per year (auto) |
| Membership anniversary | 150 | Once per year (auto) |
| Founding member bonus | 500 | Once (early registrants) |

### 2.3 Campaign & Bonus Points

- **Bonus Campaigns:** Admin-configured multipliers or flat bonuses active during a date range (e.g., "Double points weekend").
- **Brand Partnership Campaigns:** Boosted earn rates on specific brands.
- **Product Campaigns:** Extra points on specific products or categories.
- **Click & Collect Bonus:** Flat bonus points when customer chooses click & collect (if enabled).

### 2.4 Manual Adjustment (Admin Only)

Admins can manually add or deduct points from any member via **Admin > Loyalty > Members > Adjust Points**. A reason must be provided and the adjustment is logged in the transaction ledger.

### 2.5 Points Reversal

If a POS sale is voided, earned points are automatically clawed back via an adjustment transaction.

---

## 3. Loyalty Points — How Customers Redeem

### 3.1 At Marketplace Checkout (Web)

1. Customer adds items to cart and proceeds to checkout.
2. The **Loyalty Redemption Widget** appears if the customer is enrolled and has sufficient points.
3. Customer selects a reward from the catalogue:

| Reward | Points Required | Value |
|--------|----------------|-------|
| £1 Discount | 100 | £1 off order |
| £5 Discount | 500 | £5 off order |
| £10 Discount | 1,000 | £10 off order |
| Free Shipping Upgrade | 200 | Free shipping |
| Raffle Entry | 50 | Entry to prize draw |
| £5 Gift Card | 500 | £5 gift card code |
| £1 Charity Donation | 100 | Donated on their behalf |
| Early Access Pass | 300 | Early access to new releases |

4. Points are deducted and the discount is applied to the order total.
5. Customer completes payment for the remaining balance.

**Important:** Loyalty discount is applied *before* payment. The customer pays the reduced amount.

### 3.2 At POS Outlet (In-Store)

1. Staff looks up the customer using their loyalty card number, email, or phone via the POS loyalty lookup.
2. Staff initiates a **POS voucher redemption** — this converts loyalty points into a Lightspeed gift card.
3. The gift card is loaded onto the Lightspeed POS system.
4. Customer uses the gift card as payment for their in-store purchase.

**Amount limits:** Minimum £1, maximum £500 per voucher.

### 3.3 Via Rewards Catalogue (Direct API)

Customers can also redeem points through the loyalty rewards page at `/loyalty/rewards` on the website. Discount redemptions generate a one-time coupon code valid for 30 days.

---

## 4. Tier System

Members progress through tiers based on **total lifetime points earned** (not current balance):

| Tier | Level | Points Required | Earn Multiplier | Key Benefits |
|------|-------|----------------|-----------------|-------------|
| Initiate | 1 | 0 | 1.0× | Base earn rate |
| Spellcaster | 2 | 1,000 | 1.25× | — |
| Enchanter | 3 | 3,000 | 1.5× | Free shipping |
| Dragon Keeper | 4 | 7,500 | 2.0× | Early access (24h) |
| Archmage Circle | 5 | 15,000 | 2.5× | Event access, exclusive products |
| Council of Realms | 6 | Invite only | 3.0× | Personal shopper, all benefits |

- Tiers are reviewed weekly (Sunday 2:00 AM).
- Customers can only move **up** during a review — they never auto-downgrade.
- Council of Realms is **invite-only** and cannot be reached by points alone.

---

## 5. Gift Cards — Lifecycle

### 5.1 Types

| Type | Description |
|------|-------------|
| **Digital** | Code delivered electronically, usable at web checkout |
| **Physical** | Printed card with code, usable at web checkout |

### 5.2 How Gift Cards Are Created

- **Admin-issued:** Admin creates a card via Admin > Gift Cards > Issue New Card (specifies amount, type, optional recipient name/email, optional message).
- **Loyalty POS voucher:** When loyalty points are redeemed in-store, a Lightspeed gift card is automatically issued.

> **Note:** Customer self-purchase of gift cards through the website is planned but currently requires the payment-backed flow to be completed.

### 5.3 How Gift Cards Are Redeemed

1. Customer enters the gift card code on the **payment page** (after checkout, before payment).
2. System validates the code and applies the balance toward the order.
3. If the gift card covers the full order amount, no additional payment is needed.
4. If partial, customer pays the remainder via Stripe.
5. Gift card balance is decremented; status changes to `REDEEMED` when balance reaches £0.

### 5.4 Statuses

| Status | Meaning |
|--------|---------|
| **ACTIVE** | Card has remaining balance |
| **REDEEMED** | Balance fully used |
| **EXPIRED** | Past expiry date |
| **CANCELLED** | Admin-cancelled |

### 5.5 Refunds

If an order paid with a gift card is cancelled, the redeemed amount is automatically restored to the gift card balance.

Admins can also manually refund a gift card redemption via **Admin > Gift Cards > [Card] > Refund**.

### 5.6 POS Reconciliation

Every 6 hours, the system checks all POS-issued gift cards (loyalty vouchers) against Lightspeed to detect:
- Balance discrepancies
- Status mismatches
- Orphan cards (exist in Lightspeed but not in HOS)
- Missing cards (exist in HOS but not in Lightspeed)

Discrepancies are logged but **never auto-corrected** — they require manual review.

---

## 6. Common Customer Queries & Answers

### Points & Earning

**Q: "I made a purchase but didn't receive points."**
A: Check if:
1. The customer is enrolled in The Enchanted Circle (not just registered).
2. The order status is "Paid" — points are credited on payment, not order placement.
3. The vendor has loyalty enabled — some vendors opt out.
4. For POS purchases, the sale may still be syncing (allow up to 1 hour).

If all checks pass, admin can verify in **Admin > Loyalty > Transactions** and manually adjust if needed.

**Q: "How many points will I earn on this order?"**
A: Base rate is 1 point per £1 spent, multiplied by their tier multiplier. Check their tier on **Admin > Loyalty > Members > [Member]**. Active bonus campaigns may add more.

**Q: "My points expired, can they be restored?"**
A: Points expire after 24 months of inactivity. Expired points cannot be automatically restored. Admin can issue a manual adjustment as a goodwill gesture via **Admin > Loyalty > Members > Adjust Points** with an appropriate reason.

**Q: "How do I check my points balance?"**
A: Direct them to **My Account > The Enchanted Circle** on the website, or look up their balance in **Admin > Loyalty > Members**.

### Redemption

**Q: "I redeemed points but my discount wasn't applied."**
A: Check the order in **Admin > Orders** — look for `loyaltyPointsRedeemed` and `loyaltyDiscountAmount` fields. If points were burned but discount not applied, admin can issue a manual refund or credit.

**Q: "Can I redeem points in-store?"**
A: Yes — staff at the HOS outlet can convert loyalty points into a POS voucher (gift card) which is then used as payment. The minimum is £1 (100 points) and maximum is £500.

**Q: "I don't see the loyalty widget at checkout."**
A: The widget only appears if:
1. The customer is logged in and enrolled.
2. They have at least 100 points (minimum redemption).
3. Checkout loyalty redemption is enabled (`LOYALTY_REDEMPTION_AT_CHECKOUT`).

### Gift Cards

**Q: "My gift card code isn't working."**
A: Ask for the code and check via **Admin > Gift Cards**. Common issues:
1. Code expired — check `expiresAt`.
2. Code already fully redeemed — check balance.
3. Code cancelled by admin.
4. Typo in code — codes are in `XXXX-XXXX-XXXX-XXXX` format.

**Q: "Can I check my gift card balance?"**
A: Logged-in customers can see their cards at **My Account > Gift Cards**. The public validation endpoint confirms if a code is valid but does not reveal the balance (security measure).

**Q: "My order was cancelled, will I get my gift card balance back?"**
A: Yes — gift card balance is automatically restored when an order is cancelled.

**Q: "Can I combine a gift card with loyalty points?"**
A: Yes — loyalty discount is applied at checkout (reducing the order total), then the gift card is applied on the payment page against the remaining balance.

### Tiers

**Q: "How do I check my tier / move to the next tier?"**
A: Direct them to the Loyalty dashboard at `/loyalty` which shows tier progress. Tiers are based on total lifetime points earned, not current balance.

**Q: "I spent enough but my tier didn't upgrade."**
A: Tiers are reviewed weekly on Sundays. The upgrade will happen at the next review. Admin can verify their `totalPointsEarned` in **Admin > Loyalty > Members**.

---

## 7. Admin Actions Reference

| Action | Path | Who Can Do It |
|--------|------|---------------|
| View loyalty dashboard | Admin > Loyalty | Admin |
| Adjust member points | Admin > Loyalty > Members > Adjust | Admin |
| Edit earn rules | Admin > Loyalty > Earn Rules | Admin |
| Edit redemption options | Admin > Loyalty > Redemption Options | Admin |
| Create/edit bonus campaigns | Admin > Loyalty > Campaigns | Admin |
| Edit tiers | Admin > Loyalty > Tiers | Admin |
| View all transactions | Admin > Loyalty > Transactions | Admin |
| Issue a gift card | Admin > Gift Cards > Issue New | Admin |
| View gift card details | Admin > Gift Cards > [Card] | Admin |
| Refund gift card | Admin > Gift Cards > [Card] > Refund | Admin |
| Toggle feature flags | Admin > Feature Flags | Admin |
| View loyalty analytics | Admin > Loyalty Analytics | Admin |
| POS loyalty lookup | POS terminal (staff auth) | Staff |
| POS voucher redemption | POS terminal (staff auth) | Staff |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **The Enchanted Circle** | The loyalty programme name |
| **Earn** | Points added to a member's balance |
| **Burn** | Points deducted when redeeming a reward |
| **Tier multiplier** | Factor applied to purchase earn (e.g., 2.0× = double points) |
| **POS voucher** | A Lightspeed gift card created from loyalty point redemption |
| **Idempotency key** | Unique token that prevents duplicate transactions |
| **Wallet** | Internal ledger tracking all point additions/deductions |
| **Bonus campaign** | Time-limited multiplier or flat bonus on point earning |
| **Click & Collect** | Order online, pick up in-store |
| **Founding member** | Early registrant who received a one-time bonus |
| **Fandom profile** | Auto-computed interest profile based on purchase/browse history |

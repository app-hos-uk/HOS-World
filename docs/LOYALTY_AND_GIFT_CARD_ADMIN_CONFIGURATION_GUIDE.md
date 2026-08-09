# Loyalty & Gift Card — Admin Configuration Guide

**Audience:** Admin team
**Last updated:** August 2026

---

## Table of Contents

1. [Pre-requisites & Feature Flags](#1-pre-requisites--feature-flags)
2. [Loyalty Configuration Flow](#2-loyalty-configuration-flow)
3. [Gift Card Configuration Flow](#3-gift-card-configuration-flow)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Pre-requisites & Feature Flags

Before configuring loyalty or gift cards, ensure the required feature flags and environment variables are enabled.

> **Business rules live in Admin, not env.** Earn rate, redeem value, minimum redemption,
> expiry, card prefix, checkout redemption, POS voucher limits, gift-card denominations, and
> the returns-reversal policy are all editable at **Admin > Loyalty > Settings**
> (`/admin/loyalty/settings`), which also shows the effective runtime state of every gate.
> Saved values override the environment variables listed in section 4; the env values are
> only the fallback when no settings have been saved. The kill switches below
> (`LOYALTY_ENABLED`, `POS_ENABLED`, and their feature flags) remain env + flag only.
>
> **How fast a save takes effect:** a save is published to the shared cache and every API
> instance picks it up within `LOYALTY_SETTINGS_CACHE_TTL_MS` (default 2 seconds), so you do
> not need to redeploy or restart. Expect a couple of seconds, not instant, when several API
> instances are running.

### 1.1 Enable Loyalty Programme

**Step 1 — Feature Flag:**
1. Navigate to **Admin > Feature Flags** (`/admin/feature-flags`).
2. Find `LOYALTY_PROGRAMME` and set it to **Enabled**.
3. This is the master switch — nothing loyalty-related works without it.

**Step 2 — Environment Variable:**
- Ensure `LOYALTY_ENABLED=true` is set in the API environment (Railway > API service > Variables).
- Both the feature flag AND the env var must be on.

**Step 3 — Frontend Flag:**
- Set `NEXT_PUBLIC_LOYALTY_ENABLED=true` in the web app environment so the customer-facing UI renders.

### 1.2 Additional Feature Flags

| Flag | Purpose | Required For |
|------|---------|-------------|
| `LOYALTY_PROGRAMME` | Master loyalty switch | All loyalty features |
| `POS_INTEGRATION` | POS earn + voucher + recon | In-store loyalty, POS vouchers |
| `FOUNDING_MEMBERS` | Founding member bonus | Signup bonus for early users |
| `BRAND_PARTNERSHIPS` | Brand-specific earn boosts | Brand campaigns |
| `AMBASSADOR_PROGRAMME` | Ambassador/UGC features | Ambassador profiles |

### 1.3 Gift Card Pre-requisites

Gift cards have **no feature flag** — they are always available via the API once the API is running. No special configuration is needed beyond the default environment variables.

---

## 2. Loyalty Configuration Flow

### 2.1 Configure Tiers

**Path:** Admin > Loyalty > Tiers (`/admin/loyalty/tiers`)

Tiers define customer levels and earn multipliers. The system ships with 6 default tiers.

**To edit a tier:**
1. Click on the tier row.
2. Editable fields:
   - **Name** — Display name (e.g., "Dragon Keeper")
   - **Level** — Sort order (1 = lowest)
   - **Points Threshold** — Lifetime points needed to reach this tier
   - **Multiplier** — Earn rate multiplier (e.g., 2.0 = double points)
   - **Invite Only** — If checked, tier is not auto-assigned by points
   - **Icon / Color** — Visual branding for the tier
   - **Benefits (JSON)** — Structured benefits:
     ```json
     {
       "freeShipping": true,
       "earlyAccessHours": 24,
       "eventAccess": true,
       "personalShopper": false,
       "exclusiveProducts": true
     }
     ```
3. Click **Save**.

**Tier review schedule:** Tiers are recalculated every Sunday at 2:00 AM (`LOYALTY_TIER_REVIEW_CRON`). Customers only move up, never down.

> **Caution:** Changing a tier's points threshold affects future assignments. Existing members at that tier are not downgraded.

---

### 2.2 Configure Earn Rules

**Path:** Admin > Loyalty > Earn Rules (`/admin/loyalty/earn-rules`)

Earn rules define how customers accumulate points.

**To create/edit an earn rule:**
1. Click **Add Rule** or click an existing rule.
2. Fields:
   - **Action** — The trigger event. Standard actions:
     - `PURCHASE` — Points on orders
     - `SIGNUP` — Enrolment bonus
     - `PROFILE_COMPLETE` — Profile completion
     - `REVIEW` / `PHOTO_REVIEW` — Product reviews
     - `SOCIAL_SHARE` — Social sharing
     - `REFERRAL_REFERRER` / `REFERRAL_REFEREE` — Referral bonuses
     - `BIRTHDAY` / `ANNIVERSARY` — Annual bonuses
     - `CHECK_IN` — In-store check-in
     - `QUIZ` — Quiz completion
   - **Name** — Human-readable label
   - **Points Amount** — Number of points awarded
   - **Points Type** — `FIXED` (flat amount) or `PER_CURRENCY_UNIT` (per $1)
   - **Is Active** — Toggle to enable/disable without deleting
   - **Max Per Period** — Optional limit (e.g., 3 reviews per month)
3. Click **Save**.

**Common configuration scenarios:**

| Goal | Action |
|------|--------|
| Change base earn rate from 1pt/$1 to 2pt/$1 | Edit `PURCHASE` rule → set Points Amount to `2` |
| Disable review rewards | Edit `REVIEW` and `PHOTO_REVIEW` rules → uncheck Is Active |
| Increase signup bonus to 200 | Edit `SIGNUP` rule → set Points Amount to `200` |
| Add a new earn activity | Create new rule with a custom action name |

---

### 2.3 Configure Redemption Options

**Path:** Admin > Loyalty > Redemption Options (`/admin/loyalty/redemption-options`)

These are the rewards customers can redeem their points for.

**To create/edit a redemption option:**
1. Click **Add Option** or click an existing option.
2. Fields:
   - **Name** — Display name (e.g., "$5 Discount")
   - **Type** — Reward type:
     - `DISCOUNT` — Money off order (generates coupon code)
     - `FREE_SHIPPING` — Shipping cost waived
     - `RAFFLE` — Entry into a prize draw
     - `GIFT_CARD` — Gift card code issued
     - `CHARITY` — Donation on customer's behalf
     - `EARLY_ACCESS` — Access to upcoming products
   - **Points Cost** — How many points the reward costs
   - **Value** — Monetary value (for DISCOUNT/GIFT_CARD/CHARITY types)
   - **Is Active** — Toggle availability
3. Click **Save**.

**Checkout integration:** Only `DISCOUNT` and `FREE_SHIPPING` types are applied directly at checkout via the loyalty widget. Other types are redeemed from the rewards catalogue page.

**A `DISCOUNT` option must have a Value.** Redeeming it from the rewards catalogue issues a real one-use coupon (a `FIXED_DISCOUNT` promotion plus its code, valid 30 days) that the normal checkout coupon validator accepts. If the coupon cannot be created the whole redemption is refused and the member keeps their points, so an option saved with an empty Value fails at redemption rather than handing out a dead code. Applying the same reward *at* checkout takes the money off that order directly and issues no coupon, so the reward is never given twice.

**Reward codes belong to one account.** Each code is locked to the member who spent the points, so a shared or leaked code is refused for anyone else. Reward promotions are also code-only: because they carry a coupon, the automatic promotion engine never applies them to a cart on its own. The same now holds for any admin-created promotion that has coupon codes — it only discounts a cart when someone enters the code.

---

### 2.4 Configure Bonus Campaigns

**Path:** Admin > Loyalty > Campaigns (`/admin/loyalty/campaigns`)

Campaigns provide temporary earn boosts (e.g., "Double points Black Friday").

**To create a campaign:**
1. Click **Add Campaign**.
2. Fields:
   - **Name** — Campaign title
   - **Multiplier** — Earn multiplier during the campaign (e.g., 2.0 = double)
   - **Flat Bonus** — Additional flat points per qualifying transaction
   - **Start Date / End Date** — Active period
   - **Is Active** — Master toggle
3. Click **Save**.

Campaigns stack with tier multipliers. Example: A Spellcaster (1.25×) during a 2× campaign earns 2.5× base rate.

---

### 2.5 Manage Members

**Path:** Admin > Loyalty > Members (`/admin/loyalty/members`)

**Available actions:**
- **Search** by name, email, or membership ID
- **View** member details: balance, tier, total earned, transaction history
- **Adjust points** — Add or deduct points with a reason
- **Delete** membership (irreversible — removes all loyalty data for the user)

**To adjust points:**
1. Find the member and click their row.
2. Click **Adjust Points**.
3. Enter amount (positive to add, negative to deduct) and a reason.
4. Click **Confirm**. The adjustment appears immediately in their transaction ledger.

A negative adjustment also lowers lifetime earned points, which is what tiers are based on — so correcting an over-award can move the member down a tier. A positive adjustment raises it and can promote them.

---

### 2.6 View Transactions

**Path:** Admin > Loyalty > Transactions (`/admin/loyalty/transactions`)

The full ledger of all loyalty transactions across all members. Filter by:
- Transaction type: `EARN`, `BURN`, `EXPIRE`, `ADJUST`, `BONUS`, `TRANSFER`
- Date range
- Member

---

### 2.7 Configure POS Loyalty (In-Store)

**Pre-requisites:**
- `POS_INTEGRATION` feature flag enabled
- `LOYALTY_POS_VOUCHER_ENABLED=true` in API environment
- Lightspeed POS connection configured

**Staff workflow:**
1. Staff authenticates via API key or admin JWT.
2. Lookup customer → `POST /loyalty/lookup` (by email, phone, or card number).
3. Redeem points for voucher → `POST /loyalty/pos/redeem-for-voucher`.
4. Lightspeed gift card is created and loaded with the voucher value.
5. Customer uses the gift card at the register.

**POS voucher limits:**
- `POS_GIFT_CARD_MIN_AMOUNT` — Default: $1
- `POS_GIFT_CARD_MAX_AMOUNT` — Default: $500

---

### 2.8 Loyalty Analytics

**Path:** Admin > Loyalty Analytics (`/admin/loyalty-analytics`)

Six dashboard views:
1. **Health** — Active members, earn/burn rates, retention
2. **CLV** — Customer lifetime value metrics
3. **Fandom Trends** — Points activity by franchise/fandom
4. **Attribution** — Points sources (web vs POS, campaigns)
5. **Channels** — Breakdown by earn channel
6. **Tiers** — Tier distribution and progression

---

## 3. Gift Card Configuration Flow

### 3.1 Issue a Gift Card

**Path:** Admin > Gift Cards (`/admin/gift-cards`)

1. Click **Issue New Card**.
2. Fields:
   - **Amount** — Card value (any amount)
   - **Type** — `digital` or `physical`
   - **Recipient Name** — Optional
   - **Recipient Email** — Optional (for digital delivery)
   - **Message** — Optional personal message
   - **Expiry Date** — Optional
3. Click **Create**.
4. The system generates a unique code in `XXXX-XXXX-XXXX-XXXX` format.

### 3.2 View & Manage Gift Cards

**Path:** Admin > Gift Cards (`/admin/gift-cards`)

**Filter by:**
- Status: `ACTIVE`, `REDEEMED`, `EXPIRED`, `CANCELLED`
- Type: `digital`, `physical`

**Per-card actions:**
- **View transactions** — See all purchases, redemptions, refunds
- **Refund** — Restore balance for a specific order redemption. Pick the order from the
  dropdown (only orders with an unrefunded redemption appear) and confirm the amount. The cap is
  everything that card redeemed against that order, minus anything already refunded — so a card
  used twice on one order can be refunded in full.

### 3.3 Gift Card Catalogue Configuration

Set the customer-visible denominations and currency at **Admin > Loyalty > Settings**
(“Gift card catalogue”). Saved values take effect within about 15 seconds, without a redeploy.

If no settings have been saved, the API falls back to the environment:

```
GIFT_CARD_CATALOG_AMOUNTS=25,50,100,250,500
GIFT_CARD_DEFAULT_CURRENCY=USD
```

---

## 4. Environment Variables Reference

Variables marked **(Settings)** are overridden by **Admin > Loyalty > Settings** whenever
settings have been saved; the values here are the fallback only.

### Loyalty

| Variable | Default | Description |
|----------|---------|-------------|
| `LOYALTY_ENABLED` | `true` | Runtime switch (combine with feature flag) |
| `LOYALTY_DEFAULT_EARN_RATE` | `1` | **(Settings)** Points per $1 spent (fallback) |
| `LOYALTY_DEFAULT_REDEEM_VALUE` | `0.01` | **(Settings)** $ per point on redemption |
| `LOYALTY_MIN_REDEMPTION_POINTS` | `100` | **(Settings)** Minimum points to redeem |
| `LOYALTY_POINTS_EXPIRY_MONTHS` | `24` | **(Settings)** Months before points expire (0 = no expiry) |
| `LOYALTY_CARD_PREFIX` | `HOS` | **(Settings)** Prefix for digital loyalty card numbers |
| `LOYALTY_REDEMPTION_AT_CHECKOUT` | `true` | **(Settings)** Show redemption widget at checkout |
| `LOYALTY_POS_VOUCHER_ENABLED` | `false` | **(Settings)** Allow POS voucher creation |
| `LOYALTY_SIGNUP_BONUS` | (from seed) | Override signup bonus points |
| `CC_BONUS_POINTS` | `0` | Flat bonus for click & collect |
| `FOUNDING_MEMBER_BONUS_POINTS` | `500` | Founding member one-time bonus |
| `LOYALTY_SETTINGS_CACHE_TTL_MS` | `2000` | How long each API instance holds the resolved settings before re-reading (bounds save propagation) |
| `LOYALTY_TIER_REVIEW_CRON` | `0 2 * * 0` | Weekly tier recalculation |
| `LOYALTY_EXPIRY_CRON` | `0 3 * * *` | Daily points expiry sweep (uses the Settings expiry months) |
| `LOYALTY_BIRTHDAY_CRON` | (configured) | Birthday bonus job schedule |
| `UNPAID_ORDER_TTL_MINUTES` | `60` | Age at which abandoned unpaid/failed orders are cancelled, releasing points burned at checkout |

### Gift Cards

| Variable | Default | Description |
|----------|---------|-------------|
| `GIFT_CARD_CATALOG_AMOUNTS` | `25,50,100,250,500` | **(Settings)** Customer-facing denominations |
| `GIFT_CARD_DEFAULT_CURRENCY` | `USD` | **(Settings)** Default currency for new cards |
| `POS_GIFT_CARD_MIN_AMOUNT` | `1` | **(Settings)** Minimum POS voucher amount |
| `POS_GIFT_CARD_MAX_AMOUNT` | `500` | **(Settings)** Maximum POS voucher amount |
| `POS_GIFT_CARD_RECON_CRON` | `0 */6 * * *` | POS reconciliation schedule |

### Per-Store Settings (Database)

| Field | Default | Description |
|-------|---------|-------------|
| `Store.loyaltyRedeemValue` | `0.01` | Per-store override for POS voucher value |

### Per-Vendor Settings (Database)

| Field | Default | Description |
|-------|---------|-------------|
| `Seller.loyaltyEnabled` | `true` | Whether purchases from this vendor earn points |
| `Seller.loyaltyEarnRate` | `null` | Custom earn rate (overrides default) |
| `Seller.loyaltyFundingModel` | `PLATFORM_FUNDED` | Who funds the loyalty cost |

---

## 5. Troubleshooting

### "Loyalty widget not showing at checkout"

1. Check `LOYALTY_REDEMPTION_AT_CHECKOUT=true` in API env.
2. Check `NEXT_PUBLIC_LOYALTY_ENABLED=true` in web env.
3. Check `LOYALTY_PROGRAMME` feature flag is enabled.
4. Ensure customer is enrolled (has a `LoyaltyMembership` record).
5. Ensure customer has ≥ 100 points.

### "Points not being earned on orders"

1. Verify `LOYALTY_ENABLED=true` + `LOYALTY_PROGRAMME` flag.
2. Check if the vendor has `loyaltyEnabled=false` (Admin > Vendors).
3. Check if there's an active `PURCHASE` earn rule.
4. Verify order status is `PAID`.

### "POS voucher creation failing"

1. Check `LOYALTY_POS_VOUCHER_ENABLED=true`.
2. Check `POS_INTEGRATION` feature flag.
3. Verify Lightspeed POS connection is active.
4. Check staff auth (API key or admin JWT).
5. Check POS voucher amount is within min/max limits.

### "A voucher is stuck on FAILED — the member's points went out but no gift card exists"

1. Go to **Admin > Loyalty > POS Vouchers** (`/admin/loyalty/pos-vouchers`) and filter by `FAILED`.
   The row shows the last Lightspeed error.
2. Fix the underlying cause first (POS connection inactive, Lightspeed outage, credentials).
3. Press **Retry issuance**. The same gift-card number and idempotency key are reused, so
   Lightspeed cannot be double-funded, and points are re-debited only if the original burn was
   already reversed.
4. If the retry succeeds the status becomes `ISSUED`; the member can spend the card at the till.

### "Finance needs the points ledger for a period"

1. Go to **Admin > Loyalty > Points Transactions** (`/admin/loyalty/transactions`).
2. Set the **From** / **To** dates and, optionally, a transaction type.
3. Export **CSV** (or Excel). Rows include member email, card number, points, running balance,
   source, channel, store and the idempotency key for audit.
4. For one member, use the same export on their ledger page
   (`/admin/loyalty/members/<userId>`), which exports every transaction for that member.
5. Very large ranges are capped per export — narrow the dates and export month by month.

### "A loyalty reward coupon code is rejected at checkout"

1. Codes look like `HOS-LYL-XXXXXXXX` and are one use, valid 30 days from redemption.
2. Codes issued before August 2026 have no coupon record behind them and will never work — adjust
   the member's points back and let them redeem again, or issue a gift card instead.
3. Otherwise check the promotion in Admin > Promotions: it must still be `ACTIVE` and unexpired,
   and the code must be unused.
4. "This coupon belongs to another account" means the code is being entered by someone other than
   the member who redeemed it. Reward codes are not transferable — if the reward was meant as a
   gift, issue a gift card instead.

### "A refund settled later — did the stock come back?"

Yes. When Stripe confirms a refund after the fact (the inline attempt was pending or failed), the
webhook completes the return, restocks the returned lines, reverses influencer commission and moves
the order. Partial returns keep their order status and only flip payment status to `REFUNDED`.
Returns that settled this way *before* August 2026 were never restocked — check stock on those.

### "A voided POS sale did not take all the points back"

The clawback is capped at the member's current balance, because the sale cannot be left half-voided
just because the points were already spent. The ledger records what was requested and what was
actually taken, and a warning is logged with the shortfall. Use **Adjust Points** if the remainder
needs recovering later.

### "Gift card code rejected at checkout"

1. Look up code in Admin > Gift Cards.
2. Check status — must be `ACTIVE`.
3. Check balance — must have remaining funds.
4. Check expiry date.
5. If card was assigned to a different user, it cannot be transferred.

### "Tier not updating"

1. Tiers update weekly on Sundays. Wait for the next review cycle.
2. Check `totalPointsEarned` (not current balance) against tier thresholds.
3. Admin can trigger a manual recompute via the API if urgent.

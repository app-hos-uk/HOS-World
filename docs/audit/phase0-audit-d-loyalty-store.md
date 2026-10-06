# Phase 0 Audit D — Loyalty System and Store Model

Audit date: 2026-10-06. Scope is the current House of Spells API loyalty programme, store model, ship-from-store, founding members, and loyalty analytics. This is a read-only findings report. No code was changed.

There is no method named `processOrder()`. Web earn is `LoyaltyEarnEngine.processOrderComplete()`. `LoyaltyService.processOrderComplete()` is a one-line delegate at `services/api/src/loyalty/loyalty.service.ts:1380`.

---

## 1. Current Loyalty Earn Flow

Runtime gate for every earn path: `isLoyaltyRuntimeEnabled()` (`LOYALTY_ENABLED` env and `LOYALTY_PROGRAMME` feature flag). If either is off, both web and POS return immediately and award nothing (`earn.engine.ts:692-695`, `1032-1035`).

Points are a single integer wallet on `LoyaltyMembership`. There is no currency conversion. A US dollar and a Malaysian ringgit both multiply by the same earn rate.

### 1.1 Web order — `processOrderComplete(orderId)`

Entry: payment / order-complete callers, plus click-and-collect (`click-collect.service` calls this). Implementation: `services/api/src/loyalty/engines/earn.engine.ts:692-1030`.

| Step | What happens | Lines |
|---|---|---|
| 1 | Load the parent order (`parentOrderId: null`) with items, product, product.seller, user, click-collect. Child seller orders are ignored. | 697-708 |
| 2 | Bail if no `userId`, no items, or `order.loyaltyPointsEarned > 0` (idempotent stamp). | 710-711 |
| 3 | Qualifying subtotal = sum of line `price * quantity`, excluding gift-card lines (`qualifying-amount.ts:38-63`). | 713-720 |
| 4 | `ensureMembershipForUser(userId, 'WEB')`. No store id. Deactivated members get `null` and the order is stamped with qualifying subtotal only. | 722-728, 56-130 |
| 5 | Load the single `LoyaltyEarnRule` where `action = 'PURCHASE'` (`action` is globally unique). Load platform default earn rate from loyalty settings, else `LOYALTY_DEFAULT_EARN_RATE`. Read `HOS_SELLER_ID`. | 731-735 |
| 6 | For each line, resolve seller, compute base points, skip disabled sellers and non-positive points. Collect product/fandom/brand/category for campaign boosts. | 749-781 |
| 7 | Region = `membership.regionCode` else `user.country` else platform country. Campaigns via `getActiveForContext(region, 'WEB')` — **no storeId**, so store-scoped campaigns never match web. | 783-787 |
| 8 | Threshold bonus: `(qualifyingSubtotal - threshold) * earnRate * pointsPerDollar` from live `% of qualifying` campaigns, or from programme settings if none are live. | 286-296, 787 |
| 9 | If base and threshold are both zero, stamp `loyaltyPointsEarned = 0` and return. | 789-799 |
| 10 | Best campaign multiplier + sum of flat bonuses (`applyCampaignsToBasePoints`). `SIGNUP_BONUS` and `PERCENTAGE_OF_QUALIFYING` are excluded here. | 802-810, `campaign.service.ts:56-81` |
| 11 | Optional partner-referral multiplier, then tier multiplier (`LoyaltyTier.multiplier`, unless the PURCHASE rule sets `multiplierStack = false`). | 812-837 |
| 12 | Brand boost and product-campaign boost, plus click-and-collect flat bonus (`CC_BONUS_POINTS`) when a C&C row exists and has not already been flagged. | 841-880 |
| 13 | One wallet transaction per slice: threshold bonus, `PURCHASE`, `BRAND_CAMPAIGN`, `PRODUCT_CAMPAIGN` (one row per campaign). Idempotency keys `earn:{source}:{orderId}:{campaign}`. | 891-980 |
| 14 | Increment `totalPointsEarned`, `totalSpend` (order subtotal), `purchaseCount`. Always stamp `order.loyaltyPointsEarned` with the **computed** total, not the amount the wallet actually applied. | 991-1010 |
| 15 | Outside the transaction: brand reconcile, attach referral first order, `recalculateTier`. Errors are logged and **swallowed** (order stays at 0 points so a later call can retry). | 1021-1028 |

Seller id written on the wallet row is `primarySellerId` only when every earning line resolved to the **same** seller (`848`). Multi-seller carts store the list in metadata and leave `sellerId` null.

### 1.2 POS sale — `processPosSale(posSaleId)`

Callers (all go through this one method):

- `PosSalesImportService.importParsedSale` after insert (`sales-import.service.ts:653-654`)
- Retry when an existing sale is still `IMPORTED` (`610-613`)
- Retro-link of unattributed Lightspeed customers (`521-524`)
- Sale-link backfill (`285-292`)
- `LoyaltyService.linkUnattributedPosSalesForUser` after enroll (`loyalty.service.ts:351-354`)

Implementation: `earn.engine.ts:1032-1371`.

Differences from web:

| | Web | POS |
|---|---|---|
| Source row | `Order` (parent only) | `POSSale` + `store` |
| Customer | `order.userId` | `sale.customerId` (null until identity match — no earn) |
| Channel | `'WEB'` | `'HOS_OUTLET_POS'` |
| Store | Never passed | `sale.storeId` on membership auto-enroll, campaigns, and every wallet row |
| Line amount for **base points** | `price * quantity` | `unitPrice * quantity` (ignores `totalPrice` and discounts) |
| Qualifying subtotal | `price * quantity` | `totalPrice` when present (`qualifying-amount.ts:50-54`) |
| Unmapped products | Line skipped | If **no** line earned and **no** seller opted out, fallback earns on `totalAmount - taxAmount` (`1118-1132`) |
| Click & collect | Optional bonus | None |
| Idempotency stamp | `Order.loyaltyPointsEarned` | `POSSale.loyaltyPointsEarned` |
| Failure | Logged, not rethrown | **Rethrown** so import leaves the sale `IMPORTED` and retries (`1364-1369`) |
| Store type / anchor | Not consulted | **Not consulted.** Any store with a linked customer earns. |

Campaign context: `getActiveForContext(region, 'HOS_OUTLET_POS', sale.storeId)` (`1137-1141`). Region is still membership region, not `Store.marketId` or `POSSale.marketId`. `POSSale.marketId` exists on the schema (`schema.prisma:4408`) but sales import never writes it.

Void clawback: `reversePosSaleEarn` (`1381-1457`) debits `min(earned, currentBalance)`, source `POS_SALE_VOID`, decrements `purchaseCount`, zeroes `loyaltyPointsEarned`. It does **not** decrement `totalSpend`.

### 1.3 Point formula (both channels)

`computeLinePoints` (`351-388`):

1. If `seller.loyaltyEnabled` and `seller.loyaltyEarnRate` is set → `itemTotal * seller.loyaltyEarnRate`.
2. Else if the global PURCHASE rule is active and `pointsType = PER_CURRENCY_UNIT` → `itemTotal * pointsAmount`.
3. Else if the PURCHASE rule is active (fixed) → `pointsAmount * quantity`.
4. Else if seller loyalty is on, or platform default rate is `> 0` → `itemTotal * platformDefaultRate`.
5. Else 0, and the line is counted as a disabled-seller skip.

Then, in order: best campaign multiplier, sum of flat campaign bonuses, partner multiplier, brand boost, product-campaign boost, tier multiplier (Decimal half-up). Threshold bonus is a **separate** wallet line and is not multiplied by the tier.

Default settings rate is **1 point per currency unit** when `LOYALTY_DEFAULT_EARN_RATE` is unset (`loyalty-settings.service.ts:94`, env warning at `env.validation.ts:207-208`).

### 1.4 Campaign matching — `getActiveForContext(region, channel, storeId)`

`services/api/src/loyalty/services/campaign.service.ts:15-43`.

A `LoyaltyBonusCampaign` matches when all of these hold:

- `isActive`, `brandCampaignId` is null (brand campaigns are applied by `BrandPartnershipsService`, not this query)
- `startsAt <= now <= endsAt`
- Region: `regionCodes` empty (global) **or** contains `regionCode`
- Channel: `channelCodes` empty **or** overlaps aliases from `enrollmentChannelAliases` (`signup-bonus.ts:5-12`). `POS` and `HOS_OUTLET_POS` are aliases of each other. `AUTO_PURCHASE` aliases to `WEB` and `AUTO_PURCHASE`.
- Store: if `storeId` is passed, campaign `storeIds` is empty **or** contains that store. If `storeId` is omitted (web earn), only campaigns with **empty** `storeIds` match. A Times Square campaign cannot leak onto the website.

`applyCampaignsToBasePoints` (`56-81`) keeps the highest multiplier and **adds** every matching campaign’s `bonusPoints`. Only the winning multiplier’s campaign id is stored on the PURCHASE wallet row.

Signup awards use a different function, `resolveSignupCampaignAward`: the highest `SIGNUP_BONUS` campaign replaces the SIGNUP earn-rule amount. Those campaigns are stripped out of purchase earn (`signup-bonus.ts:35-37`).

Brand and product campaigns filter `regionCodes` themselves (`brand-partnerships.service.ts:545`, `product-campaigns.service.ts:257`). They are not market-aware.

### 1.5 Auto-enroll inside earn

`ensureMembershipForUser` (`earn.engine.ts:56-130`):

- Lookup `loyaltyMembership` by `userId` (global unique).
- `DEACTIVATED` → no earn.
- Only `UserRole.CUSTOMER`.
- Tier slug `initiate`, created on the fly if missing.
- Card `{LOYALTY_CARD_PREFIX default HOS}-{8 hex}-{4 hex}`.
- `regionCode = user.country || platform country`. `preferredCurrency = user.currencyPreference || platform currency`.
- `enrollmentChannel` is hard-coded `'AUTO_PURCHASE'` even for POS. The `channel` argument is used only for the signup-bonus campaign lookup.
- Signup bonus is awarded in the same call. Web (`channel = 'WEB'`) defers until email is verified when `DEFER_SIGNUP_BONUS` is not `'false'`. POS channel `'HOS_OUTLET_POS'` does **not** defer.

---

## 2. Seller Resolution Analysis

Exact function: `resolveSellerForItem` (`earn.engine.ts:470-498`).

```
active VendorProduct (status ACTIVE, highest vendorStock)
        ↓ if none
product.sellerId
        ↓ if none
product.isPlatformOwned && HOS_SELLER_ID ? HOS_SELLER_ID : null
        ↓ if still null
return null
```

The caller then substitutes a synthetic seller when resolution returns null (`753-755` web, `1086-1090` POS):

```ts
{ id: null, loyaltyEnabled: true, loyaltyEarnRate: null }
```

So a missing seller does **not** block customer points. It forces the platform PURCHASE rule / default rate and records no `sellerId`.

### 2.1 `Product.sellerId = null` and `isPlatformOwned = true`

`Product` (`schema.prisma:655-659`): `sellerId` is optional, `isPlatformOwned Boolean @default(false)`.

| VendorProduct | HOS_SELLER_ID | Result |
|---|---|---|
| Active row exists | anything | **Vendor seller wins**, even if the product is platform-owned. That seller’s `loyaltyEnabled` / `loyaltyEarnRate` is used. |
| None | Set to a real seller id | That seller’s loyalty flags are used. Wallet `sellerId` is set only if every earning line shares that id. |
| None | Unset or `''` | `resolveSellerForItem` returns null. Synthetic seller with `loyaltyEnabled: true`. Customer still earns at the platform rate. No seller credit. |

### 2.2 `HOS_SELLER_ID`

- Read only in the earn engine (`735`, `1068`) as `config.get('HOS_SELLER_ID') || ''`.
- Empty string is falsy, so the platform-owned branch is skipped.
- Env validation **warns and does not throw** when loyalty is on and the variable is missing (`env.validation.ts:203-206`).
- The earn engine does **not** call `PlatformSellerService`. That service (`stores/platform-seller.service.ts:25-44`) falls back from the env id to an existing `SellerType.PLATFORM_RETAIL` seller, or creates one. Stores and POS onboarding use it. Loyalty earn does not. Unset env therefore means “no seller attribution” in loyalty and “find or create platform retail” everywhere else.
- If the env id points at a seller with `loyaltyEnabled = false`, no seller rate, no active PURCHASE rule, and default rate `0`, the line is skipped (`387`).

### 2.3 Impact of “all products become marketplace-owned”

Customer earn does not stop. What changes is **who is credited** and **which rate applies**:

1. Leaving `VendorProduct` rows `ACTIVE` keeps third-party seller rates in front of `isPlatformOwned`. The ownership migration must deactivate or ignore those rows inside `resolveSellerForItem`, or vendor stock will keep winning.
2. Nulling `sellerId` and setting `isPlatformOwned` without `HOS_SELLER_ID` still earns, via the synthetic seller, at the global PURCHASE rule. Seller-funded vs platform-funded (`Seller.loyaltyFundingModel`) is never read by the earn engine. Funding is not enforced here.
3. `primarySellerId` becomes the platform seller on every line once resolution is uniform, so wallet `sellerId` will finally be populated. Today mixed carts leave it null.
4. Web earn has no store and no anchor concept. Marketplace ownership does not change the web path unless seller resolution itself changes the rate.

Recommended resolution order after the ownership change:

1. If `isPlatformOwned` (or `sellerId` is null), use the platform retail seller (`PlatformSellerService`, not a raw env string).
2. Do not consult `VendorProduct` for platform-owned products.
3. Keep the synthetic fallback so a missing platform seller cannot zero out customer points.

---

## 3. Anchor Store Gating Plan

`Store` has no `isAnchorStore`. Closest fields today: `storeType` string default `"STANDARD"` with a comment `FLAGSHIP, STANDARD, POP_UP, CONCESSION` (`schema.prisma:372`), `isActive`, `sellerId`, `marketId`. None of them gate loyalty or shipping.

POS earn and ship-from-store are separate. Ship-from-store does **not** award points. Points are awarded when the Lightspeed sale is imported. Gating shipping does not gate earn, and gating earn does not gate shipping.

### 3.1 Where to add the check (minimum disruption)

**Earn — one choke point.** At the top of `processPosSale`, after the sale and store are loaded (`1037-1045`) and after the existing `loyaltyPointsEarned > 0` guard:

```
if (!sale.store.isAnchorStore) {
  // do not auto-enroll, do not award
  stamp loyaltyPointsEarned = 0 if you need a terminal state
  return
}
```

Returning normally (not throwing) lets `importParsedSale` mark the sale `PROCESSED` (`655-658`), so non-anchor tills are not retried forever. Do this **before** `ensureMembershipForUser`, or concession sales will create Enchanted Circle memberships.

Do not add the check in sales import. Retro-link, backfill, and enroll-link all call `processPosSale` directly and would bypass an import-only gate.

`reversePosSaleEarn` must keep working for sales that earned before a store was unmarked as anchor. Do not gate the clawback.

**Ship-from-store — one choke point.** `createClaimFromTill` is the only `storeShipmentRequest.create` (`store-shipment.service.ts:268`). After the store load and `isActive` check (`135-139`), before `confirmTillInvoice`:

```
if (!store.isAnchorStore) throw BadRequestException
```

Staff route: `POST /store-shipment/staff/create-claim` (`store-shipment.controller.ts:47-76`). No other create path.

**Web — do not touch.** `processOrderComplete` never loads `Store`. Checkout burn uses channel `MARKETPLACE_CHECKOUT` and does not call `validatePosStore`. Leaving those functions unchanged is the zero-impact guarantee.

### 3.2 What not to gate unless product asks

POS **burn** is a different policy. `LoyaltyBurnEngine.validatePosStore` (`burn.engine.ts:53-60`) allows redemption only when the store’s seller has `sellerType = PLATFORM_RETAIL`. It does not look at `storeType`. Gift-card amount uses `Store.loyaltyRedeemValue` (`pos-voucher.service.ts:206`). Anchor earn gating should not be copied into burn unless the business also wants non-anchor outlets blocked from issuing vouchers.

Staff enroll (`POST /loyalty/pos/enroll`) also does not know the store. `StaffEnrollDto` has no `storeId`, and `enrollFromPos` calls `enroll(user.id, { enrollmentChannel: 'POS' })` (`loyalty.service.ts:1322`). A non-anchor till can still create a global membership. That is enrollment, not sale earn.

### 3.3 Suggested column

`isAnchorStore Boolean @default(false)` on `Store`. Default false so existing concession / pop-up rows do not start earning until they are explicitly flagged. `storeType = FLAGSHIP` is a poor substitute: it is an unconstrained string and is not read by loyalty or shipping.

---

## 4. Multi-Market Membership Migration

### 4.1 What blocks it today

`LoyaltyMembership` (`schema.prisma:3731-3789`):

```
userId String @unique          // line 3733
cardNumber String? @unique     // line 3745
regionCode String @default("US") // line 3750 — country string, not a Market FK
```

No `marketId`. `User.loyaltyMembership LoyaltyMembership?` (`schema.prisma:147`) is a Prisma 1:1 because of that unique. Wallet, tier, spend, CLV, referrals, and ambassador all hang off this single row.

`LoyaltyTier` (`3708-3728`):

```
name  String @unique   // 3710
slug  String @unique   // 3711
level Int    @unique   // 3712
```

All three block a second market from having its own Initiate at level 1. `recalculateTier` loads every active tier globally, ordered by `level desc`, and picks the first whose `pointsThreshold <= totalPointsEarned` (`tier.engine.ts:71-83`). No region filter.

`LoyaltyEarnRule.action String @unique` (`3836`). `regionCodes String[]` exists and is **never read** by the earn engine. One PURCHASE rule covers US and MY.

Settings are one `Config` row: `level = PLATFORM`, `levelId = PLATFORM`, `key = LOYALTY_PROGRAMME_SETTINGS` (`loyalty-settings.service.ts:12-13`, `241-243`). No market key.

### 4.2 Target constraint

```
marketId String
market   Market @relation(...)
@@unique([userId, marketId])
@@index([userId])
```

Drop `@unique` on `userId`. Change `User.loyaltyMembership` to `loyaltyMemberships LoyaltyMembership[]`.

`cardNumber @unique` can stay global. Each market membership gets its own card. Prefix today is one setting (`LOYALTY_CARD_PREFIX`, default `HOS`). Per-market prefixes belong in per-market settings, not in the card generator’s current env read (`loyalty.service.ts:230-231`, `earn.engine.ts:100-101`).

Postgres unique indexes treat NULL as distinct. A nullable `marketId` would allow duplicate `(user, null)` rows. Backfill every existing membership before adding the unique, and make `marketId` required.

### 4.3 Backfill

1. Resolve `Market` by `LoyaltyMembership.regionCode` (ISO alpha-2, same shape as `Market.code`).
2. Fallback: user’s `homeMarketId`, then the market with `isDefault = true`.
3. Set `marketId` on every row, then add the unique index.
4. Points, balance, tier, and card stay on that row. Do not split history. A US member who later shops in MY gets a **new** membership with a zero balance. Existing points do not move.

### 4.4 Call sites that break when `userId` is no longer unique

Prisma `findUnique({ where: { userId } })` will not compile. Confirmed call sites:

| File | Count |
|---|---|
| `loyalty/loyalty.service.ts` | 8 |
| `loyalty/listeners/loyalty.listener.ts` | 6 |
| `loyalty/services/pos-voucher.service.ts` | 2 |
| `loyalty/services/loyalty-reversal.service.ts` | 2 |
| `events/events.service.ts` | 2 |
| `partner-referrals/services/partner-incentive.service.ts` | 1 |

Plus `earn.engine.ts` (`61-63`, `121-123`, `430-432`, `633-635`, `1391-1393`) and `loyaltyMembership.update({ where: { userId } })` in preferences (`709`). Every lookup needs a market: order `marketId`, store `marketId`, or an explicit argument. `getMembership(userId)` cannot stay market-blind.

Signup, birthday, anniversary, and founding-member idempotency keys are `bonus:{source}:{membershipId}`. They stay correct **per membership**. A second market membership can receive its own signup bonus. That is probably desired for separate programmes; founding-member bonus should be decided explicitly (see section 6).

`AmbassadorProfile.userId @unique` and `membershipId @unique` (`schema.prisma:3988-3991`) stay 1:1 with a single membership. Multi-market needs either one ambassador globally (pick a home membership) or `@@unique([userId, marketId])`.

`LoyaltyReferral` is already membership-scoped. It splits naturally. Referral codes are globally unique (`3972`), which is fine.

Tier review cron (`loyalty.jobs.ts:69-72`, default `0 2 * * 0`) calls `reviewAllMemberships`, which loads every membership id and recalculates (`tier.engine.ts:38-53`). After the split it must only compare tiers in that membership’s market (plus a global fallback tier set).

### 4.5 Tier migration

Replace the three global uniques with:

```
marketId String?   // null = global fallback
@@unique([marketId, slug])
@@unique([marketId, level])
@@unique([marketId, name])
```

Use `NULLS NOT DISTINCT` (Postgres 15+) or a non-null sentinel so two global Initiates cannot both have `marketId = null`.

`recalculateTier` selection:

1. Active tiers where `marketId = membership.marketId`, highest level whose threshold is met, skip `inviteOnly`.
2. If that market has no tiers, fall back to `marketId = null`.
3. Never mix US level 3 with MY level 2 in one ordered list. Today’s `orderBy: { level: 'desc' }` across all tiers would do exactly that.

`ensureInitiateTier` (`loyalty.service.ts:1744-1768`) and the earn-engine copy (`73-94`) create slug `initiate` with no market. They must become “ensure Initiate for this market”.

### 4.6 Earn and burn market threading

- Web: pass `order.marketId` into `ensureMembershipForUser` and campaign region. Stop using `membership.regionCode || user.country` as a global programme key (`784`).
- POS: pass `sale.store.marketId` (and persist `POSSale.marketId` in `importParsedSale`, which currently omits it).
- Campaigns: `LoyaltyBonusCampaign` has `regionCodes`, not `marketId`. Either keep region codes aligned 1:1 with `Market.code`, or add `marketIds`. Empty `regionCodes` means **all markets** (`campaign.service.ts:32`). A US-only campaign must set `regionCodes: ['US']` or it will apply in MY.
- Burn options use the same empty-means-global `regionCodes` pattern (`burn.engine.ts:160-163`). Checkout must pass the order market’s country. Today a missing `regionCode` **skips** the region check entirely (`if (option.regionCodes.length > 0 && params.regionCode)`).
- Settings: duplicate the `Config` row per market (`level = MARKET`, `levelId = marketId`) and resolve market first, platform second. Earn rate, redeem value, welcome minimum, and points-per-currency-unit are not safe to share across USD and MYR.

---

## 5. Bugs Found

### 5.1 Auto-enroll channel bypasses signup deferral

`ensureMembershipForUser` always stores `enrollmentChannel: 'AUTO_PURCHASE'` (`earn.engine.ts:111`). The first signup attempt for a web order correctly uses channel `'WEB'` and defers if email is unverified (`141-165`).

The next `getMembership` repair uses the **stored** channel (`loyalty.service.ts:598-601`). `AUTO_PURCHASE` is in the in-store allow-list (`386-390`), so the deferral check is skipped and the welcome bonus is paid before email verification.

`awardDeferredSignupBonus` (`533-546`) has the same bug: it passes `membership.enrollmentChannel`.

### 5.2 POS base points ignore discounts; qualifying subtotal does not

Base points use `unitPrice * quantity` (`1093`). Qualifying subtotal prefers `totalPrice` (`qualifying-amount.ts:50-54`), and the POS mapper passes both (`1047-1054`). Threshold bonus and base earn can disagree on the same sale. The unmapped-product fallback (`1121`) uses `totalAmount - taxAmount`, which can include gift cards that the qualifying subtotal excluded.

### 5.3 POS void does not reverse spend

`reversePosSaleEarn` decrements `purchaseCount` and claws points (`1438-1442`) but never decrements `totalSpend`. Composite score and tier placement keep the voided sale’s spend (`tier.engine.ts:15-28`).

### 5.4 Stamped points can exceed wallet points

Web stamps `loyaltyPointsEarned: totalFinal + thresholdBonus.points` even when `applyDelta` no-ops (`1003-1009`). A later retry sees `loyaltyPointsEarned > 0` and returns (`711`). The member can be short points with no automatic repair. POS has the same stamp (`1346-1348`).

### 5.5 Earn rule `regionCodes` is dead

Admins can set `regionCodes` on `LoyaltyEarnRule` (DTO at `loyalty-admin.dto.ts`). Earn loads the rule with `findUnique({ where: { action: 'PURCHASE' } })` and never filters the array. A MY-only rule cannot exist beside a US rule because `action` is unique, and even the array on the one rule is ignored.

### 5.6 Region restriction skipped when region is omitted

`burn.engine.ts:160-163`: if `regionCodes` is non-empty but the caller passes no `regionCode`, the reward is allowed. Checkout `finalizeCheckoutRedemption` (`1345-1368`) does not pass `regionCode`.

### 5.7 `HOS_SELLER_ID` fallback is inconsistent

Earn treats a missing env var as “no seller”. `PlatformSellerService` treats it as “look up or create `PLATFORM_RETAIL`”. Loyalty attribution and store seller assignment can diverge.

### 5.8 VendorProduct outranks platform ownership

`resolveSellerForItem` prefers the highest-stock active `VendorProduct` over `isPlatformOwned` (`478-487`). After the catalogue becomes marketplace-owned, leftover vendor rows will keep seller-specific earn rates.

### 5.9 Ship-from-store create hardcodes USD and drops market

New claims set `currency: 'USD'` (`store-shipment.service.ts:278`). The resend/update path uses `confirmed.currency || store.currency` (`263`). `StoreShipmentRequest.marketId` is never set from `store.marketId`. Customs quotes hardcode USD (`1111-1115`).

### 5.10 Analytics stores points in revenue columns

`loyalty-analytics.service.ts:169-170`:

```ts
webRevenue: new Decimal(webTxs._sum.points ?? 0),
posRevenue: new Decimal(posTxs._sum.points ?? 0),
```

Those aggregates are point sums, not money. `LoyaltyAnalyticsSnapshot.date` is globally unique (`schema.prisma:4279`), so one row per day for all markets. Revenue query also slices member user ids to 10,000 (`127-132`).

### 5.11 CLV ignores in-store sales

`computeClvForMember` (`191-204`) sums `Order` rows only. POS spend on the membership (`totalSpend`) is overwritten in the CLV fields by online-only averages (`226-236`). Not market-scoped.

### 5.12 Staff POS enroll drops store context

`enrollFromPos` does not pass `storeId` or the store’s market (`1322`). Store-scoped `SIGNUP_BONUS` campaigns cannot match staff enrollment. Region becomes `user.country` or the platform country, not the outlet’s market.

### 5.13 Birthday and anniversary jobs load every membership

`loyalty.jobs.ts:166-170` and `255-259` `findMany` the full table into memory on each cron run. Fine at current size; it will not stay fine after a row per user per market.

---

## 6. Founding Member Analysis

Model: `schema.prisma:5018-5043`.

```
email    String  @unique
userId   String? @unique
country  String?
countryCode String?
status   String  @default("REGISTERED")  // REGISTERED | INVITED | LINKED | DEACTIVATED
```

No `marketId`. `User.foundingMember FoundingMember?` is 1:1 because `userId` is unique. `User.email` is also globally unique (`schema.prisma:17`), so the same person cannot have two user accounts. Multi-market founding members means **multiple FoundingMember rows for one user**, not multiple users.

### 6.1 `register()` flow

`founding-members.service.ts:61-73` → `assertEmailAvailable` → `createMember`.

`assertEmailAvailable` (`564-573`) rejects:

- an existing founding-member email (`findUnique` on email)
- any non-deleted `User` with that email

`createMember` (`579-633`) lowercases email, stores `country` and normalized `countryCode`, fandoms, source, spend bracket, metadata. Status stays `REGISTERED`. Optional confirmation email. It does **not** create a user, a loyalty membership, or points.

Import (`bulkImport`) uses the same email and existing-user checks (`458-479`). `country` is copied; it is not a uniqueness key.

### 6.2 Link to loyalty

On customer registration, `auth.service.ts:514-550`:

1. `FoundingMembersService.linkToUser(email, userId)` sets `userId` and `status = 'LINKED'` (`784-793`). Deactivated rows throw.
2. If loyalty is enabled, enroll (or reuse the membership looked up by `userId`).
3. Award `FOUNDING_MEMBER_BONUS_POINTS` (default 500) once, idempotency key `bonus:FOUNDING_MEMBER_BONUS:{membershipId}`.

A second path, `LoyaltyService.ensureFoundingMemberBonus` (`553-587`), runs from `awardDeferredSignupBonus` and `getMembership`. It requires `status = 'LINKED'` and `findUnique({ where: { userId } })`. Same bonus source, same key.

There is no market on the bonus. One user, one membership, one bonus.

### 6.3 What `email @unique` and `userId @unique` block

| Constraint | Effect |
|---|---|
| `FoundingMember.email @unique` | The same email cannot register as a founding member in US and again in MY. |
| `FoundingMember.userId @unique` | One user cannot be linked to two founding-member rows. |
| `User.email @unique` | Still one login worldwide. This should stay. Market scope belongs on the founding-member row, not on the user. |

`countryCode` is stored and never used for lookup, uniqueness, or the loyalty bonus.

### 6.4 Market-scoping requirements

1. Add `marketId` (required after backfill from `countryCode` → `Market.code`, else default market).
2. Replace `email @unique` with `@@unique([email, marketId])`.
3. Replace `userId @unique` with `@@unique([userId, marketId])` (userId still optional before link). Change `User.foundingMember` to a list.
4. `linkToUser(email, userId)` must take a market. Linking by email alone would attach every market’s row, or the wrong one.
5. Decide the bonus: once per user (key on `userId`) or once per market membership (key on `membershipId`, current behaviour). Separate US and MY programmes imply once per market, but only after the membership is the one for that market. Today the bonus lands on whichever membership `enroll(userId)` returns — the only one.
6. Import and `assertEmailAvailable` must be market-scoped. “Already has a platform account” currently blocks import entirely (`470-478`). For a second market that check is wrong if the person should be a founding member in MY and already has a US account. Link the existing user instead of rejecting the row.

---

## 7. Loyalty Settings (no market awareness)

`LoyaltySettingsService.getResolved` (`228-259`): in-process cache, optional Redis, then one platform `Config` JSON merged over env defaults.

| Setting | Env fallback | Role |
|---|---|---|
| `defaultEarnRate` | `LOYALTY_DEFAULT_EARN_RATE` or **1** | Points per currency unit when no seller rate and no PER_CURRENCY_UNIT rule |
| `defaultRedeemValue` | `0.01` | Used when a store’s `loyaltyRedeemValue` is unset (POS voucher) |
| `minRedemptionPoints` | `100` | Burn floor |
| `welcomeRewardMinPurchase` / `campaignMinPurchaseThreshold` | `85` | Welcome-reward gate |
| `pointsExpiryMonths` | `24` | Expiry cron |
| `cardPrefix` | `HOS` | Card numbers |
| `redemptionAtCheckout` | true | Web burn |
| `posVoucherEnabled`, method `GIFT_CARD` or `PROMO_CODE` | | Outlet burn |
| `posVoucherMinAmount` / `MaxAmount` | 1 / 500 | Gift card face value |
| `giftCardCatalogAmounts` | `25,50,100,250,500` | |
| `giftCardDefaultCurrency` | platform currency | |
| `restoreBurnOnCancel` / `clawEarnOnCancel` / return twins | true | Reversal policy |
| `campaignBonusEarnRate` | `0.20` | Programme threshold bonus |
| `campaignBonusPointsPerDollar` | `100` | |

`Store.loyaltyRedeemValue Decimal @default(0.01)` (`schema.prisma:399`) overrides the programme redeem value **per store** for POS vouchers only (`pos-voucher.service.ts:206`, `pos-promo-code.service.ts:130`). It is not used for web checkout and it is not per market. Two outlets in different currencies can already disagree; two markets cannot, except by setting this on each store.

Tier thresholds are **not** in settings. They live on `LoyaltyTier.pointsThreshold`.

---

## 8. Store Model and Ship-from-Store

### 8.1 `Store` fields that matter here

`schema.prisma:359-418`.

| Field | Notes |
|---|---|
| `tenantId` | Required |
| `sellerId` | Optional. POS connection still requires a seller (`POSConnection.sellerId` is required, `4355`) |
| `marketId` | Optional FK. Indexed. Not read by loyalty earn or claim creation |
| `code` | Globally unique. Used in HOS shipment numbers |
| `storeType` | Free string, default `STANDARD`. Not enforced, not read by loyalty or shipping |
| `country` / `countryCode` | Default country `US` |
| `currency` | Default `USD` |
| `isActive` | Claim creation treats inactive as not found (`store-shipment.service.ts:139`) |
| `defaultRegionCode` | Default `US`. Not read by the earn engine |
| `loyaltyRedeemValue` | POS voucher face value per point. Default `0.01` |
| Relations | `posConnection` (1:1), `posSales`, `storeShipmentRequests`, `clickCollectOrders`, `loyaltyPosVouchers`, staff users, box sizes |

`POSConnection` is unique per store (`4357`). `POSSale` is unique on `(provider, externalSaleId)` globally (`4411`), so the same Lightspeed sale id cannot exist in two outlets if they share a provider namespace. `marketId` on the sale is unused by import.

### 8.2 `createClaimFromTill` validation

`store-shipment.service.ts:111-359`.

1. Shipping consent required.
2. Invoice number required.
3. Store id from staff assignment, else body. Staff cannot claim for a different store (`131-133`).
4. Store must exist and `isActive`.
5. `confirmTillInvoice` (`618-732`): local `POSSale` and/or live Lightspeed. Reject voided and non-closed sales. If Lightspeed errors and there is no trustworthy remote sale, fail closed. No POS connection and no local sale → cannot confirm.
6. Email: body email must match the sale customer when the sale has one. Empty sale email requires a manual email.
7. Reject a second in-flight claim for the same invoice. If the customer already attached (`userId` set), return the existing order instead of erroring. Reject a resend to a different email.
8. Write a GDPR `SHIPPING` consent row.
9. Create or refresh the claim: 14-day token, `HOS-{STORECODE}-{DDMMYY}-{seq}` order number, QR code, status `CUSTOMER_DETAILS_REQUIRED`.

No anchor check. No market copy. New rows force currency `USD`.

### 8.3 Rest of the ship-from-store flow

Loyalty is not in this path.

1. Staff sends the claim email (`/ship/claim/{token}`).
2. Customer opens `getClaimContext`, then `POST /store-shipment/claim/:token/attach` (`attachUserToClaim`).
3. Destination address, rate quote (`getShippingRates` / `buildRateContext`).
4. Pay online (`authorizeShipping`, feature `SHIPPING_ONLINE_PAYMENT`) or counter tender (`paymentMethod` CASH / CARD / OTHER).
5. Workflow moves `PAID → SENT_TO_LOGISTICS → PACKING → PACKED → LABEL_CREATED → READY_FOR_PICKUP → HANDED_TO_CARRIER → IN_TRANSIT → DELIVERED`, plus exception statuses listed on the model (`4425-4429`).
6. Goods stay in Lightspeed. HOS charges shipping only.

Anchor gating at step 1 (`createClaimFromTill`) stops new claims. In-flight claims for a store later unmarked as anchor should be allowed to finish; do not re-check the flag in packing or label purchase.

---

## 9. Burn Engine

`services/api/src/loyalty/engines/burn.engine.ts`.

Channels: `MARKETPLACE_CHECKOUT` and `HOS_OUTLET_POS` only (`44-50`). Outlet requires `storeId` and a store whose seller is `PLATFORM_RETAIL` (`53-60`).

`processRedemption`:

1. Loyalty runtime must be on.
2. Points at least `minRedemptionPoints` (settings, default 100).
3. Idempotent replay by order id or caller key `burn:key:{membershipId}:{idempotencyKey}`. A reversed redemption is re-debited; it is not healed for free.
4. Optional catalogue option: active, region (only if region was passed), channel, exact `pointsCost`, stock.
5. Welcome-reward minimum purchase (default $85) unless `skipWelcomeGate` (POS voucher sets this because the purchase happens at the till after the card is issued).
6. Wallet `BURN`, increment `totalPointsRedeemed`, create `LoyaltyRedemption`.
7. A `DISCOUNT` option with no `orderId` mints a coupon. Checkout burns do not, because the discount is already on the order.
8. Outlet burns increment `POSSale.loyaltyPointsRedeemed` only when `posSaleId` is passed.

POS voucher flow (`pos-voucher.service.ts`): burn, then issue a Lightspeed gift card or promo code for `points * store.loyaltyRedeemValue` in `store.currency`. Idempotency is scoped to the store so one till cannot read another store’s card number.

Market awareness: `regionCodes` on the redemption option only. No `marketId`. Empty `regionCodes` means worldwide. Membership balance is global, so a US earn can be burned in MY at MY’s store redeem value. That is the main reason balances must split per market before a second currency goes live.

---

## 10. Loyalty Analytics

`services/api/src/loyalty-analytics/`.

Not market-aware.

- Daily snapshot counts every membership and every transaction (`loyalty-analytics.service.ts:58-119`). Upsert key is the calendar date alone.
- `webRevenue` / `posRevenue` are point totals (bug 5.10).
- CLV (`clv.engine.ts:12-39`) is RFM: `avgOrderValue * (orders per month) * 12 * recency * engagement * tier multiplier`. Inputs come from online `Order` rows only. POS is invisible. Result is written onto the single membership (`clvScore`, `predictedChurnRisk`, `avgOrderValue`, `purchaseFrequency`).
- Recompute cron: `LOYALTY_CLV_RECOMPUTE`, default `0 3 * * 0` (`analytics.jobs.ts`).
- Campaign attribution is unique on `(campaignId, date)` with no market.

After per-market memberships, snapshot uniqueness must become `(date, marketId)`, and CLV must sum orders and POS sales in that market only. Otherwise a MY outlet’s ringgit orders inflate a US dollar CLV.

---

## 11. Regression Test Cases

### Loyalty earn

1. Web order, platform-owned product, `sellerId` null, `isPlatformOwned` true, `HOS_SELLER_ID` set, no active VendorProduct → points at platform seller rate, wallet `sellerId` set.
2. Same product with an active VendorProduct → **today** the vendor rate wins. After the ownership fix, the platform seller must win.
3. `HOS_SELLER_ID` unset, platform-owned product → customer still earns at the PURCHASE rule / default rate, `sellerId` null. No throw.
4. Seller `loyaltyEnabled = false`, no platform rule, default rate 0 → line skipped, order stamped 0.
5. Seller disabled but PURCHASE rule `PER_CURRENCY_UNIT` active → platform rule still pays (current `computeLinePoints` behaviour).
6. Mixed sellers → one PURCHASE wallet row, `sellerId` null, `metadata.sellerIds` has both.
7. Gift card line → excluded from qualifying subtotal and threshold bonus.
8. Second call to `processOrderComplete` after a successful stamp → no second earn.
9. Web order does not match a campaign whose `storeIds` is non-empty.
10. POS sale at a store listed on the campaign matches; a different store does not; a campaign with empty `storeIds` matches both.
11. Unmapped POS lines only, no disabled seller → fallback on `totalAmount - taxAmount`.
12. POS line with `unitPrice` 10, `totalPrice` 8 (discount) → document the expected base vs threshold. Today they diverge.
13. Voided POS sale claws points up to the balance and does not go negative. `purchaseCount` drops. **`totalSpend` currently does not** — the test should lock the intended behaviour.
14. Earn throw on POS leaves sale `IMPORTED`; next import retries. Web earn throw leaves `loyaltyPointsEarned` at 0.
15. Deactivated membership → no earn, no auto-reactivate.
16. Unverified email, web auto-enroll → signup bonus must stay deferred until verification. **Currently fails** on the next `getMembership` because channel is `AUTO_PURCHASE`.

### Anchor store

17. `isAnchorStore = false` POS import → no membership created, `loyaltyPointsEarned` stays 0, sale becomes `PROCESSED`, no retry loop.
18. `isAnchorStore = true` POS import → current earn behaviour, including store-scoped campaigns.
19. Web order while every store is non-anchor → earn unchanged.
20. Non-anchor `createClaimFromTill` → 400 before Lightspeed confirm and before a shipment row.
21. Anchor claim → current flow, including resend and “already attached” return.
22. In-flight shipment after the store is unmarked → packing and label still complete.
23. Sale that earned, then store unmarked, then void → clawback still runs.
24. POS voucher at a non-anchor `PLATFORM_RETAIL` store → still allowed unless product explicitly extends the gate to burn.

### Multi-market membership

25. Same user enrolls in US and MY → two rows, two cards, two balances. Second enroll does not 409.
26. US order credits only the US membership. MY POS credits only the MY membership.
27. US tier review does not promote using MY thresholds.
28. Global fallback tier is used only when the market has no active tiers.
29. Signup bonus idempotency does not block the other market’s bonus, and does not double-pay within one market.
30. `getMembership` without a market is rejected or resolved from the user’s home market — it must not silently return an arbitrary row.
31. Campaign with empty `regionCodes` applies in both markets. Campaign `regionCodes: ['US']` does not apply in MY.
32. Redeem in MY cannot spend US points.

### Founding members

33. Same email, two markets → two founding-member rows, one user.
34. Same email, same market → 409.
35. Register in MY when a US user already exists → link that user for MY, do not reject as “already has a platform account”.
36. `linkToUser` for MY does not flip the US row.
37. Founding bonus pays the MY membership when the invite market is MY, once.
38. Deactivated MY row does not block a US registration and does not pay a bonus.
39. Import file with the same email in two market columns creates two rows.

### Ship-from-store and settings

40. New claim currency equals the Lightspeed sale currency, not a hard-coded USD.
41. Claim `marketId` equals the store’s market.
42. MY store `loyaltyRedeemValue` does not change US checkout redemption.
43. Programme settings for MY earn rate do not change US `processOrderComplete`.

---

## 12. Recommended Implementation

Order is dependency order. Web earn stays correct after each step.

### P0 — Schema that unblocks the two product rules

1. `Store.isAnchorStore Boolean @default(false)`. Backfill the real HOS outlets to `true` before deploy, or POS earn stops everywhere.
2. `LoyaltyMembership.marketId` required, `@@unique([userId, marketId])`, drop `userId @unique`, pluralize the User relation. Backfill from `regionCode` → `Market.code`.
3. `LoyaltyTier.marketId` nullable for global fallback. Replace `slug`, `name`, and `level` uniques with compound uniques. `NULLS NOT DISTINCT` or a sentinel for the global set.
4. `FoundingMember.marketId`, `@@unique([email, marketId])`, `@@unique([userId, marketId])`.

### P1 — Anchor behaviour (small, isolated)

5. Early return in `processPosSale` when `!store.isAnchorStore`, before auto-enroll. Do not throw.
6. Reject `createClaimFromTill` when `!store.isAnchorStore`.
7. Tests 17–24. Do not edit `processOrderComplete`.

### P2 — Market on the earn and burn path

8. Thread `marketId` through `ensureMembershipForUser`, `enroll`, `getMembership`, POS enroll, and every `findUnique({ where: { userId } })` listed in section 4.4.
9. Persist `POSSale.marketId` from the store in `importParsedSale`.
10. Resolve earn rate, redeem value, welcome minimum, and card prefix from market settings, falling back to the current platform `Config` row.
11. Filter `recalculateTier` to the membership market, then global fallback.
12. Pass market country into `processRedemption` so option `regionCodes` cannot be skipped.
13. Fix signup deferral: stop treating stored `AUTO_PURCHASE` as an in-store channel (`loyalty.service.ts:386-390`). Keep `enrollmentChannel` as `WEB` or `HOS_OUTLET_POS`.

### P3 — Marketplace-owned seller resolution

14. In `resolveSellerForItem`, if `isPlatformOwned` or `sellerId` is null, skip `VendorProduct` and resolve the platform retail seller through `PlatformSellerService` (env, then `PLATFORM_RETAIL`, then create).
15. Keep the synthetic `{ loyaltyEnabled: true }` fallback so a missing seller cannot zero customer points.

### P4 — Correctness that will hurt more after two markets

16. POS base points should use the same amount as qualifying subtotal (`totalPrice`, excluding gift cards), not raw `unitPrice * quantity`.
17. Void clawback decrements `totalSpend`.
18. Stamp `loyaltyPointsEarned` with the applied wallet total.
19. Ship-from-store create uses sale currency and copies `store.marketId`.
20. CLV includes POS sales and is scoped to `membership.marketId`. Snapshot unique key becomes `(date, marketId)`. Stop writing point sums into `webRevenue` / `posRevenue`.
21. Founding-member link and import take a market. Bonus key policy as decided in section 6.4.

### Explicit non-goals for the first PR

- Do not gate web earn on stores.
- Do not gate POS burn on `isAnchorStore` unless product confirms non-anchor outlets must not redeem.
- Do not split existing point balances. One historical membership per user, assigned to the backfilled market.
- Do not make `LoyaltyEarnRule.action` per-market until settings and membership market threading exist. Until then, region arrays on earn rules remain unused and should not be documented as live behaviour.

# Loyalty & Customer Ledger — 360° Challenges & Roadmap

**Audience:** Product, Engineering, Ops, Finance, Support  
**Programme:** The Enchanted Circle  
**Last updated:** August 2026  
**Status:** Phases 1–5 implemented (see §1.4). Sections 7–11 remain the reference spec; §3–4 record the pre-implementation baseline.

---

## 1. Executive summary

### Decision

| Concern | System of record | Notes |
|---------|------------------|-------|
| Customer identity, membership, points balance | **HOS e-commerce** | Where the customer lives |
| HOS gift cards | **HOS** | Issue / redeem / refund in HOS |
| POS vouchers (points → Lightspeed GC) | **HOS** for points burn; Lightspeed for till GC | Bridge recorded in HOS |
| In-store retail sales & store VAT | **Lightspeed** (+ its Xero connector) | HOS must never double-post POS sales |
| Company GL / statutory books | **Xero (optional export)** | Daily summaries only; not required for loyalty to run |

**HOS is the customer ledger.** Xero is an optional finance export. Support, marketing, and customers must never need Xero to answer “what is my balance?”

### Why this document exists

Production has real Lightspeed customer data; e-commerce is live but not yet customer-facing. Before enabling full POS + loyalty, the business needs a clear view of:

1. What already works in HOS  
2. Where configuration is trapped in env vars  
3. Where returns leave loyalty inconsistent  
4. How to avoid polluting Lightspeed with dummy marketplace users  
5. How to configure all loyalty rules in admin UIs  

### Severity snapshot

| Area | Severity | Summary |
|------|----------|---------|
| Dummy users → Lightspeed push | **Critical** | Enroll can create/overwrite POS customers |
| Online cancel/return vs loyalty | **High** | Gift cards restore; points burn/earn do not reverse |
| Business rules in env only | **High** | Ops cannot safely change rates without deploy |
| Customer ledger UX | **Medium** | Data exists; UI incomplete |
| Xero dependence myth | **Medium** | Loyalty works with Xero off; messaging unclear |
| Identity match errors | **Medium** | Wrong email/phone → wrong points |
| Gate drift (`POS_ENABLED` alone) | **Medium** | Some paths bypass dual gate |

### 1.4 Implementation status

Shipped against this spec:

| Phase | Shipped | Where |
|-------|---------|-------|
| 1 | Loyalty Settings page + resolver; earn/burn/voucher/GC/checkout read settings | `/admin/loyalty/settings`, `LoyaltySettingsService` |
| 2 | Per-member ledger, POS voucher admin, customer points history, GC refund UI | `/admin/loyalty/members/[userId]`, `/admin/loyalty/pos-vouchers`, `/loyalty/history`, `/admin/gift-cards` |
| 3 | Cancel + return reversal (earn clawback, burn restore) | `LoyaltyReversalService`, hooked from `OrdersService.cancel` and `RefundsService` |
| 4 | Dual-gate fix on POS enroll sync; identity review resolve UI that writes the mapping | `loyalty.service.ts`, `/admin/loyalty/identity-reviews` |
| 5 | HOS liability report; Xero relabelled as optional export | `/admin/loyalty/liability`, `/admin/finance/accounting` |

Deviations and known limits:

- **Settings storage:** stored as a `Config` row (`level=PLATFORM`, key `LOYALTY_PROGRAMME_SETTINGS`) rather than the proposed `LoyaltyProgrammeSettings` Prisma model, so no migration was required. Resolver semantics (DB → env → code defaults) are unchanged. A save is published to the shared cache (Redis when `REDIS_URL` is set) and each instance holds it for `LOYALTY_SETTINGS_CACHE_TTL_MS` (default 2s), so propagation is bounded at ~2s regardless of instance count.
- **Reversal amount basis:** loyalty reverses against HOS-settled value (gift-card restore + confirmed card refund) and tops up cumulatively, so a card refund that settles later via Stripe webhook still completes the clawback. That webhook now also completes the `ReturnRequest`, updates the payment refund total, records the vendor-ledger refund and marks the order `REFUNDED`.
- **Points expiry** is transaction-level, not lot-tracked: the sweep expires only the aged points that were never spent (aged credits − lifetime debits, capped by live balance), so a member who already burned those points is not debited twice. It reads `pointsExpiryMonths` from Settings, and so does the 30-day expiry-warning email scan.
- **Bonus idempotency:** every engagement and job-driven award runs its duplicate/cap check under the membership row lock and carries a deterministic wallet key, so concurrent requests or overlapping cron workers cannot double-award.
- **Loyalty DISCOUNT rewards** now issue a real `Promotion` + `Coupon` pair, so the code works at checkout through the normal coupon validator. Codes issued before this fix have no coupon row and must be re-issued manually.
- **Vendor / store loyalty admin (Phase 1b)** is not built.
- **Store return after a POS voucher was spent** still has no automatic point restore, by design (§5).

### 1.5 Engineering follow-ups from the August 2026 review — all closed

| # | Finding | Where | Resolution |
|---|---------|-------|------------|
| 1 | POS sale void clawed back the full earn in one debit and threw if the member had already spent the points, leaving the void incomplete | `earn.engine.ts` `reversePosSaleEarn` | Debit is capped at the live balance (same policy as order cancel), the shortfall is logged, `purchaseCount` is corrected either way, and the tier is recalculated |
| 2 | Engagement bonuses (check-in, review, share, quest, quiz, profile, birthday, anniversary) checked for duplicates **outside** the transaction with no idempotency key | `loyalty.service.ts`, `loyalty.jobs.ts`, `loyalty.listener.ts` | Every award now takes `wallet.lockMembership()` first, re-checks duplicates and caps **inside** the transaction, and passes a deterministic wallet key (`earn:QUEST:{membership}:{quest}`, `bonus:BIRTHDAY:{membership}:{year}`, …) |
| 3 | Negative admin adjust reduced the balance but not `totalPointsEarned`, the tier basis | `loyalty.service.ts` adjust | A negative adjust now decrements `totalPointsEarned` (floored at 0) before tier recalculation, so a correction can actually demote |
| 4 | Expiry-warning emails read `LOYALTY_POINTS_EXPIRY_MONTHS` from env while the sweep read Settings | `journeys/jobs/marketing.jobs.ts` | The scan resolves the horizon from `LoyaltySettingsService` (env only as fallback), so warnings and expiry always agree |
| 5 | Standalone `LoyaltyService.redeem()` generated a random burn key | `burn.engine.ts`, `redeem-points.dto.ts` | `POST /loyalty/redeem` accepts an `idempotencyKey`; a replay returns the original redemption instead of burning again |
| 6 | Earn pipeline converted `Decimal` to float before rounding | `earn.engine.ts` | Tier multiplier and campaign slices are multiplied in `Decimal` with `ROUND_HALF_UP`; brand takes the residual so slices still sum to the awarded total |
| 7 | Coupon-style redemptions swallowed a failed promotion insert and still returned a code | `burn.engine.ts` | The insert was writing a shape the schema does not have, so **no loyalty DISCOUNT coupon was ever usable**. It now writes a real `Promotion` (`FIXED_DISCOUNT`) + `Coupon` pair that `PromotionsService.validateCoupon` resolves, and any failure aborts the redemption so the points are not spent. Coupons are only minted for catalogue redemptions — a checkout burn already discounts its own order, so it issues none |

Found and fixed alongside them:

- Cancel/return earn clawbacks decremented lifetime earned points without recalculating the tier, so a reversed order left the member on a tier they no longer qualified for. `LoyaltyReversalService` now recalculates after a successful clawback, as the POS void path does.
- The welcome (`SIGNUP`) bonus now carries a wallet key as well as its in-transaction duplicate check.

Behaviour changes worth telling Ops about:

- A DISCOUNT reward with no `value` configured is now rejected at redemption instead of returning a dead code.
- Loyalty coupon codes issued before this change have no coupon record and will not work at checkout; re-issue them.
- A negative points adjustment, or a cancel/return clawback, can now lower a member's tier.
- Check-in returns the same "limit reached" error under concurrency instead of occasionally awarding twice.

### 1.6 Second review round (Bugbot + security) — all closed

| # | Finding | Severity | Where | Resolution |
|---|---------|----------|-------|------------|
| 1 | A loyalty reward coupon could be spent by anyone who saw the code, and — because the automatic promotion engine applies every active platform promotion — it could also land in an unrelated shopper's cart with no code at all | High (found in review of the fix above) | `promotions.service.ts`, `burn.engine.ts` | The promotion is stamped with `conditions.allowedUserId` and `validateCoupon` refuses it for any other account. The automatic engine now skips any promotion that has coupon codes, and skips owner-locked promotions for everyone else |
| 2 | A card refund that settled on the Stripe webhook completed the return but never restocked the items or reversed influencer attribution — the inline path does both | High | `refunds.service.ts`, `returns.service.ts` | Restock and order status moved into `ReturnsService.finalizeSettledReturn`, called from the webhook path, so async and inline refunds land on identical rules. Finance resolves it by token (`RETURN_FULFILMENT`) to avoid a module cycle |
| 3 | The same webhook path marked the parent order fully `REFUNDED` even for a partial return | High | `refunds.service.ts` | It now goes through `markOrderRefundedInTx`, which leaves `status` alone for partial returns and only moves `paymentStatus` |
| 4 | A return clawback capped by a thin balance could never top up: the idempotency key was derived from the target amount, so the retry looked like a replay | Medium | `loyalty-reversal.service.ts` | The key carries the already-clawed total as well as the target, so a genuine redelivery is still a no-op but a top-up gets a fresh key. The clawback also takes the membership row lock first |
| 5 | Restoring burned points credited the wallet but left `totalPointsRedeemed` counting a redemption the member no longer had | Medium | `loyalty-reversal.service.ts` | The restore decrements lifetime redeemed (floored at 0) when the wallet actually applied the credit |
| 6 | The gift-card refund API capped the refund at a single redemption row while the admin UI offered the sum of all redemptions for that order | Medium | `gift-cards.service.ts` | The API caps against every redemption on that card/order pair, which is what the UI shows and what a multi-step checkout redemption produces |
| 7 | A Stripe refund with no matching transaction (raised in the Stripe dashboard, or an order cancellation) was attributed to whatever return happened to be first on the order — which now meant completing and restocking the wrong return | High | `refunds.service.ts` `resolveReturnId` | Attribution uses the refund id recorded on our own transaction. With no match it adopts a return only when exactly one refund attempt on the order is still unsettled, and logs instead of guessing when several are |
| 8 | The new admin gift-card refund writes a reversal the return path could not see (it only looked for reversals tagged with the return id), so a return approved afterwards credited the same redemption again and left the card holding more than the order charged | High | `refunds.service.ts` | The return-side reversal now caps each card at what it redeemed for that order minus everything already refunded on it, whoever refunded it. A shortfall is logged, and the settled value used for loyalty and finance is read back from the gift-card ledger instead of the intended split |
| 9 | When a mixed gift-card/card refund settled on the webhook, only the card portion was added to `Payment.refundAmount`, so finance understated what the customer got back | Medium | `refunds.service.ts` | The inline attempt records nothing when the card refund is pending, so the settlement path records the whole settled value including the gift-card portion |
| 10 | When the webhook adopted a return whose attempt never recorded its refund id (fix 7), it settled the return but still wrote a *second* refund row, leaving the original stuck as pending and unlinked | Medium | `refunds.service.ts` | The settlement now lands on the adopted transaction: its status moves to COMPLETED and the Stripe refund id is stamped on it, so a redelivery matches it directly and no duplicate row is created |
| 11 | Fix 8 counted an admin's manual gift-card refund when protecting the card from a double credit, but not when working out how much value the customer got back, so loyalty under-reversed | High | `refunds.service.ts` | The settled value is gift-card value restored on the order (by anyone) plus the card portion that settled, capped at what the return is worth — used by both the inline and the webhook path |

Checked and left alone: the points-expiry budget nets every lifetime debit off the aged credits and caps the result at the live balance, so it errs toward expiring too little and can never take more than a member holds. Per-lot FIFO accounting would be more precise but is not a correctness fix.

Behaviour changes from this round:

- A promotion that has coupon codes is no longer applied automatically anywhere on the platform — it must be entered as a code. This also corrects pre-existing admin coupon promotions that were silently discounting every cart.
- Loyalty reward codes only work for the account that redeemed them.
- Returns whose card refund settles later now restock on settlement; stock that was manually corrected in the meantime will need a second look for returns settled before this change.
- A refund raised directly in the Stripe dashboard no longer completes a return by accident. If several return refunds on one order are unsettled at once, the webhook logs "could not be attributed" and finance has to complete the right return by hand.
- Refunding a gift-card redemption by hand and then approving a return for the same order no longer double-credits the card. The return covers only what is left, and the shortfall is logged — cards refunded both ways before this change may be over-credited and are worth auditing.

---

## 2. System-of-record architecture

```text
+-----------------------------------------------------------------+
|                     HOS (customer SoR)                          |
|  LoyaltyMembership · LoyaltyTransaction · GiftCard(+Tx)         |
|  LoyaltyPosVoucher · ExternalEntityMapping · IdentityReview     |
|  Admin settings · Customer /loyalty & /gift-cards UIs           |
+----------------+-------------------------------+----------------+
                 |                               |
      earn/burn/redeem                    optional daily summary
                 |                               |
                 v                               v
+-----------------------+         +--------------------------+
| Lightspeed (store)    |         | Xero (finance export)    |
| Sales, store tax,     |         | Manual journals: sales,  |
| till gift cards       |         | points liability, GC     |
+-----------------------+         +--------------------------+
```

### Ownership rules (non-negotiable)

1. **Customer balance truth** = HOS wallet + HOS gift cards.  
2. **Till sale truth** = Lightspeed. HOS imports sales only to earn/claw loyalty.  
3. **Xero** never invents customer balances; it receives aggregates.  
4. If Xero is down or disabled, customers can still earn, redeem, and see history.

### Related code (current)

| Layer | Path |
|-------|------|
| Loyalty wallet | `services/api/src/loyalty/services/wallet.service.ts` |
| Earn / burn | `services/api/src/loyalty/engines/{earn,burn}.engine.ts` |
| POS voucher | `services/api/src/loyalty/services/pos-voucher.service.ts` |
| Customer sync | `services/api/src/pos/sync/customer-sync.service.ts` |
| Sales import | `services/api/src/pos/sync/sales-import.service.ts` |
| Daily Xero journals | `services/api/src/accounting/daily-journal.service.ts` |
| Journal builder | `services/api/src/accounting/journal-builder.service.ts` |

---

## 3. Challenge catalogue (360°)

### 3.1 Architecture & ownership

| Challenge | Impact | Recommendation |
|-----------|--------|----------------|
| Finance may treat Xero as SoR | Support/finance disagree on balances | Relabel accounting UI “Xero export”; ship HOS liability reports |
| Split GC systems (HOS vs Lightspeed) | Confusion on “gift card” | Document two types; admin labels “HOS Gift Card” vs “POS Voucher / Lightspeed GC” |
| Dual gates (env + feature flag) | Hard to reason about “is it on?” | Admin status panel showing effective runtime state |

#### Should loyalty be a separate service? — No, not yet

Reviewed August 2026. Keep loyalty as a module inside the API. The decisive constraint is
transactional: the checkout burn runs **inside** the order-creation transaction
(`OrdersService.createOrder` → `LoyaltyService.finalizeCheckoutRedemption(tx, …)`), and the
wallet serialises balance changes with `SELECT … FOR UPDATE` on `loyalty_memberships` in that
same transaction. Order, discount and points therefore commit or roll back together. Splitting
the service replaces that guarantee with a reservation/compensation saga plus reconciliation —
the exact class of bug (discount granted without a burn, or points burned with no order) that
the current design makes impossible.

Supporting reasons:

- Loyalty reads and writes shared tables directly (`Order`, `User`, `GiftCard`, `POSSale`,
  `Store`, `Seller`, `Config`). A split needs either a chatty internal API or duplicated data.
- Write volume is bounded by orders and POS sales, so there is no independent scaling pressure.
- The module is already internally partitioned — engines (earn/burn/tier), a single wallet that
  is the only writer of balances, settings resolver, reversal service, dual-gate flags. The
  seams that a future extraction needs already exist.

Extract only when one of these becomes true: loyalty must serve brands outside this
marketplace; a separate team owns its release cycle; POS/partner traffic dwarfs marketplace
traffic; or the points liability must be ring-fenced in its own ledger for compliance.

To keep that option cheap, hold these invariants: every points mutation goes through
`LoyaltyWalletService.applyDelta` with an idempotency key, no other module writes loyalty
tables directly, and settings are read only through `LoyaltySettingsService`.

### 3.2 Customer ledger completeness

Baseline gaps and how they were closed (Phase 2):

| Exists today | Gap | Status |
|--------------|-----|--------|
| `GET /loyalty/transactions` (customer API) | Weak / missing customer points-history page UX | Shipped — `/loyalty/history` |
| Admin `/admin/loyalty/transactions` (global, limited) | No rich **per-member** ledger with filters/export | Shipped — ledger + type/date filters + CSV/XLSX export (global and per member) |
| Gift card detail + owner transactions | No admin gift-card refund button in UI (API exists) | Shipped — order-scoped refund on `/admin/gift-cards` |
| POS voucher create (staff API) | **No** admin voucher list/detail UI | Shipped — `/admin/loyalty/pos-vouchers`, including retry for FAILED issuance |

### 3.3 Loyalty business configuration

**Configurable in Admin UI today**

- Tiers (name, level, threshold, multiplier) — invite-only / benefits JSON incomplete  
- Earn rules (action, points, name, active)  
- Redemption options (catalogue)  
- Bonus campaigns  
- Member search, adjust, delete  
- Feature flags: `LOYALTY_PROGRAMME`, `POS_INTEGRATION`, `ACCOUNTING_XERO`

**Env / code only (must move to Admin → Loyalty → Settings)**

| Variable / field | Purpose |
|------------------|---------|
| `LOYALTY_DEFAULT_EARN_RATE` | Fallback pts per currency unit |
| `LOYALTY_DEFAULT_REDEEM_VALUE` | £ per point |
| `LOYALTY_MIN_REDEMPTION_POINTS` | Floor to redeem |
| `LOYALTY_POINTS_EXPIRY_MONTHS` | Expiry window (0 = off) |
| `LOYALTY_CARD_PREFIX` | Digital card prefix |
| `LOYALTY_REDEMPTION_AT_CHECKOUT` | Checkout widget |
| `LOYALTY_POS_VOUCHER_ENABLED` | In-store voucher path |
| `GIFT_CARD_CATALOG_AMOUNTS` | Customer denominations |
| `GIFT_CARD_DEFAULT_CURRENCY` | Default GC currency |
| `POS_GIFT_CARD_MIN_AMOUNT` / `MAX` | Voucher limits |
| `Seller.loyaltyEnabled` / `loyaltyEarnRate` | Vendor participation |
| `Store.loyaltyRedeemValue` | Per-store redeem value |

### 3.4 Returns & reversals

Baseline before Phase 3 (bold entries are the gaps that Phase 3 closed — cancel and
return now claw earn and restore burn, gated by the four returns-policy settings):

| Event | Gift card | Points earned | Points burned (checkout) | POS voucher |
|-------|-----------|---------------|--------------------------|-------------|
| Online order cancel | Restored | **Not clawed** | **Not restored** | N/A |
| Online return refund | Proportional restore | **Not clawed** | **Not restored** | N/A |
| POS sale void | N/A | Auto clawback | N/A | N/A |
| POS voucher Lightspeed fail | N/A | N/A | Burn restored | `FAILED` |
| Store return after voucher spend | Lightspeed policy | N/A | Points stay burned | Recon may flag drift |

**Challenge:** Liability and customer trust diverge after returns unless policy + automation exist.

Payments that never complete are covered by the unpaid-order sweep: points burned at
checkout stay burned while the order is still payable (the discount is still on the order),
and are released when the sweep cancels the abandoned order — `FAILED` payments included,
not just `PENDING`.

### 3.5 Lightspeed integration & data safety

| Risk | Detail |
|------|--------|
| Customer push HOS → Lightspeed | On enroll (if POS on): search by code/email, **update or create** POS customer |
| Dummy users | Test emails can create fake POS customers or overwrite real ones if emails collide |
| Sales import match | Ladder: mapping → customer_code → card → email → phone; wrong match = wrong points |
| Identity backfill | Dry-run by default; live stamps `customer_code` / card on Lightspeed |
| Opt-in gate | Sync skips if no email/SMS opt-in — helpful but not enough if test users opted in |
| Gate drift | Some code paths check only `POS_ENABLED`, not `POS_INTEGRATION` |

### 3.6 Timing & ops expectations

| Job | Default cadence | Affects points? |
|-----|-----------------|-----------------|
| Sale webhook | Near real-time | Earn / void clawback |
| `POS_SALES_POLL` | Every **15 minutes** | Earn fallback |
| `POS_GIFT_CARD_RECON` | Every **6 hours** | **No** — flags GC drift only |
| Checkout / POS redeem API | Immediate | Burn |
| Unpaid-order sweep (`UNPAID_ORDER_TTL_MINUTES`, default 60) | Hourly | **Yes** — releases burn on abandoned `PENDING`/`FAILED` payments |
| Settings save | ≤ ~2s across instances | Rates/policies used by earn, burn, expiry |
| Stripe refund webhook | Near real-time | Completes return + tops up reversal |

**Challenge:** Teams may assume “6-hour cron = points delay.” Document and train: earn is webhook/15m; burn is immediate.

### 3.7 Taxation & finance

| Topic | Behaviour |
|-------|-----------|
| Checkout tax | `TaxService` (Stripe Tax / TaxJar / Avalara / zones) on order |
| Xero journals | `LineAmountTypes=NoTax`, `TaxType=NONE`; tax as explicit credit to online tax account |
| POS tax | Lightspeed → Lightspeed Xero connector only |
| Guard | HOS rejects posting `POSSale` into HOS→Xero ledger |

**Challenge:** Double-count gift-card liability if CoA not agreed between HOS journals and Lightspeed.

### 3.8 Security & compliance

- Public GC validate hides balance (anti-enumeration) — keep.  
- Need GDPR story: delete membership + mappings + stop POS sync.  
- Staff POS APIs need API key / admin JWT — keep audited.  
- Rate-limit validate endpoint — keep.

### 3.9 Testing & go-live

- Manual plan: `docs/LOYALTY_AND_GIFT_CARD_MANUAL_TEST_PLAN.md` (75 cases).  
- Blocker: cannot safely test against production Lightspeed with dummy marketplace users.  
- Need: Lightspeed demo/test store + dummy purge + dry-run backfill review.

---

## 4. Gap matrix

“Missing entirely” describes the pre-implementation baseline; the last column records
what shipped.

| Area | Exists in UI | Env / code only | Missing entirely | Now |
|------|--------------|-----------------|------------------|-----|
| Tiers / earn rules / rewards / campaigns | Yes | Richer rule fields, invite-only, benefits | — | Unchanged |
| Global programme knobs | — | Rates, expiry, toggles, GC catalog | **Loyalty Settings page** | Shipped |
| Vendor / store loyalty | — | Prisma fields | Vendor admin loyalty panel | Still open |
| Customer points history | Partial API | — | Polished `/loyalty` history UI | Shipped |
| Per-member admin ledger | Global list only | — | Filtered member ledger + CSV | Shipped (ledger + CSV/XLSX export) |
| POS voucher admin | — | Create via staff API | List / detail / retry UI | Shipped (list + retry) |
| Returns ↔ loyalty | Manual adjust | POS void clawback | Auto cancel/return rules + policy UI | Shipped |
| Gift card admin refund | Issue + list | Refund API | Refund button in admin UI | Shipped |
| HOS liability reports | — | Raw DB / Xero journals | Finance report pages | Shipped |
| Xero export | CoA, outbox, run journals | `ACCOUNTING_ENABLED` | Clear “export only” labeling | Shipped |
| Runtime status board | Flags page | Dual env+flag | Single “Loyalty / POS effective state” panel | Shipped (Settings page) |
| Identity match review | — | DB + backfill | Admin resolve UI | Shipped |

---

## 5. Recommended returns policy matrix

Product should confirm and encode these defaults (adjustable later in Settings):

| Scenario | Points earned | Points burned (checkout discount) | HOS gift card | POS voucher (points→LS GC) |
|----------|---------------|-----------------------------------|---------------|-------------------------------|
| Full online cancel before fulfil | Claw earn (idempotent) | Restore burn | Full restore (already) | N/A |
| Full online return (refunded) | Claw earn proportional to refunded lines | Restore burn proportional to discount share | Proportional restore (already) | N/A |
| Partial return | Claw earn for returned line share | Restore burn × (returned / order) capped | Proportional GC | N/A |
| POS sale void | Claw earn (already) | N/A | N/A | N/A |
| POS voucher issue failed | N/A | Restore (already) | N/A | `FAILED` |
| Store return after voucher used | No auto point restore | N/A | N/A | Lightspeed GC refund; optional admin goodwill restore |

**Ledger source codes for automation:** `ORDER_CANCEL`, `RETURN_REFUND`, `POS_SALE_VOID` (exists), `POS_VOUCHER_FAIL` (exists), `ADMIN_ADJUST`.

---

## 6. Target end-state

```text
Admin UI
  ├── Loyalty Settings          ← global knobs (DB + env fallback)
  ├── Tiers / Earn / Redeem / Campaigns  ← existing, enhanced
  ├── Members → Ledger          ← per-member history + instruments
  ├── POS Vouchers              ← list / detail
  ├── Returns policy            ← cancel/return loyalty rules
  └── Finance → Liability reports + “Xero export” (optional)

HOS Core
  ├── Points wallet (SoR)
  ├── Gift card ledger (SoR)
  ├── Reversal engine (cancel / return)
  └── Optional daily export → Xero
```

---

## 7. Phase 1 — Loyalty Settings UI (spec)

### Goal

Move all business-facing loyalty/gift-card knobs from Railway env edits into **Admin → Loyalty → Settings**, with env as deploy-time fallback only.

### Route & nav

- Page: `/admin/loyalty/settings`  
- Menu: under Loyalty section in `apps/web/src/lib/adminMenus.ts`  
- API: `GET/PUT /admin/loyalty/settings` (admin auth)

### Data model (proposed)

> **As built:** settings live in a `Config` row (`level=PLATFORM`, `levelId=PLATFORM`,
> `key=LOYALTY_PROGRAMME_SETTINGS`) holding this shape as JSON, which avoided a
> migration. The field names, defaults, and resolution order below still apply.

```prisma
model LoyaltyProgrammeSettings {
  id                        String   @id @default(uuid())
  /// Singleton row: use fixed id or enforce single row in service
  defaultEarnRate           Decimal  @default(1) @db.Decimal(8, 4)
  defaultRedeemValue        Decimal  @default(0.01) @db.Decimal(8, 6)
  minRedemptionPoints       Int      @default(100)
  pointsExpiryMonths        Int      @default(24) // 0 = disabled
  cardPrefix                String   @default("HOS")
  redemptionAtCheckout      Boolean  @default(true)
  posVoucherEnabled         Boolean  @default(false)
  posVoucherMinAmount       Decimal  @default(1) @db.Decimal(10, 2)
  posVoucherMaxAmount       Decimal  @default(500) @db.Decimal(10, 2)
  giftCardCatalogAmounts    String   @default("25,50,100,250,500") // CSV
  giftCardDefaultCurrency   String   @default("GBP")
  /// Returns policy
  restoreBurnOnCancel       Boolean  @default(true)
  clawEarnOnCancel          Boolean  @default(true)
  restoreBurnOnReturn       Boolean  @default(true)
  clawEarnOnReturn          Boolean  @default(true)
  updatedAt                 DateTime @updatedAt
  updatedByUserId           String?
}
```

### Resolution order

1. DB settings row (if present)  
2. Else env (`LOYALTY_*`, `GIFT_CARD_*`, `POS_GIFT_CARD_*`)  
3. Else code defaults  

Hard kill-switches stay as **feature flags + env**: `LOYALTY_ENABLED` / `LOYALTY_PROGRAMME`, `POS_ENABLED` / `POS_INTEGRATION`.

### UI sections

1. **Earning** — default earn rate  
2. **Redemption** — redeem value, min points, checkout toggle  
3. **Expiry** — months (0 = never)  
4. **Card** — prefix  
5. **POS vouchers** — enable, min/max amount  
6. **Gift card catalogue** — amounts CSV, currency  
7. **Returns policy** — four booleans above  
8. **Effective runtime** — read-only: flags + env + DB merged status  

### Acceptance criteria

- [ ] Admin can change redeem value without redeploy  
- [ ] Checkout and POS voucher services read settings via one resolver  
- [ ] Audit: `updatedAt` + `updatedByUserId`  
- [ ] Env still works if DB row missing (staging bootstrap)

### Vendor / store (Phase 1b)

- Seller admin: toggle `loyaltyEnabled`, optional `loyaltyEarnRate`  
- Store admin: `loyaltyRedeemValue`  
- Surfaces in existing vendor/store admin pages, not only Settings

---

## 8. Phase 2 — Customer ledger UX (spec)

### Admin: per-member ledger

**Path:** `/admin/loyalty/members/[userId]` (or drawer on members page)

| Panel | Content |
|-------|---------|
| Header | Name, email, tier, balance, total earned, card number, opt-ins |
| Instruments | Points balance · HOS gift cards (count/balance) · open POS vouchers |
| Ledger table | Date, type (EARN/BURN/EXPIRE/ADJUST), points, channel, source, sourceId, description |
| Filters | Type, channel, date range |
| Actions | Adjust points (existing), export CSV |
| Related | Link to orders / POS sales if sourceId matches |

**API enhancements**

- `GET /admin/loyalty/members/:userId/transactions?type&channel&from&to&page`  
- `GET /admin/loyalty/members/:userId/instruments`  

### Admin: POS vouchers

**Path:** `/admin/loyalty/pos-vouchers`

| Columns | id, member, store, amount, points, status, cardNumber (masked), issuedAt, clientId |
| Filters | status (`PENDING`/`ISSUED`/`FAILED`/`REVERSED`/`RECONCILED`), store, date |
| Detail | Lightspeed linkage, redemptionId, retry action if `FAILED` |

**API:** `GET /admin/loyalty/pos-vouchers`, `GET /admin/loyalty/pos-vouchers/:id`

### Customer: points history

**Path:** `/loyalty` or `/loyalty/history`

- Paginated list from existing `GET /loyalty/transactions`  
- Show type, points (+/−), date, human description  
- Empty state + link to rewards  

### Gift cards admin

- Add **Refund** action on `/admin/gift-cards` calling existing `POST /gift-cards/:id/refund`  
- Show transaction history inline (already partially present)

### Acceptance criteria

- [ ] Support can answer balance + last 20 movements without SQL  
- [ ] POS vouchers visible without DB access  
- [ ] Customer can see their own earn/burn history  

---

## 9. Phase 3 — Returns / reversal engine (spec)

### Service

`LoyaltyReversalService` (new) in `services/api/src/loyalty/services/reversal.service.ts`

| Method | Trigger |
|--------|---------|
| `onOrderCancelled(orderId)` | `OrdersService.cancel` after GC restore |
| `onReturnRefunded(returnId, refundAmount)` | `RefundsService.processRefund` |
| (existing) `reversePosSaleEarn` | Sales import void |
| (existing) POS voucher `reverseBurn` | Issue failure |

### Behaviour (honour Settings policy flags)

**Cancel (full parent order)**

1. If `clawEarnOnCancel` and `order.loyaltyPointsEarned > 0`: ADJUST negative with source `ORDER_CANCEL`, idempotency `reverse:ORDER_EARN:{orderId}`  
2. If `restoreBurnOnCancel` and `order.loyaltyPointsRedeemed > 0`: ADJUST positive with source `ORDER_CANCEL_RESTORE_BURN`, idempotency `restore:ORDER_BURN:{orderId}`  
3. Never drive balance negative on clawback (cap at current balance; log remainder)  

**Return refund (partial/full)**

1. Compute share = `refundAmount / order.total` (clamp 0..1)  
2. Claw earn ≈ `round(order.loyaltyPointsEarned * share)` if `clawEarnOnReturn`  
3. Restore burn ≈ `round(order.loyaltyPointsRedeemed * share)` if `restoreBurnOnReturn`  
4. Idempotency keys include `returnId` / refund id  

### Out of scope for v1

- Automatic restore of points after in-store return of POS-voucher tender (manual admin adjust + policy note)

### Acceptance criteria

- [ ] Cancel with loyalty discount restores points when policy on  
- [ ] Cancel claws earn when policy on  
- [ ] Double cancel / double refund is idempotent  
- [ ] Unit tests for partial return share math  

---

## 10. Phase 4 — Lightspeed safety & ops (spec)

### Go-live checklist (before `POS_ENABLED=true` + `POS_INTEGRATION`)

1. **Inventory dummy users** (test/example/mailinator emails).  
2. **Delete or deactivate** their `LoyaltyMembership` rows (blocks sync).  
3. **Loyalty Settings:** `posVoucherEnabled=false` until staff trained.  
4. **Identity backfill** with `dryRun: true`; review `NO_MATCH` / `MULTIPLE_MATCH` / `BACKFILL_CONFLICT`.  
5. **Prefer Lightspeed demo/test store** for first end-to-end (Developer Portal → Test Stores, 30-day demo).  
6. Configure **sale webhooks** to HOS for near-real-time earn; confirm poll cron as backup.  
7. Verify dual gates: both env and flag required.  

### Engineering fixes

| Fix | Detail |
|-----|--------|
| Dual-gate drift | `loyalty.service` enroll POS sync and any `POS_ENABLED`-only callers → `isPosRuntimeEnabled` |
| Admin Identity Match Review | UI for `IdentityMatchReview` OPEN rows: assign membership / dismiss |
| Runtime status panel | On Loyalty Settings: show effective POS/Loyalty/Accounting gates |
| Sync dry-run mode | Optional config `POS_CUSTOMER_SYNC_DRY_RUN` for staging |

### Dummy-user SQL sketches (ops)

```sql
-- Review candidates (adjust patterns)
SELECT id, email, "firstName", "lastName", role, "createdAt"
FROM users
WHERE email ILIKE '%test%'
   OR email ILIKE '%example%'
   OR email ILIKE '%dummy%'
   OR email ILIKE '%mailinator%';

SELECT u.email, lm.id AS membership_id, lm."pointsBalance", lm."totalPointsEarned"
FROM loyalty_memberships lm
JOIN users u ON u.id = lm."userId"
WHERE u.email ILIKE '%test%' OR u.email ILIKE '%example%';
```

### Acceptance criteria

- [ ] No enroll path syncs when `POS_INTEGRATION` is false  
- [ ] Dry-run backfill report reviewed before live stamp  
- [ ] Identity conflicts resolvable in admin  

---

## 11. Phase 5 — Finance: HOS reports + Xero as optional export (spec)

### Principle

Customer liability is reported **in HOS**. Xero journals are a **downstream export**.

### HOS Finance reports (new)

**Path:** `/admin/finance/loyalty-liability` (or under Loyalty Analytics)

| Report | Definition |
|--------|------------|
| Points outstanding | Σ member balances × redeem value |
| Points earned / burned / expired (period) | From `LoyaltyTransaction` |
| HOS GC liability | Σ ACTIVE gift card balances |
| HOS GC issued / redeemed / refunded (period) | From `GiftCardTransaction` |
| POS vouchers issued (period) | From `LoyaltyPosVoucher` status ISSUED |
| Breakage | EXPIRE × redeem value |

Export CSV for accountants.

### Xero admin UX changes

- Rename nav/page copy: **“Xero export (optional)”**  
- Banner when disabled: “Loyalty and gift cards continue to run in HOS. Enable only to push daily summary journals.”  
- Keep CoA mapping, outbox, manual run — unchanged technically  
- Document CoA agreement with finance (default codes in `accounting.types.ts`)

### Accountant one-pager (reference)

See conversation sketch: daily `ONLINE_SALES`, `POINTS_LIABILITY`, `GC_BRIDGE_RECLASS`, `HOS_GIFT_CARDS`, `REFUNDS`. Store retail stays on Lightspeed→Xero.

### Acceptance criteria

- [ ] Finance can compute points + GC liability from HOS without Xero  
- [ ] Enabling Xero is explicitly optional in UI copy  
- [ ] HOS reports match journal inputs for the same UTC day (reconcilable)  

---

## 12. Phased roadmap & acceptance summary

| Phase | Outcome | Depends on | Status |
|-------|---------|------------|--------|
| **0** | This document | — | Done |
| **1** | Loyalty Settings UI + DB settings + resolver | Product sign-off on defaults | Built (defaults still need product sign-off) |
| **2** | Per-member ledger, POS voucher admin, customer history, GC refund UI | Phase 1 resolver helpful | Built (incl. ledger CSV export + voucher retry) |
| **3** | Cancel/return reversal engine | Phase 1 returns policy flags | Built |
| **4** | POS safety, dual-gate fix, identity review, go-live checklist | Dummy cleanup ops | Code built; **dummy-user cleanup still required before production POS enable** |
| **5** | HOS liability reports + Xero export labeling | Phase 2 data visibility | Built |

### Suggested sequencing for go-live

1. Phase 0 (done — this doc)  
2. Phase 4 ops cleanup (dummy users) **before** any production POS enable  
3. Phase 1 Settings (so rates/toggles are controlled)  
4. Phase 3 Reversals (before public loyalty marketing)  
5. Phase 2 Ledger UX (support readiness)  
6. Phase 5 Finance reports; enable Xero export only after CoA sign-off  

---

## 13. Go-live checklist (condensed)

### Product / Finance

- [ ] Confirm returns policy matrix (Section 5)  
- [ ] Confirm earn rate, redeem value, expiry, voucher min/max  
- [ ] Confirm CoA mapping if Xero export will be used  
- [ ] Confirm HOS vs Lightspeed gift-card language for support scripts  

### Engineering

- [ ] Implement Phase 1 settings resolver  
- [ ] Fix dual-gate drift on customer sync  
- [ ] Implement Phase 3 reversals behind policy flags  
- [ ] Webhook URL + secret configured for production store (or accept 15m poll)  

### Ops

- [ ] Purge / quarantine dummy loyalty memberships  
- [ ] Dry-run identity backfill; resolve conflicts  
- [ ] Train staff on POS lookup + voucher redeem  
- [ ] Support FAQ from `LOYALTY_AND_GIFT_CARD_PROCESS_GUIDE.md`  

### Test

- [ ] Execute critical path from `LOYALTY_AND_GIFT_CARD_MANUAL_TEST_PLAN.md` against **demo** Lightspeed first  
- [ ] Verify cancel restores burn + claws earn when policy on  
- [ ] Verify Xero off does not block earn/redeem  

---

## 14. Related documents

| Doc | Purpose |
|-----|---------|
| `docs/LOYALTY_AND_GIFT_CARD_PROCESS_GUIDE.md` | Ops / marketing / support processes |
| `docs/LOYALTY_AND_GIFT_CARD_ADMIN_CONFIGURATION_GUIDE.md` | Current admin + env configuration |
| `docs/LOYALTY_AND_GIFT_CARD_MANUAL_TEST_PLAN.md` | 75 manual test cases |
| `docs/THE_ENCHANTED_CIRCLE_IMPLEMENTATION_PLAN.md` | Historical programme plan |

---

## 15. Open decisions for Product (track explicitly)

1. Confirm returns defaults in Section 5 (especially partial returns).  
2. Currency default for gift cards: GBP vs USD for UK store.  
3. Whether Council of Realms invite-only remains manual-only.  
4. Whether customer self-purchase of HOS gift cards is payment-backed before public launch.  
5. Soft vs hard delete of loyalty data under GDPR requests.

---

## Appendix A — Dual gates (effective state)

| Domain | Env | Feature flag | Helper |
|--------|-----|--------------|--------|
| Loyalty | `LOYALTY_ENABLED` | `LOYALTY_PROGRAMME` | `isLoyaltyRuntimeEnabled` |
| POS | `POS_ENABLED` | `POS_INTEGRATION` | `isPosRuntimeEnabled` |
| Xero | `ACCOUNTING_ENABLED` | `ACCOUNTING_XERO` | `AccountingService.isEnabled` |

Both sides must be on for runtime side-effects. UI Settings (Phase 1) should display this clearly.

## Appendix B — Sample accountant day (HOS export view)

When Xero export is enabled, one UTC day may produce:

1. `ONLINE_SALES` — revenue, tax, fees, GC redeem, loyalty discount  
2. `REFUNDS` — refunds + tax reversed  
3. `POINTS_LIABILITY` — earn / burn / expire valued at redeem rate  
4. `GC_BRIDGE_RECLASS` — POS vouchers issued (points → GC liability)  
5. `HOS_GIFT_CARDS` — issue / redeem / expiry  

In-store register sales remain on Lightspeed’s Xero feed.

---

*End of document. Implementation of Phases 1–5 should follow this spec; no production POS enablement until Section 13 ops items are complete.*

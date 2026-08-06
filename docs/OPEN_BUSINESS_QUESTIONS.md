# Open Business Questions

These questions must be answered before full production rollout. Each has a recommended default action and the deployment phase it blocks.

## Xero Configuration (blocks Phase 4)

- [ ] **Which Xero organisation?** Do UK and US outlets post to separate Xero tenants, or a single consolidated org?
  - *Impact:* Determines whether we need multi-tenant OAuth or a single connection.
  - *Action needed:* Finance team to confirm org structure and provide demo org credentials for testing.

- [ ] **Chart of accounts mapping.** Which specific Xero account codes should be used for:
  - Online sales revenue (by category or single account?)
  - Stripe fees expense
  - Stripe receivable
  - Gift card liability
  - Loyalty points liability
  - Gift card expiry revenue
  - *Action needed:* Finance team to provide account codes or confirm auto-seeding from existing Xero CoA.

## Lightspeed Configuration (blocks Phase 0)

- [ ] **Is Lightspeed native loyalty currently enabled?** Check `config.enable_loyalty` and whether payment type `106` exists in any outlet. If Lightspeed's own loyalty is active, its `customer.loyalty_balance` will drift against HOS points.
  - *Recommended:* Disable Lightspeed native loyalty before enabling HOS loyalty in-store.
  - *Action needed:* POS admin to verify and disable if present.

- [ ] **How many customers exist in the Lightspeed account?** This determines:
  - Identity backfill duration and API rate budget
  - Expected review-queue volume for ambiguous matches
  - *Action needed:* POS admin to provide an approximate count.

## Loyalty Programme (blocks Phase 2)

- [ ] **Points-to-currency redemption rate per region.** Currently configured per-store via `Store.loyaltyRedeemValue` (default 0.01, i.e. 100 points = 1.00 currency unit). Should different regions/stores have different rates?
  - *Action needed:* Business to confirm rate per region/store.

- [ ] **Gift card expiry on bridge vouchers.** When points are burned to issue a Lightspeed gift card, should that card expire? Legal constraints vary:
  - UK: gift cards cannot expire within 24 months (Consumer Rights Act 2015)
  - US: varies by state, some prohibit expiry entirely
  - *Recommended:* No expiry on bridge vouchers initially.
  - *Action needed:* Legal/compliance to confirm per jurisdiction.

- [ ] **Gift card breakage recognition.** When loyalty-issued gift cards expire with remaining balance, should the liability be recognised as revenue automatically, or reviewed each period?
  - *Recommended:* Manual review per period until volume warrants automation.
  - *Action needed:* Finance team to confirm accounting treatment.

## Operations (blocks Phase 0.5)

- [ ] **Primary in-store lookup method.** Will retail staff scan the loyalty QR at the till as the default, or continue typing email/mobile?
  - *Impact:* If QR scanning is the norm, ambiguous phone matching is rarely exercised. If staff type mobile, we need to monitor the review queue closely.
  - *Action needed:* Retail operations to confirm till workflow.

- [ ] **Default dialling code per region.** E.164 normalisation needs a fallback country code when `User.country` is unset (current default: GB/+44).
  - *Action needed:* Confirm per-region defaults (e.g. GB for UK stores, US for US stores).

## Timeline Recommendation

1. **Week 1:** Answer Lightspeed questions, disable native loyalty, run identity backfill
2. **Week 2:** Enable POS ingestion fixes, monitor for one week
3. **Week 3:** Enable voucher bridge in one store with low cap
4. **Week 4:** Enable recon job, monitor for one week
5. **Week 5–8:** Connect Xero demo org, run daily journals, tie out with finance
6. **Week 9:** Production Xero connection (after finance sign-off)

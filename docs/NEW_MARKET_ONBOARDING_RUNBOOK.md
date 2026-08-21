# New Market Onboarding Runbook

Practical, ordered checklist for launching an additional market on HOS. The platform currently runs as a **single region deployment** (USD / US after the GBP→USD migration). Planned next markets: **UK**, **UAE**, and **Malaysia**.

Companion docs:

- [`ADMIN_CONFIGURATION_GUIDE.md`](./ADMIN_CONFIGURATION_GUIDE.md) §12 — region precedence, env validation, tax origin, cache
- Source of truth: `services/api/src/config/platform-region.service.ts`

---

## Table of Contents

1. [Before you start](#1-before-you-start)
2. [Environment variables](#2-environment-variables)
3. [Tax provider and nexus](#3-tax-provider-and-nexus)
4. [Payments / Stripe](#4-payments--stripe)
5. [Currency decimal handling](#5-currency-decimal-handling)
6. [Address formats and labels](#6-address-formats-and-labels)
7. [Shipping carriers](#7-shipping-carriers)
8. [Multi-currency (optional)](#8-multi-currency-optional)
9. [Pre-launch verification checklist](#9-pre-launch-verification-checklist)
10. [Limitations (not yet built)](#10-limitations-not-yet-built)

---

## 1. Before you start

Confirm which mode you are launching:

| Mode | Meaning | Supported today? |
|------|---------|------------------|
| **Replace the platform region** | One deployment switches from US to UK (or UAE / MY) | Yes — change `PLATFORM_*` + `TAX_ORIGIN_*`, restart, re-verify tax/payments/shipping |
| **Run two markets in one deployment** | US storefront and UK storefront simultaneously | **No** — region config is platform-wide (see [§10](#10-limitations-not-yet-built)) |

Store rows in the database have their own `country` / `currency` / `timezone` fields, but shopper-facing region resolution (`GET /config/region`, money/date formatting, tax origin country fallback) comes from `PlatformRegionService`, not from the active storefront.

---

## 2. Environment variables

Set these on the **API** service, then restart. Malformed `PLATFORM_*` / `TAX_ORIGIN_COUNTRY` values fail boot (see Admin Configuration Guide §12).

### 2.1 Core region

| Variable | US (current) | UK | UAE | Malaysia |
|----------|--------------|----|-----|----------|
| `PLATFORM_CURRENCY` | `USD` | `GBP` | `AED` | `MYR` |
| `PLATFORM_COUNTRY` | `US` | `GB` | `AE` | `MY` |
| `PLATFORM_LOCALE` | `en-US` | `en-GB` | `en-AE` *(or `ar-AE` if Arabic UI is ready — confirm)* | `en-MY` *(or `ms-MY` — confirm)* |
| `PLATFORM_TIMEZONE` | `America/New_York` | `Europe/London` | `Asia/Dubai` | `Asia/Kuala_Lumpur` |

### 2.2 Tax origin (ship-from)

Required whenever a tax integration is active in production/staging:

| Variable | Notes |
|----------|-------|
| `TAX_ORIGIN_STREET` | Warehouse / fulfilment street |
| `TAX_ORIGIN_CITY` | City |
| `TAX_ORIGIN_STATE` | **Required for US**; optional for GB/AE/MY in code |
| `TAX_ORIGIN_POSTAL_CODE` | ZIP / postcode |
| `TAX_ORIGIN_COUNTRY` | ISO country; falls back to `PLATFORM_COUNTRY` if unset |

Example (US Times Square origin used in tests):

```
TAX_ORIGIN_STREET=1564 Broadway
TAX_ORIGIN_CITY=New York
TAX_ORIGIN_STATE=NY
TAX_ORIGIN_POSTAL_CODE=10036
TAX_ORIGIN_COUNTRY=US
```

For UK/UAE/MY, set the real fulfilment origin for that market. A wrong origin can silently produce incorrect tax — do not copy the US address into another market.

### 2.3 Optional

| Variable | Purpose |
|----------|---------|
| `PLATFORM_REGION_CACHE_TTL_MS` | Region cache TTL (default `15000`) |
| `GIFT_CARD_DEFAULT_CURRENCY` | Gift card fallback currency (defaults to platform currency when unset) |
| `LOYALTY_DEFAULT_EARN_RATE` / `LOYALTY_DEFAULT_REDEEM_VALUE` | Loyalty earn/redeem in major currency units of the platform currency |

---

## 3. Tax provider and nexus

### 3.1 Configure the provider

Admin path: `/admin/settings/integrations/tax`

| Provider | Credential fields |
|----------|-------------------|
| Avalara | `accountId`, `licenseKey`, `companyCode` |
| TaxJar | `apiToken` |
| Stripe Tax | `stripeSecretKey`, `stripeWebhookSecret` (optional) |

Activate only after `TAX_ORIGIN_*` is complete. In production/staging, `TaxFactoryService` calls `assertTaxOriginConfigured` and **fails closed** if a provider is active without a complete origin.

### 3.2 Nexus considerations by market

These are operational prompts, not legal advice. Confirm with tax counsel / the provider’s nexus tools before go-live.

| Market | Code considerations | Confirm before launch |
|--------|---------------------|----------------------|
| **US** | Origin state required; providers calculate destination-based sales tax from ship-from + ship-to | Economic nexus per state; marketplace facilitator rules; Stripe Tax vs Avalara/TaxJar coverage |
| **UK** | State optional in our builder; VAT is not the same as US sales tax | Whether the chosen provider is configured for UK VAT; registration thresholds |
| **UAE** | State optional; AED is two-decimal | VAT registration / designated zone rules; provider support for AE |
| **Malaysia** | State optional; MYR is two-decimal | SST vs VAT treatment; provider support for MY |

**Needs confirmation:** Exact Avalara/TaxJar/Stripe Tax company codes and nexus registrations per market are not encoded in the repo — configure them in the provider dashboard and store credentials via Integrations.

---

## 4. Payments / Stripe

### 4.1 Account

1. Use a Stripe account (or Stripe Connect platform) whose **default settlement currency** matches `PLATFORM_CURRENCY`, or confirm multi-currency settlement is enabled for that account.
2. Store keys via Admin → Integrations → Stripe (`publishableKey`, `secretKey`, `webhookSecret`), or fall back to `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` env vars.
3. Point webhooks at the API payment webhook endpoint used by the deployment.

### 4.2 Payment method differences

The Stripe provider creates PaymentIntents with `automatic_payment_methods: { enabled: true }`. Which methods appear (cards, wallets, local methods) is controlled by the **Stripe account country + Dashboard payment method settings**, not by a hard-coded list in HOS.

| Market | Typical methods to enable in Stripe Dashboard *(confirm)* |
|--------|-----------------------------------------------------------|
| US | Cards, Apple Pay / Google Pay, Link, Affirm/Afterpay if offered |
| UK | Cards, Apple Pay / Google Pay, Link; optionally Bacs/other UK methods if approved |
| UAE | Cards; local methods only if Stripe supports them for the account country |
| Malaysia | Cards; FPX / other local methods only if the Stripe account supports them |

Charge amounts are converted to Stripe minor units via `services/api/src/common/money.ts` (`toMinorUnits` / `fromMinorUnits`) using the PaymentIntent currency.

---

## 5. Currency decimal handling

Stripe (and our helpers) do **not** treat every currency as two-decimal.

| Class | Examples | Minor-unit exponent |
|-------|----------|---------------------|
| Zero-decimal | JPY, KRW (also BIF, CLP, DJF, GNF, KMF, MGA, PYG, RWF, UGX, VND, VUV, XAF, XOF, XPF) | 0 |
| Two-decimal (default) | USD, GBP, AED, MYR, EUR, … | 2 |
| Three-decimal | BHD, KWD (also IQD, JOD, LYD, OMR, TND) | 3 |

Implementation: `services/api/src/common/money.ts` (`ZERO_DECIMAL_CURRENCIES`, `THREE_DECIMAL_CURRENCIES`, `toMinorUnits`, `fromMinorUnits`). Storefront display uses `apps/web/src/lib/money.ts` → `@hos-marketplace/utils` formatters with the platform locale/currency from `regionConfig`.

When adding a currency outside the two-decimal set, verify both API charge creation and UI formatting against Stripe’s currency exponent list.

---

## 6. Address formats and labels

Storefront address copy is region-aware via `apps/web/src/components/addressFieldLabels.ts`.

| Country keys | Postal label | Subdivision label | Phone label |
|--------------|--------------|-------------------|-------------|
| `US` / `UNITED STATES` | ZIP code | State | Phone |
| `GB` / `UK` / `UNITED KINGDOM` | Postcode | County | Mobile |
| `AE` / `UNITED ARAB EMIRATES` | Postal code | Emirate | Mobile |
| `MY` / `MALAYSIA` | Postcode | State | Mobile |
| Default (unknown) | Postal code | State / Province / Region | Phone |

`regionCountryToFormValue()` maps platform country codes onto the select option values used in forms (`United States`, `United Kingdom`, `United Arab Emirates`, `Malaysia`).

**To extend a new market:** add entries to `BY_COUNTRY` (ISO code + full name) and a branch in `regionCountryToFormValue` if the country appears in address dropdowns. No backend change is required for labels alone.

---

## 7. Shipping carriers

Built-in courier providers under `services/api/src/shipping/courier/`:

| Provider | Typical market fit |
|----------|--------------------|
| **USPS** | US domestic / USPS international |
| **FedEx** | US + international |
| **DHL** | International express (including UK/UAE/MY lanes where contracted) |
| **Shippo** | Multi-carrier aggregator (depends on Shippo account carriers) |

Configure credentials at `/admin/settings/integrations/shipping`.

**Not present as first-class adapters today** (needs confirmation / new integration work before relying on them): Royal Mail, Aramex, Emirates Post, Pos Laju, and other local last-mile carriers. For UK/UAE/MY launches, either:

1. Use FedEx/DHL/Shippo with accounts that cover that market, or
2. Add a new courier provider + Integration credentials schema.

Also configure shipping methods/rules and logistics partners for the market’s fulfilment centres.

---

## 8. Multi-currency (optional)

Launch default is **single currency** (platform currency only).

### Enable

1. Set `FF_MULTI_CURRENCY=true`, **or** enable feature flag `MULTI_CURRENCY` in Admin → Feature Flags, **or**
2. Set an explicit list: `GLOBAL_SUPPORTED_CURRENCIES=USD,GBP,AED,MYR`

`CurrencyService` always includes the platform base currency. The built-in catalog when the flag alone is used is: `USD`, `EUR`, `GBP`, `AED`, `JPY`, `AUD`, `CAD`, `SGD`. **MYR is not in that catalog** — include it via `GLOBAL_SUPPORTED_CURRENCIES` if needed.

### FX rate source

- Open: `https://api.exchangerate-api.com/v4/latest/{base}`
- Authenticated (preferred): `https://v6.exchangerate-api.com/v6/{EXCHANGE_RATE_API_KEY}/latest/{base}` when `EXCHANGE_RATE_API_KEY` is set
- Cached in Redis (~1 hour) and `currency_exchange_rates` table
- Fallback static rates exist for a small set of codes; unknown codes fall back to `1`

While multi-currency is disabled, `convertBetween` throws and tells the operator to set `FF_MULTI_CURRENCY` or `GLOBAL_SUPPORTED_CURRENCIES`.

---

## 9. Pre-launch verification checklist

Use this after env/deploy changes for the target market.

### Region and boot

- [ ] API starts successfully with the new `PLATFORM_*` values (no env validation errors)
- [ ] `GET /config/region` returns the expected `currency`, `country`, `locale`, `timezone`
- [ ] Admin → Settings → Payment → Platform Region matches that snapshot
- [ ] Storefront prices format with the correct currency symbol and locale
- [ ] Admin dates/times render in `PLATFORM_TIMEZONE`

### Tax

- [ ] All required `TAX_ORIGIN_*` fields set for the market origin
- [ ] Tax integration tested (`POST /integrations/:id/test`) and activated
- [ ] Staging/production boot (or tax factory refresh) does **not** throw incomplete-origin errors
- [ ] Sample checkout tax estimate for an in-market address looks plausible (compare to provider calculator)
- [ ] Confirm wrong-origin regression: origin country matches the selling market

### Payments

- [ ] Stripe test payment succeeds in `PLATFORM_CURRENCY`
- [ ] Webhook marks order paid
- [ ] Zero-decimal / three-decimal currencies (if used) charge the correct minor units
- [ ] Desired local payment methods appear in Checkout (Stripe Dashboard configuration)

### Addresses and shipping

- [ ] Checkout address labels match the market (ZIP vs Postcode vs Postal code)
- [ ] Shipping rates return for a domestic destination in that market
- [ ] Label/tracking smoke test for the chosen carrier

### Loyalty / gift cards

- [ ] Earn rate reads as points per **major currency unit** of the platform currency
- [ ] Redeem value and catalogue amounts display in the platform currency
- [ ] `GIFT_CARD_DEFAULT_CURRENCY` (or Settings catalogue currency) matches the market

### Multi-currency (only if enabling)

- [ ] Currency selector lists the intended codes
- [ ] FX rates load (or fail loudly — not silently `1` for critical pairs)
- [ ] Conversion disabled path still works if you turn the flag off

### Data / migration

- [ ] If switching an existing database’s defaults, apply / verify `20261011120000_us_region_normalisation` (or a follow-up market migration) so column defaults are not left on a previous market’s currency/country/timezone
- [ ] Note: that migration **relabels** currency codes; it does **not** FX-convert historic amounts

---

## 10. Limitations (not yet built)

Verified against the current codebase — do not plan launches that depend on these:

1. **Multi-region single deployment is landing.** A first-class `Market` row (US / GB / AE / MY) plus request-scoped `x-market-code` now feed `PlatformRegionService`. Shopper-facing region follows the resolved market when ALS context is present; env/`PLATFORM_*` remains the process fallback for boot, cron, and unscoped requests. Concurrent storefronts still need host→market mapping and `marketId` backfill verified before flipping `ACCESS_CONTROL_DATA_SCOPE=enforce`. See Admin Configuration Guide §13.
2. **No admin UI for `platformCurrency` / `platformCountry` / `platformLocale` / `platformTimezone`.** The Payment tab shows a read-only region snapshot; operators change region via env (or raw Config rows).
3. **Tax origin is env-only.** Cannot be edited in Admin Settings; incomplete origin fails closed in production/staging when a tax provider is active.
4. **Region cache invalidation is not wired to an admin save path.** Expect up to ~15s propagation for DB overrides; env changes need restart.
5. **Admin Payment `currency` (Default Currency) ≠ platform region.** It writes Config key `currency` and does not feed `PlatformRegionService`.
6. **Local carriers for UK/UAE/MY are not first-class.** USPS/FedEx/DHL/Shippo exist; Royal Mail / Aramex / Pos Laju / etc. are not implemented as dedicated providers.
7. **MYR (and other non-catalog currencies) need an explicit `GLOBAL_SUPPORTED_CURRENCIES` list** (or code change to `GLOBAL_CURRENCY_CODES`) for multi-currency mode.
8. **True multi-market loyalty redeem values** (e.g. 100 pts = £1 in UK and $1 in US at once) are not driven by platform region today; `Store.loyaltyRedeemValue` exists for POS overrides but does not make the web programme multi-market.
9. **Schema / Config DB overrides for region are read but not productised.** Prefer env for operational changes until an admin write path + `invalidate()` wiring exists.

When those limitations are removed, update this runbook and Admin Configuration Guide §12 in the same change set.

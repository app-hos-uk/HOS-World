# Admin Configuration Guide

This guide covers every configurable area in the HOS admin panel, how credentials are stored, and which settings require environment variables vs database configuration.

---

## Table of Contents

1. [Platform Settings](#1-platform-settings)
2. [Integration Credentials](#2-integration-credentials)
3. [POS Connections](#3-pos-connections)
4. [Xero Accounting](#4-xero-accounting)
5. [Webhooks](#5-webhooks)
6. [Loyalty Programme](#6-loyalty-programme)
7. [Feature Flags](#7-feature-flags)
8. [User Management](#8-user-management)
9. [Logistics Partners](#9-logistics-partners)
10. [Environment-Only Settings](#10-environment-only-settings)
11. [Credential Security Model](#11-credential-security-model)
12. [Platform Region Configuration](#12-platform-region-configuration)
13. [Hybrid Access Control](#13-hybrid-access-control)

---

## 1. Platform Settings

**Admin path:** `/admin/settings`
**API endpoint:** `GET/PUT /admin/settings`
**Role required:** `ADMIN`

### General Tab

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Shop Enabled | `shopEnabled` | Boolean | Master toggle for the marketplace storefront |
| Platform Name | `platformName` | String | Display name used in emails, metadata, and UI |
| Platform URL | `platformUrl` | URL | Canonical base URL for the platform |
| Maintenance Mode | `maintenanceMode` | Boolean | Shows maintenance page to non-admin visitors |
| Allow Registration | `allowRegistration` | Boolean | Enables public user registration |
| Require Email Verification | `requireEmailVerification` | Boolean | Mandates email verification on signup |
| Contact Email | `contactEmail` | Email | Public contact email shown in footer/metadata |
| Contact Phone | `contactPhone` | String | Public contact phone number |
| Contact Address | `contactAddress` | String | Physical address for footer/structured data |
| Footer About | `footerAbout` | Text | Short description displayed in site footer |
| Facebook URL | `socialFacebookUrl` | URL | Social media link |
| Instagram URL | `socialInstagramUrl` | URL | Social media link |
| X (Twitter) URL | `socialXUrl` | URL | Social media link |

### Email Tab

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| SMTP Host | `smtpHost` | String | SMTP server hostname for email delivery |
| SMTP Port | `smtpPort` | Number (1–65535) | SMTP server port |
| SMTP User | `smtpUser` | String | SMTP authentication username |
| SMTP From | `smtpFrom` | Email | Default "From" address for outgoing emails |
| Email Notifications | `emailNotifications` | Boolean | Master toggle for email notifications |

> **Note:** These are platform-level preferences persisted in the Config table. For the actual SMTP password, use the `SMTP_PASS` environment variable. For transactional email via SendGrid, configure it through Integrations.

### Payment Tab

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Stripe Enabled | `stripeEnabled` | Boolean | Toggle Stripe payment processing |
| Stripe Test Mode | `stripeTestMode` | Boolean | Use Stripe test keys vs live keys |
| Currency | `currency` (sent as `defaultCurrency`) | String | Legacy admin payment setting; shopper-facing currency follows platform region (see [§12](#12-platform-region-configuration)) |
| Platform Fee | `platformFeeRate` (sent as `platformFee`) | Number (0–100%) | Percentage fee on seller transactions |
| Cancellation Window | `cancellationAutoApprovalWindowMinutes` | Number (minutes) | Auto-approve cancellation requests within this window |

> **Note:** The Payment tab also shows a **read-only Platform Region** snapshot from `GET /config/region` (currency, country, locale, timezone). That snapshot is driven by deployment config (`PLATFORM_*`), not by the Default Currency dropdown. The frontend sends `platformFee` as a percentage (e.g., 15.0) and `defaultCurrency` as the key; the backend maps `platformFee / 100` to `platformFeeRate` and `defaultCurrency` to Config key `currency`. Stripe API keys are managed separately through Integrations.

### Fulfillment Tab

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Auto-Create Shipments | `autoCreateShipments` | Boolean | Automatically create shipment records on order confirmation |
| Require Tracking Number | `requireTrackingNumber` | Boolean | Mandate tracking numbers before marking orders as shipped |

### Notifications Tab

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| New Submission | `notifyOnNewSubmission` | Boolean | Send notification when a seller submits a product |
| New Order | `notifyOnNewOrder` | Boolean | Send notification on new order placement |
| Shipment Received | `notifyOnShipmentReceived` | Boolean | Send notification when a shipment is received |

---

## 2. Integration Credentials

**Admin path:** `/admin/settings/integrations`
**API endpoint:** `GET/POST/PUT/DELETE /integrations`
**Role required:** `ADMIN`

### How Credentials Are Stored

All integration credentials are encrypted using **AES-256-GCM** with PBKDF2 key derivation (100,000 iterations). The encryption key comes from the `INTEGRATION_ENCRYPTION_KEY` environment variable (64-character hex string, required in production/staging).

When reading integrations via the API, credentials are **masked** — only the last 4 characters are visible (e.g., `****abc1`). When updating, masked or empty values are skipped to prevent overwriting the real secret.

### Available Providers

#### Payment (`PAYMENT` category)

| Provider | Credential Fields | Notes |
|----------|-------------------|-------|
| Stripe | `publishableKey`, `secretKey`, `webhookSecret` (optional) | Also configurable via `STRIPE_SECRET_KEY` env var as fallback |

#### Email (`EMAIL` category)

| Provider | Credential Fields | Notes |
|----------|-------------------|-------|
| SendGrid | `apiKey`, `fromEmail` (optional), `fromName` (optional) | Falls back to SMTP env vars |

#### Shipping (`SHIPPING` category) — `/admin/settings/integrations/shipping`

| Provider | Credential Fields |
|----------|-------------------|
| USPS | `userId`, `apiKey`, `facilityId` (optional), `mailerIdNumber` (optional) |
| FedEx | `apiKey`, `secretKey`, `accountNumber`, `meterNumber` (optional) |
| DHL | `apiKey`, `accountNumber`, `siteId` (optional), `password` (optional) |
| Shippo | `apiToken`, ship-from address fields (optional) |

#### Tax (`TAX` category) — `/admin/settings/integrations/tax`

| Provider | Credential Fields |
|----------|-------------------|
| Avalara | `accountId`, `licenseKey`, `companyCode` |
| TaxJar | `apiToken` |
| Stripe Tax | `stripeSecretKey`, `stripeWebhookSecret` (optional) |

### Integration Lifecycle

1. **Create:** `POST /integrations` — provide `provider`, `category`, and `credentials` object
2. **Test:** `POST /integrations/:id/test` — validates credentials against the provider API
3. **Activate:** `PUT /integrations/:id/activate` — marks integration as active
4. **Deactivate:** `PUT /integrations/:id/deactivate` — disables without deleting
5. **Update:** `PUT /integrations/:id` — partial update; masked credential values are ignored
6. **Delete:** `DELETE /integrations/:id` — permanently removes integration and credentials

---

## 3. POS Connections

**Admin path:** `/admin/pos/connections`
**API endpoint:** `GET/POST/PUT/DELETE /admin/pos/connections`
**Role required:** `ADMIN`

### Credential Fields

| Field | Storage | Notes |
|-------|---------|-------|
| `domainPrefix` | Encrypted (AES-256-GCM) | Lightspeed account domain prefix |
| `clientId` | Encrypted | OAuth client ID |
| `clientSecret` | Encrypted | OAuth client secret |
| `accessToken` | Encrypted | OAuth access token (auto-refreshed) |
| `refreshToken` | Encrypted | OAuth refresh token |
| `webhookSecret` | Encrypted | Webhook signature verification key |

### Connection Lifecycle

1. **Create:** `POST /admin/pos/connections` — provide store name, Lightspeed credentials
2. **Test:** `POST /admin/pos/connections/:id/test` — validates connection to Lightspeed API
3. **Outlets:** `GET /admin/pos/connections/:id/outlets` — lists available Lightspeed outlets
4. **Sync:** `POST /admin/pos/connections/:id/sync` — triggers product/inventory sync
5. **Update:** `PUT /admin/pos/connections/:id` — partial updates; blank fields keep existing values

---

## 4. Xero Accounting

**Admin path:** `/admin/finance/accounting`
**API endpoint:** `GET /admin/accounting/*`
**Role required:** `ADMIN` or `FINANCE`

### Setup Flow

1. Navigate to `/admin/finance/accounting`
2. Click "Connect to Xero" — redirects to Xero OAuth consent screen
3. After approval, callback at `/api/admin/accounting/oauth/callback` stores encrypted tokens
4. Configure Chart of Accounts mapping via `/admin/accounting/coa-mapping`

### Stored Data

| Field | Storage | Source |
|-------|---------|-------|
| `accessToken` | Encrypted (IntegrationConfig) | OAuth callback |
| `refreshToken` | Encrypted (IntegrationConfig) | OAuth callback |
| `tenantId` | Encrypted (IntegrationConfig) | OAuth callback |
| CoA mapping | Plaintext JSON (IntegrationConfig.settings) | Admin UI |

### Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `XERO_CLIENT_ID` | OAuth application client ID |
| `XERO_CLIENT_SECRET` | OAuth application client secret |
| `XERO_REDIRECT_URI` | OAuth callback URL |

---

## 5. Webhooks

**Admin path:** `/admin/webhooks`
**API endpoint:** `GET/POST/PUT/DELETE /webhooks`
**Role required:** `ADMIN` (platform webhooks) or `SELLER` (seller-scoped webhooks)

### Configuration

| Field | Type | Notes |
|-------|------|-------|
| URL | String | Must be HTTPS or HTTP; private/internal addresses blocked (SSRF prevention) |
| Events | String[] | List of event types to subscribe to |
| Secret | String | Encrypted at rest; auto-generated if not provided; revealed only once on creation |
| Active | Boolean | Enable/disable webhook delivery |

### Signing

Outbound webhook payloads are signed with HMAC-SHA256 using the webhook's secret. The signature is sent in the `X-Webhook-Signature` header.

### Dead Letter Queue

Failed deliveries (5+ attempts) are moved to a dead letter queue accessible at:
- `GET /webhooks/dead-letter` — list dead-lettered deliveries
- `POST /webhooks/dead-letter/:id/retry` — retry a dead-lettered delivery

---

## 6. Loyalty Programme

**Admin path:** `/admin/loyalty/settings`
**API endpoint:** `GET/PUT /admin/loyalty/settings`
**Role required:** `ADMIN`

### Settings

| Setting | Type | Default Source |
|---------|------|---------------|
| Points per dollar spent | Number | DB over `LOYALTY_DEFAULT_EARN_RATE` env (default `1`) |
| Points redeem value (USD per point) | Number | DB over `LOYALTY_DEFAULT_REDEEM_VALUE` env (default `0.01`) |
| Minimum redemption | Number | DB over `LOYALTY_MIN_REDEMPTION_POINTS` env |
| Points expiry (months) | Number | DB over `LOYALTY_POINTS_EXPIRY_MONTHS` env |
| POS voucher limits | Number | DB over `POS_GIFT_CARD_MIN_AMOUNT` / `POS_GIFT_CARD_MAX_AMOUNT` |
| Tier multipliers | JSON | DB |

### Feature Gates

Loyalty requires **both**:
1. `LOYALTY_PROGRAMME` feature flag enabled (via `/admin/feature-flags`)
2. `LOYALTY_ENABLED` environment variable set to `true`

The runtime status endpoint (`GET /admin/loyalty/runtime-status`) shows which gate is blocking.

---

## 7. Feature Flags

**Admin path:** `/admin/feature-flags`
**API endpoint:** `GET /admin/feature-flags`, `PUT /admin/feature-flags/:flag`
**Role required:** `ADMIN`

Feature flags use a three-level cascade: **Database** > **Environment (`FF_*`)** > **Code defaults**

| Flag | Default | Description |
|------|---------|-------------|
| `POS_INTEGRATION` | false | Enable POS integration features |
| `ACCOUNTING_XERO` | false | Enable Xero accounting sync (also requires `ACCOUNTING_ENABLED`) |
| `LOYALTY_PROGRAMME` | true | Enable loyalty programme |
| `BRAND_PARTNERSHIPS` | true | Enable brand partnership campaigns |
| `AMBASSADOR_PROGRAMME` | true | Enable ambassador programme |
| `MULTI_CURRENCY` | false | Expand shopper currencies beyond the platform region currency (env: `FF_MULTI_CURRENCY`) |
| `AI_RECOMMENDATIONS` | false | Enable AI product recommendations |

Other flags loaded from the same cascade include `FOUNDING_MEMBERS`, `GUEST_CHECKOUT`, `CLICK_COLLECT`, `DIGITAL_PRODUCTS`, `INFLUENCER_STOREFRONTS`, and `EMAIL_TEMPLATE_OVERRIDES` (see `FeatureFlag` in `feature-flags.service.ts`).

---

## 8. User Management

**Admin path:** `/admin/users`
**API endpoint:** `POST /admin/users`, `POST /admin/users/:id/reset-password`
**Role required:** `ADMIN`

### Password Security

- Passwords are hashed using **bcrypt** with configurable cost rounds (`BCRYPT_PASSWORD_ROUNDS` env, default 12)
- Password reset generates a time-limited token sent via email
- Failed login attempts trigger progressive lockouts

---

## 9. Logistics Partners

**Admin path:** `/admin/logistics`
**API endpoint:** `GET/POST/PUT/DELETE /logistics/partners`
**Role required:** `ADMIN`

| Field | Type | Storage |
|-------|------|---------|
| Name | String | Plaintext |
| Type | Enum | Plaintext |
| Contact Info | JSON | Plaintext |
| API Key | String (optional) | **Encrypted** (AES-256-GCM) |
| Website | String | Plaintext |
| Active | Boolean | Plaintext |

API responses return `hasApiKey: true/false` instead of the actual key.

---

## 10. Environment-Only Settings

These settings have **no admin UI** and must be configured via deployment environment variables.

| Service | Environment Variables | Used By |
|---------|----------------------|---------|
| **Platform region** | `PLATFORM_CURRENCY`, `PLATFORM_COUNTRY`, `PLATFORM_LOCALE`, `PLATFORM_TIMEZONE`, `PLATFORM_REGION_CACHE_TTL_MS` | Region defaults for money, dates, tax origin country fallback (see [§12](#12-platform-region-configuration)) |
| **Tax origin** | `TAX_ORIGIN_STREET`, `TAX_ORIGIN_CITY`, `TAX_ORIGIN_STATE`, `TAX_ORIGIN_POSTAL_CODE`, `TAX_ORIGIN_COUNTRY` | Ship-from address for tax providers (env-only; see [§12](#12-platform-region-configuration)) |
| **Multi-currency** | `FF_MULTI_CURRENCY`, `GLOBAL_SUPPORTED_CURRENCIES`, `EXCHANGE_RATE_API_KEY` | Re-open FX conversion beyond single launch currency |
| **SMTP Fallback** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email notifications when no SendGrid integration |
| **Twilio SMS/WhatsApp** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_NUMBER`, `TWILIO_WHATSAPP_FROM` | SMS and WhatsApp messaging |
| **Meilisearch** | `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` | Full-text search engine |
| **Storage (S3)** | `STORAGE_PROVIDER`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | File uploads (S3 mode) |
| **Storage (Cloudinary)** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | File uploads (Cloudinary mode) |
| **Encryption** | `INTEGRATION_ENCRYPTION_KEY` | Encrypts all integration/POS/webhook/logistics credentials |
| **Xero OAuth App** | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` | Xero OAuth flow (tokens stored in DB) |
| **Lightspeed Defaults** | `LIGHTSPEED_CLIENT_ID`, `LIGHTSPEED_CLIENT_SECRET` | POS fallback if not per-connection |
| **Sentry** | `SENTRY_DSN` | Error monitoring |
| **Database** | `DATABASE_URL` | PostgreSQL connection |
| **Auth** | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing |

---

## 11. Credential Security Model

### Encryption at Rest

| Data | Method | Key Source |
|------|--------|-----------|
| Integration credentials (Stripe, SendGrid, shipping, tax) | AES-256-GCM + PBKDF2 | `INTEGRATION_ENCRYPTION_KEY` |
| POS connection credentials | AES-256-GCM + PBKDF2 | `INTEGRATION_ENCRYPTION_KEY` |
| Xero OAuth tokens | AES-256-GCM + PBKDF2 | `INTEGRATION_ENCRYPTION_KEY` |
| Webhook signing secrets | AES-256-GCM + PBKDF2 | `INTEGRATION_ENCRYPTION_KEY` |
| Logistics partner API keys | AES-256-GCM + PBKDF2 | `INTEGRATION_ENCRYPTION_KEY` |
| User passwords | bcrypt | n/a (one-way hash) |

### API Response Masking

- All credential fields are masked in API responses (last 4 characters visible)
- Webhook secrets are revealed **once** at creation time, then hidden
- POS connections show `hasCredentials` / `hasWebhookSecret` flags only
- Logistics partners show `hasApiKey` flag only

### Update Safety

- Masked values (`****...`) are detected by `isMaskedSecret()` and skipped on update
- Empty/blank credential fields are ignored during partial updates
- This prevents accidental overwrite of real secrets when admin forms re-submit

### Production Requirements

| Requirement | Consequence if Missing |
|-------------|----------------------|
| `INTEGRATION_ENCRYPTION_KEY` (64-char hex) | Application fails to start in production/staging |
| `JWT_SECRET` (32+ chars) | Auth tokens cannot be signed |
| `JWT_REFRESH_SECRET` (32+ chars) | Refresh tokens cannot be signed |
| `DATABASE_URL` | No database connection |
| Complete `TAX_ORIGIN_*` when a tax provider is active | API fails closed on tax-provider load in production/staging (see [§12](#12-platform-region-configuration)) |

---

## 12. Platform Region Configuration

The platform migrated from GBP/UK defaults to **USD / US / en-US / America/New_York**. Region-dependent behaviour (display currency, locale, timezone, tax ship-from) is centralised in `PlatformRegionService` on the API and exposed publicly as `GET /config/region`.

For launching an additional market (UK, UAE, Malaysia, etc.), see [`NEW_MARKET_ONBOARDING_RUNBOOK.md`](./NEW_MARKET_ONBOARDING_RUNBOOK.md).

### Precedence chain

Resolution order for currency, country, locale, and timezone:

1. **Database override** — Config rows at `level: 'PLATFORM'`, `levelId: 'PLATFORM'`, keys `platformCurrency`, `platformCountry`, `platformLocale`, `platformTimezone`
2. **Environment variables** — `PLATFORM_CURRENCY`, `PLATFORM_COUNTRY`, `PLATFORM_LOCALE`, `PLATFORM_TIMEZONE`
3. **Code defaults** — `USD`, `US`, `en-US`, `America/New_York`

**Which knob to use**

| Goal | Use |
|------|-----|
| Normal deploy / market switch | Set `PLATFORM_*` (and `TAX_ORIGIN_*`) in the deployment environment, then restart the API |
| Emergency override without redeploy | Insert/update the four Config keys above in the database (no admin UI writes these keys today) |
| Confirm what the storefront sees | `GET /config/region` or Admin → Settings → Payment → **Platform Region** (read-only) |

> **Important:** Admin Payment → **Default Currency** writes Config key `currency`. That is a separate legacy setting and does **not** drive `PlatformRegionService`. Shopper-facing formatting follows `/config/region`.

Tax ship-from (`TAX_ORIGIN_*`) is **environment-only**. It is never read from the Config table. Incomplete origin fields resolve to `taxOrigin: null`.

### Environment variables

Malformed values fail **boot** via `validateEnvironmentVariables` (`Environment validation failed: …`).

| Variable | Format | Valid examples | On malformed value |
|----------|--------|----------------|--------------------|
| `PLATFORM_CURRENCY` | 3-letter ISO 4217, uppercase | `USD`, `GBP`, `AED`, `MYR` | Boot failure |
| `PLATFORM_COUNTRY` | 2-letter ISO 3166-1 alpha-2, uppercase | `US`, `GB`, `AE`, `MY` | Boot failure |
| `PLATFORM_LOCALE` | BCP 47: `xx` or `xx-YY` | `en`, `en-US`, `en-GB`, `ar-AE`, `ms-MY` | Boot failure |
| `PLATFORM_TIMEZONE` | IANA time zone | `America/New_York`, `Europe/London`, `Asia/Dubai`, `Asia/Kuala_Lumpur` | Boot failure |
| `PLATFORM_REGION_CACHE_TTL_MS` | Non-negative number (ms) | `15000` (default) | Invalid numbers fall back to `15000` (not a boot failure) |
| `TAX_ORIGIN_STREET` | Non-empty string | `1564 Broadway` | Incomplete origin → `null` (see fail-closed below) |
| `TAX_ORIGIN_CITY` | Non-empty string | `New York` | Incomplete origin → `null` |
| `TAX_ORIGIN_STATE` | Required when country is `US` | `NY` | Incomplete US origin → `null` |
| `TAX_ORIGIN_POSTAL_CODE` | Non-empty string | `10036` | Incomplete origin → `null` |
| `TAX_ORIGIN_COUNTRY` | 2-letter ISO, uppercase (falls back to platform country) | `US` | Malformed code → boot failure; missing → fall back to platform country |

### Tax origin (`TAX_ORIGIN_*`)

Tax providers (Avalara, TaxJar, Stripe Tax) need a complete **ship-from** address. Without it, US sales tax estimates use the wrong (or no) nexus origin.

**Why it matters:** A wrong or missing origin can silently produce incorrect US sales tax amounts. That was a production bug class we fixed by centralising origin and failing closed when a provider is active without a complete address.

**Completeness rules** (from `PlatformRegionService.buildTaxOrigin`):

- Required: street, city, postal code, country
- State is required when country is `US`; optional elsewhere

**Fail-closed behaviour**

| Environment | Tax provider active? | Incomplete origin |
|-------------|----------------------|-------------------|
| `production` or `staging` | Yes | Throws on tax-provider load / refresh — API must not calculate tax without origin |
| `production` or `staging` | No | No throw (origin still recommended before enabling a provider) |
| Other (`development`, etc.) | Yes | Warning + fall back to tax zones; does not invent an origin |

### Cache and propagation delay

Resolved region config is cached:

- **Local in-process cache** on each API instance (default TTL **15 seconds**)
- **Shared cache** (Redis when `CacheService` is available) under key `platform:region:resolved`, same TTL
- Override TTL with `PLATFORM_REGION_CACHE_TTL_MS`

`PlatformRegionService.invalidate()` clears local + shared cache. As of this writing, no admin save path calls `invalidate()` for region keys, so **expect up to one TTL window (~15s) before every instance observes a DB Config change**. Environment variable changes require an API restart (they are not hot-reloaded).

### Single-currency launch and re-enabling multi-currency

Launch mode is **single currency**: `CurrencyService` exposes only the platform region currency unless multi-currency is reopened.

| Control | Effect |
|---------|--------|
| Default (neither set) | Supported list = `[platform currency]` only |
| `FF_MULTI_CURRENCY=true` (or admin feature flag `MULTI_CURRENCY`) | Supported list expands to the built-in catalog: USD, EUR, GBP, AED, JPY, AUD, CAD, SGD |
| `GLOBAL_SUPPORTED_CURRENCIES=USD,EUR,GBP` | Explicit CSV overrides the catalog (platform currency is always included) |

FX rates come from ExchangeRate-API (`https://api.exchangerate-api.com/v4/latest` open, or authenticated v6 when `EXCHANGE_RATE_API_KEY` is set), with DB + Redis caching. Conversion between arbitrary currencies throws while multi-currency is disabled.

> When a request has an active market (via `x-market-code` or the user's home market), `PlatformRegionService` reads that `Market` row. Unscoped processes still use env/`PLATFORM_*`. See [§13](#13-hybrid-access-control).

## 13. Hybrid Access Control

The API now has a unified RBAC + ABAC + market-scope layer. It is **off by default** (`legacy`) so existing `@Roles` behaviour is unchanged.

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `ACCESS_CONTROL_MODE` | `legacy` / `shadow` / `enforce` | `legacy` | Guard decision source. `shadow` evaluates the new engine and logs divergences to `ActivityLog` (`ACCESS_CONTROL_DIVERGENCE`) but still honours `@Roles`. `enforce` uses `@RequireAccess` where present. |
| `ACCESS_CONTROL_MODULE_MODES` | `orders:shadow,finance:legacy` | (none) | Per-module override of the global mode. The module name is the first path segment **after** the `api` prefix and any `v<n>` version segment, so `/api/v1/orders/:id` → `orders`. |
| `ACCESS_CONTROL_DATA_SCOPE` | `legacy` / `shadow` / `enforce` | `legacy` | Prisma `marketId` injection. Do **not** set `enforce` until the `20261021120000_hybrid_access_control` backfill is verified (nullable `marketId` on unfilled rows would hide data). |
| `ACCESS_CONTROL_STRICT_COVERAGE` | `true` | unset | Makes the route-coverage unit test fail if any controller lacks `@Public` / `@RequireAccess`. |
| `ACCESS_CONTROL_ASSIGNMENT_TTL_MS` | integer ms | `15000` | How long resolved role assignments and permission-role lookups are cached per user. Lower it to make permission edits take effect faster at the cost of more queries. |
| `ACCESS_CONTROL_ASSIGNMENT_CACHE_MAX` | integer | `5000` | Maximum cached users before the oldest entries are evicted. |

### Concepts

- **Market** is independent of **Tenant**. Tenant stays organisational; Market holds country/currency/locale/timezone/tax origin.
- **UserRoleAssignment** scopes a `PermissionRole` to `GLOBAL` / `MARKET` / `TENANT` / `STORE`. Existing `ADMIN` users are backfilled with a `GLOBAL` assignment so they keep super-admin access.
- **Implicit assignments.** Users without an explicit assignment row are not locked out. The policy engine derives one from the `permissionRoleId` on their user record, or failing that from `DEFAULT_ROLE_PERMISSIONS[platformRole]`. This is what keeps pre-migration users *and every new signup* working once a route moves to `@RequireAccess`, so customers and sellers never need assignment rows. An assignment carrying a `permissionRoleId` is deliberately **not** global, mirroring `PermissionsGuard`: an `ADMIN` narrowed to a permission role is not a super-admin.
- **Permission catalog** is the single source of truth in `@hos-marketplace/shared-types` (`PERMISSION_CATALOG`). Admin → Permissions reads it from `GET /admin/permissions/catalog`.
- Callers send `x-market-code` (`US` / `GB` / `AE` / `MY`). Switching market *narrows* what a request can see, so actors that are not pinned to a market subset may select any active market. Actors with market-scoped assignments are restricted to those, and staff whose assignments pin them to a tenant or store are held to their home market. `homeMarketId` on its own is only a **default**, not a restriction: the migration sets it for every user, so treating it as a lock would disable the selector platform-wide. `GET /access-control/me` returns exactly the set the API will accept.
- **Region configuration follows the market only once `ACCESS_CONTROL_DATA_SCOPE` leaves `legacy`.** A market is resolved on every request (falling back to the default row), so while scoping is off `PlatformRegionService` deliberately keeps reading `PLATFORM_*` env and `Config` rows. Without that gate a single-region deploy would silently inherit the default market's currency and country.
- **Global admins are scoped when they choose.** Selecting a market via `x-market-code` applies data scoping to a global admin too — otherwise the market switcher would do nothing for the people who most need it. Sending no header keeps the unscoped cross-market view.
- Non-HTTP entry points (queues, webhooks, cron) must wrap work in `withSystemActor({ marketId, reason })` from `access-control/system-actor.ts`. Cross-market jobs pass `allMarkets: true` (audited bypass).
- Market scoping is a Prisma **client extension**, so it also covers queries issued inside `$transaction`. Operations with a unique `where` (`findUnique`, `update`, `delete`) get the market ANDed in via `extendedWhereUnique`, meaning a cross-market write is blocked before it executes rather than detected afterwards.

### Rollout

1. Apply migration `20261021120000_hybrid_access_control` and verify every tier-1 table has `marketId` populated (`SELECT count(*) FILTER (WHERE "marketId" IS NULL)`).
2. Set `ACCESS_CONTROL_MODE=shadow` (and optionally `ACCESS_CONTROL_DATA_SCOPE=shadow`) in staging, then production. Watch `ACCESS_CONTROL_DIVERGENCE` activity logs.
3. Flip one module at a time: `ACCESS_CONTROL_MODULE_MODES=orders:enforce`.
4. Only after a clean window, set `ACCESS_CONTROL_DATA_SCOPE=enforce`. A later migration may then make `marketId` `NOT NULL`.

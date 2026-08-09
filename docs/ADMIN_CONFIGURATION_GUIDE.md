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
| Currency | `currency` (sent as `defaultCurrency`) | String | Default platform currency (USD, EUR, AED, GBP) |
| Platform Fee | `platformFeeRate` (sent as `platformFee`) | Number (0–100%) | Percentage fee on seller transactions |
| Cancellation Window | `cancellationAutoApprovalWindowMinutes` | Number (minutes) | Auto-approve cancellation requests within this window |

> **Note:** The frontend sends `platformFee` as a percentage (e.g., 15.0) and `defaultCurrency` as the key. The backend maps `platformFee / 100` to `platformFeeRate` and `defaultCurrency` to `currency`. Stripe API keys are managed separately through Integrations.

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
| Points per pound spent | Number | DB over `LOYALTY_POINTS_PER_POUND` env |
| Points value in pence | Number | DB over `LOYALTY_POINTS_VALUE_PENCE` env |
| Minimum redemption | Number | DB over env |
| Points expiry (months) | Number | DB over env |
| POS voucher limits | Number | DB |
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
| `XERO_INTEGRATION` | false | Enable Xero accounting sync |
| `LOYALTY_PROGRAMME` | false | Enable loyalty programme |
| `BRAND_PARTNERSHIPS` | false | Enable brand partnership campaigns |
| `AMBASSADOR_PROGRAMME` | false | Enable ambassador programme |
| `ADVANCED_ANALYTICS` | false | Enable advanced analytics dashboards |

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

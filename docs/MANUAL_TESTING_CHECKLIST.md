# Manual Testing Checklist

Structured test plan for verifying all admin configuration areas, credential handling, and core platform functionality.

---

## Prerequisites

- [ ] Admin account with `ADMIN` role
- [ ] Access to the admin panel at `/admin`
- [ ] Test Stripe keys (publishable + secret)
- [ ] Test SendGrid API key (optional)
- [ ] Test Lightspeed POS credentials (optional)
- [ ] Browser developer tools open (Network tab) for inspecting API responses

---

## 1. Platform Settings (`/admin/settings`)

### 1.1 General Tab
- [ ] Load settings page — all fields populate from current config
- [ ] Change `platformName` → Save → Reload → verify value persisted
- [ ] Toggle `maintenanceMode` ON → Save → open incognito window → confirm maintenance page shows
- [ ] Toggle `maintenanceMode` OFF → Save → confirm site accessible
- [ ] Toggle `allowRegistration` OFF → Save → attempt registration at `/register` → confirm blocked
- [ ] Toggle `shopEnabled` → Save → Reload → verify toggle state matches
- [ ] Update social media URLs → Save → verify footer links update
- [ ] Update contact email/phone/address → Save → verify footer/structured data updates

### 1.2 Email Tab
- [ ] Enter SMTP settings (host, port, user, from) → Save → Reload → values persist
- [ ] Toggle `emailNotifications` OFF → Save → Reload → toggle remains OFF
- [ ] Toggle `emailNotifications` ON → Save → verify email system sends notifications

### 1.3 Payment Tab
- [ ] Toggle `stripeEnabled` → Save → Reload → value persists
- [ ] Toggle `stripeTestMode` → Save → Reload → value persists
- [ ] Change currency → Save → Reload → currency persists
- [ ] Set platform fee to 10% → Save → Reload → value shows 10%
- [ ] Set cancellation window to 60 minutes → Save → Reload → value shows 60
- [ ] Try setting platform fee > 100% → Save → verify validation prevents it

### 1.4 Fulfillment Tab
- [ ] Toggle `autoCreateShipments` → Save → Reload → value persists
- [ ] Toggle `requireTrackingNumber` → Save → Reload → value persists

### 1.5 Notifications Tab
- [ ] Toggle each notification type OFF → Save → Reload → values persist
- [ ] Toggle each notification type ON → Save → Reload → values persist

---

## 2. Integration Credentials (`/admin/settings/integrations`)

### 2.1 Stripe Integration
- [ ] Click "Add Integration" → Select Stripe → Enter test publishable + secret keys
- [ ] Save → verify success toast
- [ ] Reload page → verify keys show as masked (`****...xxxx`)
- [ ] Click "Test Connection" → verify Stripe API responds
- [ ] Edit integration → change only publishable key → Save → verify secret key NOT overwritten
- [ ] Activate → Deactivate → verify status changes
- [ ] **Security check:** Open Network tab → GET integration → confirm `credentials` object shows masked values, not plaintext

### 2.2 SendGrid Integration
- [ ] Add SendGrid integration with API key
- [ ] Save → Reload → verify key masked
- [ ] Test connection → verify API responds
- [ ] Send test email from `/admin/settings/integrations` → confirm delivery

### 2.3 Shipping Providers (`/admin/settings/integrations/shipping`)
- [ ] Add USPS integration → Save → verify credentials masked on reload
- [ ] Add FedEx integration → Save → verify credentials masked
- [ ] Add DHL integration → Save → verify credentials masked
- [ ] Add Shippo integration → Save → verify credentials masked
- [ ] Test each connection if test credentials available

### 2.4 Tax Providers (`/admin/settings/integrations/tax`)
- [ ] Add Avalara integration → Save → verify credentials masked
- [ ] Add TaxJar integration → Save → verify credentials masked
- [ ] Add Stripe Tax integration → Save → verify credentials masked

### 2.5 Integration Deletion
- [ ] Delete a test integration → confirm it disappears
- [ ] Reload → confirm deletion persisted

---

## 3. POS Connections (`/admin/pos/connections`)

### 3.1 Create Connection
- [ ] Add new POS connection with Lightspeed credentials
- [ ] Save → verify success
- [ ] Reload → verify page shows `hasCredentials: true` (not plaintext keys)
- [ ] **Security check:** GET `/api/admin/pos/connections` → verify response has `hasCredentials`/`hasWebhookSecret` flags, not credential values

### 3.2 Test Connection
- [ ] Click "Test Connection" → verify response from Lightspeed API
- [ ] Fetch outlets → verify list populates

### 3.3 Update Connection
- [ ] Edit connection → change only store name (leave credentials blank) → Save
- [ ] Verify credentials NOT overwritten (still shows `hasCredentials: true`)

### 3.4 Sync
- [ ] Trigger product sync → verify products imported
- [ ] Trigger inventory sync → verify stock levels updated

---

## 4. Xero Accounting (`/admin/finance/accounting`)

### 4.1 OAuth Flow
- [ ] Click "Connect to Xero" → verify redirect to Xero consent screen
- [ ] Approve → verify callback redirects back to admin with success status
- [ ] Status shows "Connected" with tenant name
- [ ] **Security check:** Verify tokens stored encrypted in `integration_configs.credentials`

### 4.2 Chart of Accounts
- [ ] Load CoA mapping → verify account list from Xero
- [ ] Map accounts → Save → Reload → verify mapping persisted

### 4.3 Disconnect
- [ ] Click "Disconnect" → verify status returns to "Not Connected"
- [ ] Verify Xero tokens removed from database

---

## 5. Webhooks (`/admin/webhooks`)

### 5.1 Create Webhook
- [ ] Add webhook with URL `https://webhook.site/<your-uuid>` and events `["order.created"]`
- [ ] Save → verify secret is revealed in the response (one-time only)
- [ ] **Copy the secret** — it will not be shown again
- [ ] Reload → verify `hasSecret: true` but secret value is hidden

### 5.2 Webhook Security
- [ ] **Security check:** GET `/api/webhooks/:id` → confirm `secret` is NOT in response, only `hasSecret`
- [ ] **Database check (if DB access):** Verify `webhook.secret` column contains an encrypted blob (base64), not hex plaintext

### 5.3 Webhook Delivery
- [ ] Create a test order → verify webhook delivered to webhook.site
- [ ] Verify `X-Webhook-Signature` header is present
- [ ] Verify HMAC-SHA256 signature matches using the copied secret

### 5.4 Retry & Dead Letter
- [ ] Set webhook URL to an invalid endpoint → trigger event → verify delivery fails
- [ ] Retry delivery from delivery history
- [ ] After 5 failures, verify delivery appears in dead letter queue

### 5.5 Update & Delete
- [ ] Update webhook URL → verify new URL used for next delivery
- [ ] Delete webhook → verify removed
- [ ] Verify no further deliveries sent

---

## 6. Loyalty Programme (`/admin/loyalty/settings`)

### 6.1 Settings Persistence
- [ ] Enable loyalty feature flag at `/admin/feature-flags`
- [ ] Set `LOYALTY_ENABLED=true` in environment
- [ ] Navigate to `/admin/loyalty/settings` → verify runtime status shows both gates enabled
- [ ] Change earn rate → Save → Reload → value persists
- [ ] Change redemption rate → Save → Reload → value persists
- [ ] Change expiry months → Save → Reload → value persists

### 6.2 Cross-Instance Cache
- [ ] Save settings → verify cache invalidation message in logs
- [ ] Check runtime status → verify settings reflect the save within 15 seconds

### 6.3 Earn Rules
- [ ] Navigate to `/admin/loyalty/earn-rules`
- [ ] Create earn rule → verify creation
- [ ] Edit rule → verify update persists
- [ ] Delete rule → verify removal

### 6.4 Redemption Options
- [ ] Navigate to `/admin/loyalty/redemption-options`
- [ ] Create redemption option → verify creation
- [ ] Verify option appears in customer-facing loyalty page

---

## 7. Feature Flags (`/admin/feature-flags`)

- [ ] Load page → verify all flags show current state
- [ ] Toggle `POS_INTEGRATION` ON → verify POS menu items appear
- [ ] Toggle `POS_INTEGRATION` OFF → verify POS menu items hidden
- [ ] Toggle `LOYALTY_PROGRAMME` → verify loyalty features enable/disable
- [ ] Toggle `BRAND_PARTNERSHIPS` → verify brand partnership features enable/disable
- [ ] Reload page → verify all toggle states persisted

---

## 8. User Management (`/admin/users`)

### 8.1 Create User
- [ ] Create new user with email and password
- [ ] Verify user appears in user list
- [ ] Login as new user in incognito → verify access

### 8.2 Password Reset
- [ ] Click "Reset Password" for a user
- [ ] Verify reset email sent (if email configured)
- [ ] Use reset link → set new password → verify login works

### 8.3 Role Assignment
- [ ] Change user role (USER → SELLER → ADMIN) → verify permissions change
- [ ] Verify role-restricted pages are accessible/blocked appropriately

---

## 9. Logistics Partners (`/admin/logistics`)

### 9.1 Create Partner
- [ ] Add logistics partner with name, type, contact info
- [ ] If API key provided → Save → Reload → verify `hasApiKey: true` shown (not plaintext)
- [ ] **Security check:** GET `/api/logistics/partners/:id` → confirm `apiKey` NOT in response

### 9.2 Update Partner
- [ ] Edit partner name → Save → verify name updated
- [ ] Edit partner with masked API key value → Save → verify real key NOT overwritten

### 9.3 Delete Partner
- [ ] Delete partner with no active shipments → verify deletion
- [ ] Try deleting partner with active shipments → verify rejection

---

## 10. Credential Security Verification

### 10.1 API Response Masking
- [ ] GET `/api/integrations` → verify all credential values masked (`****...xxxx`)
- [ ] GET `/api/admin/pos/connections` → verify `hasCredentials`/`hasWebhookSecret` flags only
- [ ] GET `/api/webhooks` → verify `hasSecret` flag only, no `secret` value
- [ ] GET `/api/logistics/partners` → verify `hasApiKey` flag only

### 10.2 Encryption at Rest (requires DB access)
- [ ] Query `integration_configs.credentials` → verify value is a base64 blob, not readable JSON
- [ ] Query `pos_connections.credentials` → verify encrypted blob
- [ ] Query `webhooks.secret` → verify encrypted blob (not hex plaintext)
- [ ] Query `logistics_partners.apiKey` → verify encrypted blob (if set)

### 10.3 Update Safety
- [ ] Edit an integration → submit with all credential fields empty → Save
- [ ] Reload → verify original credentials still present (not cleared)
- [ ] Edit an integration → submit with masked values (`****...`) → Save
- [ ] Reload → verify original credentials still present (not overwritten with mask)

---

## 11. Domains & Tenants

### 11.1 Domains (`/admin/domains`)
- [ ] View seller domains list
- [ ] Assign custom domain to seller → verify DNS configuration instructions
- [ ] Activate/deactivate domain → verify status change

### 11.2 Tenants (`/admin/tenants`)
- [ ] Create new tenant → verify creation with name and config
- [ ] Update tenant settings → verify persistence
- [ ] Add/remove users from tenant → verify membership changes

---

## 12. Search Configuration (`/admin/search`)

- [ ] View Meilisearch index stats → verify connection and index counts
- [ ] Trigger sync → verify products indexed
- [ ] Trigger rebuild → verify full re-index completes

> **Note:** Meilisearch credentials are environment-only (`MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`). No credential UI exists in admin.

---

## 13. RBAC Permissions (`/admin/permissions`)

- [ ] View role permission matrix
- [ ] Modify permissions for a role → Save → verify persisted
- [ ] Login as user with modified role → verify access matches new permissions
- [ ] Reset permissions to defaults → verify reset

---

## 14. Return Policies (`/admin/return-policies`)

- [ ] Create return policy → verify creation
- [ ] Edit policy window/conditions → verify persistence
- [ ] Delete policy → verify removal
- [ ] Submit a return request → verify policy rules applied

---

## 15. Tax Zones (`/admin/tax-zones`)

- [ ] Create tax zone with rate and region → verify creation
- [ ] Edit tax rate → verify persistence
- [ ] Delete tax zone → verify removal
- [ ] Place test order in region → verify tax calculation applies zone

---

## 16. Smoke Tests (Critical Paths)

### 16.1 End-to-End Order Flow
- [ ] Register user → Login → Add to cart → Checkout → Payment → Order confirmation
- [ ] Admin views order → Updates status → Shipment created → Order fulfilled
- [ ] Customer views order history → correct status shown

### 16.2 Seller Flow
- [ ] Seller registers → Admin approves → Seller logs in
- [ ] Seller submits product → Admin reviews → Approves
- [ ] Product visible on storefront → Customer orders → Seller sees order

### 16.3 Refund Flow
- [ ] Create return request → Admin approves → Refund processed
- [ ] Verify Stripe refund settles → Order status updates to REFUNDED
- [ ] Verify loyalty points reversed (if applicable)

---

## Sign-Off

| Area | Tester | Date | Pass/Fail | Notes |
|------|--------|------|-----------|-------|
| Platform Settings | | | | |
| Integration Credentials | | | | |
| POS Connections | | | | |
| Xero Accounting | | | | |
| Webhooks | | | | |
| Loyalty Programme | | | | |
| Feature Flags | | | | |
| User Management | | | | |
| Logistics Partners | | | | |
| Credential Security | | | | |
| Domains & Tenants | | | | |
| Search Configuration | | | | |
| RBAC Permissions | | | | |
| Return Policies | | | | |
| Tax Zones | | | | |
| E2E Order Flow | | | | |
| Seller Flow | | | | |
| Refund Flow | | | | |

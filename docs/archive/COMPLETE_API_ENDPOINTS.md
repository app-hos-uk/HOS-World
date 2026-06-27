# Complete API Endpoints Reference

## Quick Test

Run the test script:
```bash
./test-all-endpoints.sh
```

Or test manually:
```bash
# Test health endpoint
curl https://hos-marketplaceapi-production.up.railway.app/api/health

# Test products
curl https://hos-marketplaceapi-production.up.railway.app/api/products
```

## All API Endpoints

### 🔓 Public Endpoints (No Auth Required)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/health` | GET | ✅ | Health check |
| `/api/` | GET | ✅ | Root endpoint |
| `/api/products` | GET | ✅ | List/search products |
| `/api/products/:id` | GET | ✅ | Get product by ID |
| `/api/products/slug/:slug` | GET | ✅ | Get product by slug |
| `/api/fandoms` | GET | ⚠️ | May return 404 |
| `/api/fandoms/:slug` | GET | ⚠️ | May return 404 |
| `/api/characters` | GET | ⚠️ | May return 404 |
| `/api/characters/:id` | GET | ⚠️ | May return 404 |
| `/api/characters/fandom/:slug` | GET | ⚠️ | May return 404 |
| `/api/sellers` | GET | ✅ | List sellers |
| `/api/sellers/:id` | GET | ✅ | Get seller |

### 🔐 Authentication Endpoints

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/auth/register` | POST | ❌ | ✅ |
| `/api/auth/login` | POST | ❌ | ✅ |
| `/api/auth/logout` | POST | ✅ | ✅ |
| `/api/auth/me` | GET | ✅ | ✅ |
| `/api/auth/refresh` | POST | ❌ | ✅ |
| `/api/auth/select-character` | POST | ✅ | ✅ |
| `/api/auth/fandom-quiz` | POST | ✅ | ✅ |
| `/api/auth/invitation` | GET | ❌ | ✅ |
| `/api/auth/accept-invitation` | POST | ❌ | ✅ |

### 🛒 Cart & Orders

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/cart` | GET | ✅ | ✅ |
| `/api/cart` | DELETE | ✅ | ✅ |
| `/api/cart/items` | POST | ✅ | ✅ |
| `/api/cart/items/:id` | PATCH | ✅ | ✅ |
| `/api/cart/items/:id` | DELETE | ✅ | ✅ |
| `/api/orders` | GET | ✅ | ✅ |
| `/api/orders` | POST | ✅ | ✅ |
| `/api/orders/:id` | GET | ✅ | ✅ |

### 💳 Payments

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/payments/intent` | POST | ✅ | ✅ |
| `/api/payments/confirm` | POST | ✅ | ✅ |

### 👤 User & Profile

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/users/profile` | GET | ✅ | ✅ |
| `/api/users/profile` | PUT | ✅ | ✅ |
| `/api/users/change-password` | POST | ✅ | ✅ |

### 💰 Currency

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/currency/rates` | GET | ❌ | ⚠️ |
| `/api/currency/convert` | GET | ❌ | ⚠️ |
| `/api/currency/user-currency` | GET | ✅ | ⚠️ |

### 🌍 Geolocation

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/geolocation/detect` | GET | ❌ | ⚠️ |
| `/api/geolocation/confirm` | POST | ❌ | ⚠️ |

### 🔒 GDPR

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/gdpr/consent` | GET | ✅ | ⚠️ |
| `/api/gdpr/consent` | POST | ✅ | ⚠️ |
| `/api/gdpr/export` | GET | ✅ | ⚠️ |
| `/api/gdpr/data` | DELETE | ✅ | ⚠️ |
| `/api/gdpr/consent-history` | GET | ✅ | ⚠️ |

### 🎨 Themes

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/themes` | GET | ✅ | ✅ |
| `/api/themes/:id` | GET | ✅ | ✅ |
| `/api/themes/:id` | PUT | ✅ | ✅ |
| `/api/themes/:id` | DELETE | ✅ | ✅ |
| `/api/themes/seller/my-theme` | GET | ✅ | ✅ |
| `/api/themes/seller/my-theme` | PUT | ✅ | ✅ |
| `/api/themes/templates/list` | GET | ✅ | ✅ |
| `/api/themes/templates/:id/apply` | POST | ✅ | ✅ |

### 🌐 Domains

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/domains/my-domains` | GET | ✅ | ✅ |
| `/api/domains/sellers/:id` | GET | ✅ | ✅ |
| `/api/domains/sellers/:id/subdomain` | POST | ✅ | ✅ |
| `/api/domains/sellers/:id/subdomain` | DELETE | ✅ | ✅ |
| `/api/domains/sellers/:id/custom-domain` | POST | ✅ | ✅ |
| `/api/domains/sellers/:id/custom-domain` | DELETE | ✅ | ✅ |
| `/api/domains/packages` | GET | ✅ | ✅ |
| `/api/domains/sellers/:id/dns-config` | GET | ✅ | ✅ |

### 📊 Dashboards

| Endpoint | Method | Auth | Role | Status |
|----------|--------|------|------|--------|
| `/api/dashboard/stats` | GET | ✅ | SELLER | ✅ |
| `/api/dashboard/procurement` | GET | ✅ | PROCUREMENT | ✅ |
| `/api/dashboard/fulfillment` | GET | ✅ | FULFILLMENT | ✅ |
| `/api/dashboard/catalog` | GET | ✅ | CATALOG | ✅ |
| `/api/dashboard/marketing` | GET | ✅ | MARKETING | ✅ |
| `/api/dashboard/finance` | GET | ✅ | FINANCE | ✅ |
| `/api/admin/dashboard` | GET | ✅ | ADMIN | ✅ |

### 📝 Submissions & Workflows

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/submissions` | GET | ✅ | ✅ |
| `/api/submissions` | POST | ✅ | ✅ |
| `/api/procurement/submissions` | GET | ✅ | ✅ |
| `/api/procurement/submissions/:id` | GET | ✅ | ✅ |
| `/api/procurement/submissions/:id/approve` | POST | ✅ | ✅ |
| `/api/procurement/submissions/:id/reject` | POST | ✅ | ✅ |
| `/api/catalog/pending` | GET | ✅ | ✅ |
| `/api/catalog/submissions/:id` | GET | ✅ | ✅ |
| `/api/catalog/entries/:id` | POST | ✅ | ✅ |
| `/api/marketing/pending` | GET | ✅ | ✅ |
| `/api/marketing/materials` | GET | ✅ | ✅ |
| `/api/marketing/materials` | POST | ✅ | ✅ |
| `/api/finance/pending` | GET | ✅ | ✅ |
| `/api/finance/pricing/:id` | POST | ✅ | ✅ |
| `/api/finance/approve/:id` | POST | ✅ | ✅ |
| `/api/finance/reject/:id` | POST | ✅ | ✅ |
| `/api/fulfillment/shipments` | GET | ✅ | ✅ |
| `/api/fulfillment/shipments/:id` | GET | ✅ | ✅ |
| `/api/fulfillment/shipments/:id/verify` | PUT | ✅ | ✅ |

### 👥 Admin Endpoints

| Endpoint | Method | Auth | Role | Status |
|----------|--------|------|------|--------|
| `/api/admin/users` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/users` | POST | ✅ | ADMIN | ✅ |
| `/api/admin/users/:id` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/users/:id` | PUT | ✅ | ADMIN | ✅ |
| `/api/admin/users/:id` | DELETE | ✅ | ADMIN | ✅ |
| `/api/admin/users/:id/reset-password` | POST | ✅ | ADMIN | ✅ |
| `/api/admin/sellers` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/sellers/invite` | POST | ✅ | ADMIN | ✅ |
| `/api/admin/sellers/invitations` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/sellers/invitations/:id/resend` | PUT | ✅ | ADMIN | ✅ |
| `/api/admin/sellers/invitations/:id` | DELETE | ✅ | ADMIN | ✅ |
| `/api/admin/settings` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/settings` | PUT | ✅ | ADMIN | ✅ |
| `/api/admin/permissions/:role` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/permissions/:role` | PUT | ✅ | ADMIN | ✅ |
| `/api/admin/roles` | GET | ✅ | ADMIN | ✅ |
| `/api/admin/roles` | POST | ✅ | ADMIN | ✅ |
| `/api/admin/permissions/catalog` | GET | ✅ | ADMIN | ✅ |

### 🤖 AI & Social

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/ai/chat/:characterId` | POST | ✅ | ⚠️ |
| `/api/ai/chat/history` | GET | ✅ | ⚠️ |
| `/api/ai/recommendations` | GET | ✅ | ⚠️ |
| `/api/social-sharing/share` | POST | ✅ | ⚠️ |
| `/api/social-sharing/shared` | GET | ✅ | ⚠️ |
| `/api/social-sharing/share-url` | GET | ✅ | ⚠️ |

### 📦 Other Endpoints

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/taxonomy/categories` | GET | ✅ | ✅ |
| `/api/taxonomy/attributes` | GET | ✅ | ✅ |
| `/api/taxonomy/tags` | GET | ✅ | ✅ |
| `/api/cms/pages` | GET | ✅ | ✅ |
| `/api/cms/banners` | GET | ✅ | ✅ |
| `/api/cms/blog` | GET | ✅ | ✅ |
| `/api/compliance/requirements/:country` | GET | ✅ | ⚠️ |
| `/api/compliance/tax-rates/:country` | GET | ✅ | ⚠️ |
| `/api/compliance/verify-age` | POST | ✅ | ⚠️ |

## Status Legend

- ✅ **Implemented** - Endpoint exists and works
- ⚠️ **May not exist** - Endpoint may return 404 (not yet implemented)
- ❌ **No auth** - Public endpoint, no authentication required
- ✅ **Auth required** - Requires valid JWT token

## Testing Instructions

### 1. Test Public Endpoints

```bash
# Health check
curl https://hos-marketplaceapi-production.up.railway.app/api/health

# Products
curl https://hos-marketplaceapi-production.up.railway.app/api/products

# Fandoms (may return 404)
curl https://hos-marketplaceapi-production.up.railway.app/api/fandoms
```

### 2. Test with Authentication

```bash
# 1. Login to get token
TOKEN=$(curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.data.token')

# 2. Use token for authenticated requests
curl -H "Authorization: Bearer $TOKEN" \
  https://hos-marketplaceapi-production.up.railway.app/api/auth/me
```

### 3. Run Automated Test

```bash
./test-all-endpoints.sh
```

## Expected 404 Endpoints

These endpoints may return 404 if not yet implemented:
- `/api/fandoms` and related
- `/api/characters` and related
- `/api/currency/rates`
- `/api/gdpr/consent` (if not implemented)
- `/api/ai/*` endpoints
- `/api/social-sharing/*` endpoints

The frontend handles these gracefully with fallback data.

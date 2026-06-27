# API Endpoints Test Report

This document lists all API endpoints and their implementation status.

## How to Test

Run the test script:
```bash
node test-api-endpoints.js
```

Or test manually using curl:
```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/health
```

## Endpoint Categories

### ✅ Public Endpoints (No Auth Required)

These endpoints should work without authentication:

- `GET /api/health` - Health check
- `GET /api/` - Root endpoint
- `GET /api/products` - List products
- `GET /api/fandoms` - List fandoms (may return 404 if not implemented)
- `GET /api/characters` - List characters (may return 404 if not implemented)
- `GET /api/currency/rates` - Get currency rates (may return 404 if not implemented)

### 🔐 Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/refresh` - Refresh token

### 📦 Product Endpoints

- `GET /api/products` - List/search products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/slug/:slug` - Get product by slug
- `POST /api/products` - Create product (requires auth + seller role)
- `PUT /api/products/:id` - Update product (requires auth + seller role)
- `DELETE /api/products/:id` - Delete product (requires auth + seller role)

### 🛒 Cart & Orders

- `GET /api/cart` - Get user's cart (requires auth)
- `POST /api/cart` - Add to cart (requires auth)
- `PUT /api/cart/:itemId` - Update cart item (requires auth)
- `DELETE /api/cart/:itemId` - Remove cart item (requires auth)
- `GET /api/orders` - Get user's orders (requires auth)
- `POST /api/orders` - Create order (requires auth)

### 👤 User & Profile

- `GET /api/users/profile` - Get user profile (requires auth)
- `PUT /api/users/profile` - Update profile (requires auth)
- `POST /api/users/change-password` - Change password (requires auth)

### 🎨 Themes

- `GET /api/themes` - List themes (requires auth)
- `GET /api/themes/:id` - Get theme (requires auth)
- `POST /api/themes` - Create theme (requires auth + admin)
- `PUT /api/themes/:id` - Update theme (requires auth)
- `DELETE /api/themes/:id` - Delete theme (requires auth + admin)

### 🔒 GDPR

- `GET /api/gdpr/consent` - Get GDPR consent (requires auth)
- `POST /api/gdpr/consent` - Update GDPR consent (requires auth)
- `GET /api/gdpr/export` - Export user data (requires auth)
- `DELETE /api/gdpr/data` - Delete user data (requires auth)

### 💰 Currency

- `GET /api/currency/rates` - Get currency rates (public)
- `GET /api/currency/user` - Get user currency preference (requires auth)
- `POST /api/currency/convert` - Convert currency (public)

### 🌍 Geolocation

- `POST /api/geolocation/detect` - Detect country (public)
- `POST /api/geolocation/confirm` - Confirm country (public)

### 📊 Dashboards

- `GET /api/dashboard/seller` - Seller dashboard (requires auth + seller role)
- `GET /api/dashboard/admin` - Admin dashboard (requires auth + admin role)
- `GET /api/dashboard/wholesaler` - Wholesaler dashboard (requires auth + wholesaler role)

### 📝 Submissions

- `GET /api/submissions` - Get submissions (requires auth)
- `POST /api/submissions` - Create submission (requires auth)
- `GET /api/procurement/submissions` - Get procurement submissions (requires auth)
- `GET /api/catalog/pending` - Get catalog pending items (requires auth + catalog role)

### 🏪 Seller Management

- `GET /api/sellers` - List sellers (public)
- `GET /api/sellers/:id` - Get seller (public)
- `POST /api/sellers/invite` - Invite seller (requires auth + admin)
- `GET /api/sellers/invitations` - Get invitations (requires auth + admin)

### 🌐 Domains

- `GET /api/domains` - Get user domains (requires auth)
- `POST /api/domains/subdomain` - Assign subdomain (requires auth + seller)
- `POST /api/domains/custom` - Assign custom domain (requires auth + seller)

## Expected 404 Endpoints

These endpoints may return 404 if not yet implemented in the backend:

- `/api/fandoms` - Fandoms listing
- `/api/characters` - Characters listing
- `/api/currency/rates` - Currency rates
- `/api/gdpr/consent` - GDPR consent (if not implemented)
- `/api/ai/chat/*` - AI chat features
- `/api/social-sharing/*` - Social sharing features

## Testing Notes

1. **Public endpoints** can be tested without authentication
2. **Protected endpoints** require a valid JWT token in the Authorization header
3. **404 errors** are expected for endpoints not yet implemented
4. The frontend handles 404s gracefully with fallback data

## Running Tests

### Quick Test (Node.js)
```bash
node test-api-endpoints.js
```

### Manual Test (curl)
```bash
# Test health endpoint
curl https://hos-marketplaceapi-production.up.railway.app/api/health

# Test products endpoint
curl https://hos-marketplaceapi-production.up.railway.app/api/products

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://hos-marketplaceapi-production.up.railway.app/api/auth/me
```

### Test with Authentication

To test protected endpoints, you'll need to:
1. Login first: `POST /api/auth/login` with email/password
2. Get the token from the response
3. Use the token in subsequent requests: `Authorization: Bearer <token>`

# Admin Seller Creation Feature

## Overview

This feature allows administrators to create sellers directly without requiring email invitations. This is useful for testing purposes when the email server is not configured.

## Problem

- Seller invitation emails are not functioning (no email server configured)
- Need a way to create sellers for testing purposes
- Sellers should still complete the normal onboarding flow after login

## Solution

Added an admin endpoint that allows creating sellers directly with minimal details (email and password). The seller can then login and complete their profile through the normal onboarding flow.

## Implementation

### 1. DTO for Seller Creation

**File:** `services/api/src/admin/dto/create-seller.dto.ts`

```typescript
export class CreateSellerDto {
  email: string;        // Required
  password: string;    // Required
  storeName?: string;  // Optional (auto-generated if not provided)
  country?: string;    // Optional (defaults to GB)
}
```

### 2. Admin Service Method

**File:** `services/api/src/admin/admin.service.ts`

**Method:** `createSellerDirectly(createSellerDto: CreateSellerDto)`

**What it does:**
1. Checks if user with email already exists
2. Hashes the password
3. Gets country code and currency (defaults to GB/GBP)
4. Generates unique store name and slug if not provided
5. Creates user with role `B2C_SELLER`
6. Creates seller profile (marked as `verified: false` - needs onboarding)
7. Creates customer profile
8. Creates GDPR consent log

**Returns:**
```typescript
{
  id: string;           // Seller ID
  userId: string;       // User ID
  email: string;        // User email
  storeName: string;    // Store name
  slug: string;         // Store slug
  message: string;      // Success message
}
```

### 3. Admin Controller Endpoint

**File:** `services/api/src/admin/admin.controller.ts`

**Endpoint:** `POST /api/admin/sellers/create`

**Authentication:** Requires ADMIN role

**Request Body:**
```json
{
  "email": "seller@example.com",
  "password": "password123",
  "storeName": "My Test Store",  // Optional
  "country": "United Kingdom"     // Optional
}
```

**Response:**
```json
{
  "id": "seller-uuid",
  "userId": "user-uuid",
  "email": "seller@example.com",
  "storeName": "My Test Store",
  "slug": "my-test-store",
  "message": "Seller created successfully. They can now login and complete their profile through the onboarding flow."
}
```

## Usage

### 1. Create Seller (Admin)

```bash
POST /api/admin/sellers/create
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "test-seller@example.com",
  "password": "SecurePassword123",
  "storeName": "Test Store",
  "country": "United Kingdom"
}
```

### 2. Seller Login

The seller can now login using the email and password:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "test-seller@example.com",
  "password": "SecurePassword123"
}
```

### 3. Complete Onboarding

After login, the seller will be redirected to the onboarding flow where they can:
- Update store details
- Add business information
- Complete profile information
- Set up payment methods
- Configure shipping options

## Features

### ✅ Direct Creation
- No email invitation required
- Immediate account creation
- Ready to login

### ✅ Minimal Details
- Only email and password required
- Store name and country optional
- Auto-generated if not provided

### ✅ Onboarding Flow
- Seller marked as `verified: false`
- Must complete onboarding after login
- Same flow as invited sellers

### ✅ Complete Profile Setup
- User profile created
- Seller profile created
- Customer profile created
- GDPR consent logged

### ✅ Country & Currency
- Automatic country code mapping
- Currency assignment based on country
- Defaults to GB/GBP if not specified

## Security

- **Admin Only:** Endpoint requires ADMIN role
- **Password Hashing:** Passwords are hashed using bcrypt
- **Email Validation:** Checks for existing users
- **Unique Slugs:** Auto-generates unique store slugs

## Error Handling

### Email Already Exists
```json
{
  "statusCode": 409,
  "message": "User with this email already exists"
}
```

### Missing Required Fields
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password should not be empty"]
}
```

### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Forbidden (Not Admin)
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

## Testing

### Example Request

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/sellers/create \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-seller@example.com",
    "password": "TestPassword123",
    "storeName": "Test Store",
    "country": "United Kingdom"
  }'
```

### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "email": "test-seller@example.com",
  "storeName": "Test Store",
  "slug": "test-store",
  "message": "Seller created successfully. They can now login and complete their profile through the onboarding flow."
}
```

## Files Modified

1. `services/api/src/admin/dto/create-seller.dto.ts` (new)
2. `services/api/src/admin/admin.service.ts`
3. `services/api/src/admin/admin.controller.ts`
4. `services/api/src/admin/admin.module.ts`

## Next Steps

After creating a seller:
1. Seller logs in with provided credentials
2. Seller is redirected to onboarding flow
3. Seller completes all required profile information
4. Seller profile is marked as verified
5. Seller can start using the platform

## Notes

- This feature is intended for **testing purposes** when email server is not configured
- In production, consider using the normal invitation flow when email server is available
- Sellers created this way still need to complete onboarding
- All GDPR and consent requirements are handled

---

**Status:** ✅ Implemented and ready for use


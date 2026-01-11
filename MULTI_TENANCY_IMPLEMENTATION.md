# Full Multi-Tenancy Implementation Guide

## Status: Phase 1 Complete ✅

This document tracks the implementation progress of the full multi-tenancy system for the HOS Marketplace platform.

## Architecture Overview

The multi-tenancy system implements a hierarchical structure:
```
Platform
  └── Tenant (Organization)
      └── Store (Brand/Location)
          └── StoreView (Language/Currency)
              └── Channel (Sales Channel)
```

### Configuration Inheritance
- **Platform** → **Tenant** → **Store** → **Channel**
- Each level can override parent configurations
- Store-level overrides for: Catalog, Pricing, Tax, Shipping

---

## Implementation Phases

### ✅ Phase 1: Tenant Model (COMPLETE)

**Objective**: Implement the top-level Tenant model with user membership management.

#### Completed Components:

1. **Database Schema** (`services/api/prisma/schema.prisma`)
   - ✅ `Tenant` model with domain/subdomain support
   - ✅ `TenantUser` model for many-to-many user-tenant relationships
   - ✅ Updated `User` model with tenant relations
   - ✅ Placeholder `Store` and `Config` models for future phases

2. **Backend Services**
   - ✅ `TenantsService` - CRUD operations for tenants
   - ✅ `TenantContextService` - Context resolution from headers/domain/user
   - ✅ `TenantsController` - REST API endpoints

3. **Integration**
   - ✅ Updated `JwtStrategy` to include tenant memberships in JWT payload
   - ✅ Updated `AuthService` to create tenant membership on registration
   - ✅ Registered `TenantsModule` in `AppModule`

#### API Endpoints:
- `POST /api/v1/tenants` - Create tenant (ADMIN only)
- `GET /api/v1/tenants` - List all tenants (ADMIN only)
- `GET /api/v1/tenants/my-tenants` - Get current user's tenants
- `GET /api/v1/tenants/:id` - Get tenant details
- `PUT /api/v1/tenants/:id` - Update tenant (ADMIN only)
- `POST /api/v1/tenants/:id/users/:userId` - Add user to tenant
- `PUT /api/v1/tenants/:id/users/:userId/role` - Update user role
- `DELETE /api/v1/tenants/:id/users/:userId` - Remove user from tenant

#### Next Steps for Phase 1:
- [ ] Create database migration
- [ ] Run migration on development database
- [ ] Test tenant creation and user membership
- [ ] Test context resolution

---

### 🔄 Phase 2: Store Model (IN PROGRESS)

**Objective**: Implement multi-store support where tenants can have multiple stores (brands/regions).

#### Planned Components:

1. **Database Schema Updates**
   - Expand `Store` model with full fields:
     - `name`, `slug`, `description`
     - `sellerId` (link to existing Seller)
     - `isActive`, `country`, `currency`, `language`
   - Create `SellerStore` junction table (many-to-many)
   - Update `Product` model: `sellerId` → `storeId`
   - Update `Order` model: `sellerId` → `storeId`

2. **Backend Services**
   - `StoresService` - Store CRUD operations
   - `StoresController` - REST API endpoints
   - Migration script to convert existing `Seller` data to `Store`

3. **Service Updates**
   - Update `ProductsService` to use `storeId` and verify store access
   - Update `OrdersService` to use `storeId`
   - Update all seller-based queries to use store context

#### Migration Strategy:
1. Create `Store` records from existing `Seller` records
2. Link sellers to stores (one-to-one initially, many-to-many later)
3. Migrate `Product.sellerId` → `Product.storeId`
4. Migrate `Order.sellerId` → `Order.storeId`
5. Update indexes and constraints

---

### 📋 Phase 3: Store Views (PLANNED)

**Objective**: Implement language/currency view separation for stores.

#### Planned Components:

1. **Database Schema**
   - `StoreView` model:
     - `storeId`, `code`, `name`
     - `language`, `currency`, `locale`
     - `isDefault`, `isActive`

2. **Services**
   - `StoreViewsService` - View management
   - View resolution logic (from headers/preferences)
   - Product display with view-specific translations/pricing

3. **Frontend Integration**
   - Language/currency switcher component
   - View-aware product display
   - URL routing with view code

---

### 📋 Phase 4: Hierarchical Configuration (PLANNED)

**Objective**: Implement configuration inheritance across Platform → Tenant → Store → Channel.

#### Planned Components:

1. **Database Schema Updates**
   - Expand `Config` model:
     - `level` (PLATFORM, TENANT, STORE, CHANNEL)
     - `levelId`, `key`, `value` (JSON)
     - `channelId` (optional, for Channel-level configs)
   - `Channel` model for sales channels

2. **Services**
   - `ConfigService` with hierarchical resolution:
     ```typescript
     getConfig(key: string, context: TenantContext): any {
       // 1. Check Channel config
       // 2. Check Store config
       // 3. Check Tenant config
       // 4. Check Platform config (defaults)
     }
     ```

3. **Integration**
   - Update services to use `ConfigService` instead of hardcoded values
   - Configuration UI in admin dashboard

---

### 📋 Phase 5: Store-Level Overrides (PLANNED)

**Objective**: Allow stores to override catalog, pricing, tax, and shipping settings.

#### Planned Components:

1. **Database Schema**
   - `StoreCatalogOverride` - Product visibility/availability overrides
   - `StorePricingOverride` - Price overrides per store
   - `StoreTaxOverride` - Tax class/rate overrides
   - `StoreShippingOverride` - Shipping method/cost overrides

2. **Services**
   - Override resolution logic
   - Integration with:
     - `ProductsService` (catalog overrides)
     - `CartService` (pricing overrides)
     - `TaxService` (tax overrides)
     - `ShippingService` (shipping overrides)

---

## Database Migration

### Phase 1 Migration

Run the migration with:
```bash
cd services/api
pnpm prisma migrate dev --name add_tenant_model
pnpm prisma generate
```

### Testing Migration

After migration:
1. Verify `tenants` table exists
2. Verify `tenant_users` table exists
3. Verify `stores` and `configs` placeholder tables exist
4. Test creating a tenant via API
5. Test user registration creates tenant membership

---

## Context Resolution

The `TenantContextService` resolves tenant context from:

1. **Headers** (highest priority):
   - `X-Tenant-Id`: Direct tenant ID
   - `X-Tenant-Domain`: Resolve by domain
   - `X-Tenant-Subdomain`: Resolve by subdomain

2. **Request Body/Query**:
   - `tenantId` in body or query params

3. **User Default**:
   - User's `defaultTenantId`
   - First active tenant membership

4. **Platform Default**:
   - Create/return platform tenant if no context found

---

## API Usage Examples

### Create Tenant
```bash
POST /api/v1/tenants
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Acme Corp",
  "subdomain": "acme",
  "domain": "acme.example.com",
  "isActive": true
}
```

### Add User to Tenant
```bash
POST /api/v1/tenants/{tenantId}/users/{userId}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "ADMIN"
}
```

### Get My Tenants
```bash
GET /api/v1/tenants/my-tenants
Authorization: Bearer <user_token>
```

---

## Testing Checklist

### Phase 1 Testing:
- [ ] Create tenant via API
- [ ] List tenants (admin only)
- [ ] Add user to tenant
- [ ] Remove user from tenant
- [ ] Update user role in tenant
- [ ] Verify tenant membership in JWT token
- [ ] Test context resolution from headers
- [ ] Test context resolution from user default
- [ ] Verify new user registration creates tenant membership

---

## Notes

- The `Store` and `Config` models are currently placeholders that will be fully implemented in later phases
- All existing seller-based functionality continues to work during the migration
- Breaking changes will be introduced in Phase 2 when migrating `sellerId` → `storeId`
- Consider API versioning (v2) for Phase 2+ to maintain backward compatibility

---

## Timeline

- **Phase 1**: ✅ Complete (2 days)
- **Phase 2**: Estimated 3-4 days
- **Phase 3**: Estimated 2-3 days
- **Phase 4**: Estimated 3-4 days
- **Phase 5**: Estimated 2-3 days

**Total Estimated**: 12-16 days

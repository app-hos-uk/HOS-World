# RBAC and Seller Management Documentation

## Current Implementation Overview

### 1. User Roles & RBAC System

#### Available Roles
The application currently supports **3 user roles**:

```typescript
enum UserRole {
  CUSTOMER    // Regular customers who browse and purchase
  SELLER      // Sellers who manage products and orders
  ADMIN       // Platform administrators
}
```

#### RBAC Implementation

**Location:** `services/api/src/common/guards/roles.guard.ts`

**How it works:**
1. **JWT Authentication Guard** (`JwtAuthGuard`) - Validates JWT token and extracts user
2. **Roles Guard** (`RolesGuard`) - Checks if user has required role(s)
3. **@Roles Decorator** - Applied to routes to specify required roles

**Example Usage:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SELLER')
@Post('products')
async createProduct() {
  // Only SELLER role can access this endpoint
}
```

**Key Files:**
- `services/api/src/common/guards/jwt-auth.guard.ts` - JWT validation
- `services/api/src/common/guards/roles.guard.ts` - Role-based access control
- `services/api/src/common/decorators/roles.decorator.ts` - @Roles decorator
- `services/api/src/common/decorators/current-user.decorator.ts` - Get current user

#### Current Role-Based Access

**CUSTOMER Role:**
- Browse products
- Add to cart
- Place orders
- Manage wishlist
- Write reviews
- Manage profile

**SELLER Role:**
- Create/Update/Delete products
- Manage orders
- View dashboard analytics
- Customize store themes
- Export/Import products
- Handle returns

**ADMIN Role:**
- Full platform access
- Manage themes
- Manage users
- System configuration

---

### 2. Seller Management

#### Current Seller Model

**Location:** `services/api/prisma/schema.prisma`

```prisma
model Seller {
  id          String    @id @default(uuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id])
  storeName   String
  slug        String    @unique
  description String?
  themeId     String?
  logo        String?
  country     String
  city        String?
  region      String?
  timezone    String    @default("UTC")
  verified    Boolean   @default(false)
  rating      Float?
  totalSales  Int       @default(0)
  
  products    Product[]
  orders      Order[]
  themeSettings SellerThemeSettings?
}
```

#### Current Limitations

**❌ No Seller Type Differentiation:**
- All sellers are treated the same
- No distinction between **Wholesalers (B2B)** and **B2C Sellers**
- No separate permissions or features for different seller types

**✅ B2B Pricing Fields Available:**
The `Product` model includes B2B pricing fields:
```prisma
model Product {
  price       Decimal       // Regular/B2C price
  tradePrice  Decimal?      // Wholesale/B2B price
  rrp         Decimal?      // Recommended Retail Price
  // ...
}
```

However, these fields are **not fully utilized** for role-based pricing.

---

## Recommended Implementation: Wholesaler vs B2C Seller

### Option 1: Add Seller Type Field (Recommended)

#### Step 1: Update Prisma Schema

```prisma
enum SellerType {
  B2C         // Business-to-Consumer (regular sellers)
  WHOLESALER  // Business-to-Business (wholesale sellers)
  HYBRID      // Both B2C and B2B
}

model Seller {
  // ... existing fields
  sellerType  SellerType @default(B2C)
  minOrderQuantity Int?  // Minimum order quantity for wholesalers
  bulkDiscountEnabled Boolean @default(false)
}
```

#### Step 2: Update Registration DTO

```typescript
// services/api/src/auth/dto/register.dto.ts
export class RegisterDto {
  // ... existing fields
  sellerType?: 'B2C' | 'WHOLESALER' | 'HYBRID';
  minOrderQuantity?: number;
}
```

#### Step 3: Create Seller Type Guard

```typescript
// services/api/src/common/guards/seller-type.guard.ts
@Injectable()
export class SellerTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<SellerType[]>(
      SELLER_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTypes) return true;

    const { user } = context.switchToHttp().getRequest();
    const seller = user.sellerProfile;

    if (!seller) {
      throw new ForbiddenException('Seller profile not found');
    }

    return requiredTypes.includes(seller.sellerType);
  }
}
```

#### Step 4: Update Product Pricing Logic

```typescript
// services/api/src/products/products.service.ts
async findOne(id: string, userRole?: string, sellerType?: SellerType) {
  const product = await this.prisma.product.findUnique({
    where: { id },
    include: { seller: true },
  });

  // Show trade price only to wholesalers or customers with wholesale access
  if (sellerType === 'WHOLESALER' || sellerType === 'HYBRID') {
    return {
      ...product,
      displayPrice: product.tradePrice || product.price,
      isWholesale: true,
    };
  }

  return {
    ...product,
    displayPrice: product.price,
    isWholesale: false,
  };
}
```

---

### Option 2: Role-Based Pricing (Simpler Alternative)

Keep single SELLER role but add pricing visibility based on customer type:

```typescript
// Add customer type to User model
enum CustomerType {
  REGULAR
  WHOLESALE_BUYER  // Customers approved for wholesale pricing
}

model User {
  // ... existing fields
  customerType CustomerType @default(REGULAR)
  approvedForWholesale Boolean @default(false)
}
```

Then filter pricing in product queries:
```typescript
if (user.customerType === 'WHOLESALE_BUYER' && product.tradePrice) {
  return product.tradePrice;
}
return product.price;
```

---

## Implementation Plan

### Phase 1: Add Seller Type Support

1. **Database Migration**
   ```bash
   # Add sellerType field to Seller model
   pnpm --filter @hos-marketplace/api db:migrate
   ```

2. **Update Auth Service**
   - Accept `sellerType` in registration
   - Validate seller type requirements
   - Set default seller type

3. **Update Product Service**
   - Filter pricing based on seller type
   - Show/hide trade prices appropriately
   - Add bulk order support for wholesalers

### Phase 2: Enhanced RBAC

1. **Create Seller Type Guard**
   - Protect routes by seller type
   - Example: Only wholesalers can set trade prices

2. **Update Controllers**
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard, SellerTypeGuard)
   @Roles('SELLER')
   @SellerType('WHOLESALER', 'HYBRID')
   @Post('products')
   async createProduct() {
     // Only wholesalers can create products with trade prices
   }
   ```

### Phase 3: Wholesale Features

1. **Minimum Order Quantities**
   - Enforce MOQ for wholesale products
   - Show MOQ in product listings

2. **Bulk Discounts**
   - Tiered pricing based on quantity
   - Automatic discount calculation

3. **Wholesale Customer Approval**
   - Admin approval workflow
   - Customer type management

---

## Current RBAC Examples

### Example 1: Seller-Only Route
```typescript
// services/api/src/products/products.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SELLER')
@Post()
async create(@Request() req: any, @Body() dto: CreateProductDto) {
  // Only sellers can create products
  return this.productsService.create(req.user.id, dto);
}
```

### Example 2: Admin-Only Route
```typescript
// services/api/src/themes/themes.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Post()
async createTheme(@Body() dto: CreateThemeDto) {
  // Only admins can create themes
}
```

### Example 3: Public Route
```typescript
@Public()
@Get()
async findAll() {
  // Anyone can access (no authentication required)
}
```

---

## Summary

### Current State:
- ✅ **RBAC System**: Fully implemented with 3 roles (CUSTOMER, SELLER, ADMIN)
- ✅ **JWT Authentication**: Working with role-based guards
- ✅ **Seller Management**: Basic seller profiles exist
- ❌ **Seller Type Differentiation**: Not implemented
- ⚠️ **B2B Pricing**: Fields exist but not fully utilized

### Recommendations:
1. **Add `sellerType` field** to distinguish wholesalers from B2C sellers
2. **Implement seller type guards** for granular access control
3. **Utilize `tradePrice` field** for wholesale pricing
4. **Add customer type** for wholesale buyer approval
5. **Create separate dashboards** for different seller types

### Next Steps:
1. Decide on implementation approach (Option 1 or 2)
2. Create database migration for seller type
3. Update authentication and product services
4. Add seller type guards and decorators
5. Update frontend to handle different seller types




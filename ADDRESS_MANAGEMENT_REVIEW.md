# Address Management Implementation - Review

## Overview

A complete Address Management system has been implemented as part of Phase 2. This allows customers to manage multiple shipping and billing addresses with support for default address selection.

## Architecture

### File Structure

```
services/api/src/addresses/
├── addresses.module.ts       # NestJS module configuration
├── addresses.controller.ts   # REST API endpoints
├── addresses.service.ts      # Business logic
└── dto/
    ├── create-address.dto.ts # Validation for creating addresses
    └── update-address.dto.ts # Validation for updating addresses
```

## Implementation Details

### 1. Service Layer (`addresses.service.ts`)

**Methods Implemented:**

#### `create(userId, createAddressDto)`
- Creates a new address for the user
- Automatically unsets other default addresses if new one is set as default
- Validates user ownership
- Returns mapped Address type

#### `findAll(userId)`
- Retrieves all addresses for a user
- Orders results: default address first, then by creation date (newest first)
- Returns array of Address types

#### `findOne(id, userId)`
- Retrieves a specific address by ID
- Validates user ownership (throws NotFoundException if not found or not owned)
- Returns single Address type

#### `update(id, userId, updateAddressDto)`
- Updates an existing address
- Validates user ownership
- If setting as default, unsets all other defaults
- Supports partial updates (all fields optional)
- Returns updated Address type

#### `delete(id, userId)`
- Deletes an address
- Validates user ownership
- Smart default handling: If deleted address was default, automatically sets the most recent address as default
- Prevents user from having no addresses if they had multiple

#### `setDefault(id, userId)`
- Sets a specific address as default
- Automatically unsets all other default addresses
- Validates user ownership
- Returns updated Address type

#### `mapToAddressType(address)`
- Private helper method
- Maps Prisma address model to shared Address type
- Handles optional fields properly

### 2. Controller Layer (`addresses.controller.ts`)

**API Endpoints:**

All endpoints are protected with `@UseGuards(JwtAuthGuard)` - users must be authenticated.

#### `POST /api/addresses`
- **Purpose**: Create a new address
- **Auth**: Required (JWT)
- **Body**: CreateAddressDto
- **Response**: ApiResponse<Address>
- **Status Code**: 201 Created

#### `GET /api/addresses`
- **Purpose**: Get all addresses for current user
- **Auth**: Required (JWT)
- **Response**: ApiResponse<Address[]>
- **Status Code**: 200 OK
- **Ordering**: Default first, then newest

#### `GET /api/addresses/:id`
- **Purpose**: Get a specific address
- **Auth**: Required (JWT)
- **Params**: id (UUID)
- **Response**: ApiResponse<Address>
- **Status Code**: 200 OK
- **Security**: Only returns address if owned by user

#### `PUT /api/addresses/:id`
- **Purpose**: Update an existing address
- **Auth**: Required (JWT)
- **Params**: id (UUID)
- **Body**: UpdateAddressDto (all fields optional)
- **Response**: ApiResponse<Address>
- **Status Code**: 200 OK
- **Security**: Only updates if owned by user

#### `DELETE /api/addresses/:id`
- **Purpose**: Delete an address
- **Auth**: Required (JWT)
- **Params**: id (UUID)
- **Response**: ApiResponse<{ message: string }>
- **Status Code**: 200 OK
- **Security**: Only deletes if owned by user
- **Smart Behavior**: Auto-assigns new default if deleted one was default

#### `POST /api/addresses/:id/set-default`
- **Purpose**: Set an address as default
- **Auth**: Required (JWT)
- **Params**: id (UUID)
- **Response**: ApiResponse<Address>
- **Status Code**: 200 OK
- **Security**: Only sets if owned by user

### 3. Data Transfer Objects (DTOs)

#### `CreateAddressDto`
- **Required Fields**:
  - `firstName` (string)
  - `lastName` (string)
  - `street` (string)
  - `city` (string)
  - `postalCode` (string)
  - `country` (string)

- **Optional Fields**:
  - `label` (string) - e.g., "Home", "Work"
  - `state` (string) - State/province
  - `phone` (string)
  - `isDefault` (boolean)

- **Validation**: Uses class-validator decorators
  - All required fields validated with `@IsNotEmpty()`
  - All fields validated with `@IsString()` where appropriate

#### `UpdateAddressDto`
- **All Fields Optional** - Supports partial updates
- Same validation rules as CreateAddressDto
- Uses `@IsOptional()` decorators

### 4. Module Integration

**Registered in AppModule:**
- `AddressesModule` added to imports array
- Available at `/api/addresses` route
- Uses existing DatabaseModule (PrismaService)

## Security Features

### ✅ Authentication
- All endpoints protected with JWT authentication
- Users must be logged in to access any address endpoints

### ✅ Authorization
- Users can only access their own addresses
- Ownership validation on all operations:
  - Read operations check `userId` matches
  - Update operations verify ownership before allowing changes
  - Delete operations verify ownership before deletion

### ✅ Input Validation
- All DTOs use class-validator
- Type validation on all fields
- Required field validation
- UUID validation on route parameters (ParseUUIDPipe)

## Business Logic Features

### ✅ Default Address Management
- Only one default address per user at a time
- Automatic unsetting of previous default when setting new one
- Smart default reassignment when deleting default address
- Default address appears first in list

### ✅ Address Ordering
- Default address always first
- Other addresses ordered by creation date (newest first)
- Consistent ordering across all list operations

### ✅ Data Integrity
- Validates address exists before operations
- Validates user ownership before operations
- Prevents orphaned addresses
- Maintains referential integrity with User model

## Database Integration

### Uses Existing Schema
- Leverages existing `Address` model from Prisma schema
- No database migrations required
- Works with existing relations:
  - `User.addresses` - One-to-many relation
  - `Order.shippingAddress` - Many-to-one relation
  - `Order.billingAddress` - Many-to-one relation

### Prisma Operations Used
- `create()` - Create new address
- `findMany()` - List addresses with ordering
- `findFirst()` - Get single address with ownership check
- `update()` - Update address
- `updateMany()` - Unset default flags
- `delete()` - Delete address

## Type Safety

### ✅ TypeScript Types
- Returns `Address` type from `@hos-marketplace/shared-types`
- Uses `ApiResponse<T>` wrapper for consistent API responses
- Proper type mapping from Prisma models

### ✅ Error Handling
- `NotFoundException` - When address not found or not owned
- Proper HTTP status codes
- Descriptive error messages

## API Response Format

All endpoints follow consistent response format:

```typescript
{
  data: Address | Address[] | { message: string },
  message: string
}
```

### Example Responses

**Create Address:**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "label": "Home",
    "firstName": "John",
    "lastName": "Doe",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA",
    "phone": "+1234567890",
    "isDefault": true
  },
  "message": "Address created successfully"
}
```

**List Addresses:**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "isDefault": true,
      ...
    },
    {
      "id": "uuid-2",
      "isDefault": false,
      ...
    }
  ],
  "message": "Addresses retrieved successfully"
}
```

## Usage Examples

### Creating an Address
```bash
POST /api/addresses
Authorization: Bearer <token>
Content-Type: application/json

{
  "label": "Home",
  "firstName": "John",
  "lastName": "Doe",
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "USA",
  "phone": "+1234567890",
  "isDefault": true
}
```

### Setting Default Address
```bash
POST /api/addresses/:id/set-default
Authorization: Bearer <token>
```

### Getting All Addresses
```bash
GET /api/addresses
Authorization: Bearer <token>
```

## Integration Points

### ✅ Ready for Frontend Integration
- RESTful API design
- Consistent response format
- Error handling ready
- Type definitions available in shared-types package

### ✅ Works with Orders
- Addresses can be selected during checkout
- Used for shipping and billing addresses
- Validated during order creation

### ✅ User Profile Integration
- Can be displayed in user profile page
- Supports address management UI
- Default address can be used for quick checkout

## Testing Recommendations

### Unit Tests
- Test address creation with/without default flag
- Test default address reassignment logic
- Test ownership validation
- Test address deletion with default handling

### Integration Tests
- Test full CRUD workflow
- Test default address switching
- Test concurrent address operations
- Test address ordering

### E2E Tests
- Test address creation flow
- Test setting default address
- Test using address in checkout
- Test address management UI

## Potential Enhancements (Future)

1. **Address Validation**
   - Integration with address validation APIs
   - Postal code validation per country
   - Address format standardization

2. **Address Labels**
   - Predefined label options (Home, Work, Other)
   - Custom label validation

3. **Address History**
   - Track address changes
   - Prevent duplicate addresses

4. **Batch Operations**
   - Delete multiple addresses
   - Bulk update addresses

5. **Address Limits**
   - Maximum addresses per user
   - Address expiration for inactive users

## Code Quality

### ✅ Best Practices
- Separation of concerns (Service/Controller/DTO)
- Single responsibility principle
- DRY principle (mapping method)
- Error handling
- Type safety

### ✅ NestJS Patterns
- Dependency injection
- Guards for authentication
- DTOs for validation
- Module-based architecture

### ✅ Database Patterns
- Efficient queries
- Proper indexing usage (userId, isDefault)
- Transaction safety for default updates

## Conclusion

The Address Management implementation is **production-ready** with:
- ✅ Complete CRUD operations
- ✅ Security and authorization
- ✅ Smart default handling
- ✅ Type safety
- ✅ Error handling
- ✅ Integration ready

**Status**: ✅ **Complete and Ready for Use**

---

Next: Continue with remaining Phase 2 features (Reviews, File Upload, Wishlist, Payments, etc.)



/**
 * Authenticated user context attached to the request by the JWT guard.
 * Every microservice receives this shape after the gateway validates the token.
 */
export interface AuthUser {
  /** User UUID */
  id: string;
  /** User email */
  email: string;
  /** User role (ADMIN, SELLER, CUSTOMER, etc.) */
  role: string;
  /** Optional permission role ID for fine-grained RBAC */
  permissionRoleId?: string;
  /** Optional tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Optional seller ID (if user is a seller) */
  sellerId?: string;
  /** Optional first name */
  firstName?: string;
  /** Optional last name */
  lastName?: string;
}

/**
 * User roles enum matching the Prisma schema
 */
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  WHOLESALER = 'WHOLESALER',
  B2C_SELLER = 'B2C_SELLER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
  INFLUENCER = 'INFLUENCER',
  PROCUREMENT = 'PROCUREMENT',
  FULFILLMENT = 'FULFILLMENT',
  CATALOG = 'CATALOG',
  MARKETING = 'MARKETING',
  FINANCE = 'FINANCE',
  CMS_EDITOR = 'CMS_EDITOR',
}

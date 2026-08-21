/**
 * Hybrid access-control types and permission catalog.
 * Single source of truth — consumed by the API, admin UI, and api-client.
 */

export type AccessScopeType = 'GLOBAL' | 'MARKET' | 'TENANT' | 'STORE';

export type PermissionScopeKind = 'ANY' | AccessScopeType;

export type AccessControlMode = 'legacy' | 'shadow' | 'enforce';

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
}

/** Canonical permission ids. Keep action.subject style (`orders.view`). */
export const PERMISSION_CATALOG = [
  // Products
  { id: 'products.view', name: 'View Products', description: 'View product catalog and details', category: 'Products' },
  { id: 'products.create', name: 'Create Products', description: 'Create new products', category: 'Products' },
  { id: 'products.edit', name: 'Edit Products', description: 'Edit existing products', category: 'Products' },
  { id: 'products.delete', name: 'Delete Products', description: 'Delete products', category: 'Products' },
  { id: 'products.publish', name: 'Publish Products', description: 'Publish or unpublish products', category: 'Products' },
  // Orders
  { id: 'orders.view', name: 'View Orders', description: 'View orders', category: 'Orders' },
  { id: 'orders.manage', name: 'Manage Orders', description: 'Update order status and fulfillment', category: 'Orders' },
  { id: 'orders.cancel', name: 'Cancel Orders', description: 'Cancel orders', category: 'Orders' },
  { id: 'orders.refund', name: 'Refund Orders', description: 'Issue refunds', category: 'Orders' },
  { id: 'orders.accept', name: 'Accept Orders', description: 'Seller accept/reject child orders', category: 'Orders' },
  // Users
  { id: 'users.view', name: 'View Users', description: 'View user accounts', category: 'Users' },
  { id: 'users.create', name: 'Create Users', description: 'Create user accounts', category: 'Users' },
  { id: 'users.edit', name: 'Edit Users', description: 'Edit user accounts', category: 'Users' },
  { id: 'users.delete', name: 'Delete Users', description: 'Delete user accounts', category: 'Users' },
  { id: 'users.manage', name: 'Manage All Users', description: 'Admin-level access to list and manage all user accounts', category: 'Users' },
  { id: 'users.roles', name: 'Manage User Roles', description: 'Assign roles and permission sets', category: 'Users' },
  // Sellers
  { id: 'sellers.view', name: 'View Sellers', description: 'View seller accounts', category: 'Sellers' },
  { id: 'sellers.approve', name: 'Approve Sellers', description: 'Approve seller applications', category: 'Sellers' },
  { id: 'sellers.suspend', name: 'Suspend Sellers', description: 'Suspend seller accounts', category: 'Sellers' },
  { id: 'sellers.operate', name: 'Operate as Seller', description: 'Manage own seller storefront', category: 'Sellers' },
  // Submissions / catalog pipeline
  { id: 'submissions.review', name: 'Review Submissions', description: 'Review product submissions', category: 'Business Ops' },
  { id: 'submissions.approve', name: 'Approve Submissions', description: 'Approve product submissions', category: 'Business Ops' },
  { id: 'submissions.reject', name: 'Reject Submissions', description: 'Reject product submissions', category: 'Business Ops' },
  { id: 'catalog.create', name: 'Create Catalog', description: 'Create catalog entries', category: 'Business Ops' },
  { id: 'catalog.manage', name: 'Manage Catalog', description: 'Manage catalog taxonomy and publishing', category: 'Business Ops' },
  { id: 'pricing.approve', name: 'Approve Pricing', description: 'Approve pricing changes', category: 'Business Ops' },
  // Shipping / fulfillment
  { id: 'shipments.verify', name: 'Verify Shipments', description: 'Verify outbound shipments', category: 'Fulfillment' },
  { id: 'fulfillment.view', name: 'View Fulfillment', description: 'View fulfillment queues', category: 'Fulfillment' },
  { id: 'fulfillment.manage', name: 'Manage Fulfillment', description: 'Assign warehouses and ship orders', category: 'Fulfillment' },
  { id: 'shipping.view', name: 'View Shipping', description: 'View shipping methods and rates', category: 'Fulfillment' },
  { id: 'shipping.manage', name: 'Manage Shipping', description: 'Configure shipping methods and carriers', category: 'Fulfillment' },
  { id: 'inventory.view', name: 'View Inventory', description: 'View stock levels', category: 'Fulfillment' },
  { id: 'inventory.manage', name: 'Manage Inventory', description: 'Adjust stock and reservations', category: 'Fulfillment' },
  // Finance
  { id: 'finance.view', name: 'View Finance', description: 'View financial reports and ledgers', category: 'Finance' },
  { id: 'finance.manage', name: 'Manage Finance', description: 'Post adjustments and close periods', category: 'Finance' },
  { id: 'finance.payouts', name: 'Manage Payouts', description: 'Create and approve seller payouts', category: 'Finance' },
  { id: 'finance.reconciliation', name: 'Reconcile', description: 'Run payment reconciliation', category: 'Finance' },
  { id: 'settlements.view', name: 'View Settlements', description: 'View seller settlements', category: 'Finance' },
  { id: 'settlements.manage', name: 'Manage Settlements', description: 'Generate and pay settlements', category: 'Finance' },
  { id: 'cancellations.view', name: 'View Cancellations', description: 'View cancellation requests', category: 'Finance' },
  { id: 'cancellations.review', name: 'Review Cancellations', description: 'Approve or reject cancellations', category: 'Finance' },
  { id: 'returns.view', name: 'View Returns', description: 'View return requests', category: 'Finance' },
  { id: 'returns.manage', name: 'Manage Returns', description: 'Process returns and refunds', category: 'Finance' },
  { id: 'invoices.view', name: 'View Invoices', description: 'Download invoices', category: 'Finance' },
  { id: 'gift-cards.view', name: 'View Gift Cards', description: 'View gift cards', category: 'Finance' },
  { id: 'gift-cards.manage', name: 'Manage Gift Cards', description: 'Issue and void gift cards', category: 'Finance' },
  { id: 'tax.view', name: 'View Tax', description: 'View tax configuration', category: 'Finance' },
  { id: 'tax.manage', name: 'Manage Tax', description: 'Configure tax providers and zones', category: 'Finance' },
  // Marketing
  { id: 'marketing.create', name: 'Create Marketing', description: 'Create campaigns and content', category: 'Marketing' },
  { id: 'marketing.manage', name: 'Manage Marketing', description: 'Manage promotions, journeys, segments', category: 'Marketing' },
  { id: 'promotions.view', name: 'View Promotions', description: 'View promotions and coupons', category: 'Marketing' },
  { id: 'promotions.manage', name: 'Manage Promotions', description: 'Create and edit promotions', category: 'Marketing' },
  { id: 'cms.edit', name: 'Edit CMS', description: 'Edit CMS and blog content', category: 'Marketing' },
  // Influencers
  { id: 'influencers.view', name: 'View Influencers', description: 'View influencer accounts', category: 'Influencers' },
  { id: 'influencers.manage', name: 'Manage Influencers', description: 'Manage campaigns, commissions, payouts', category: 'Influencers' },
  // Loyalty / stores
  { id: 'loyalty.view', name: 'View Loyalty', description: 'View loyalty programme', category: 'Loyalty' },
  { id: 'loyalty.manage', name: 'Manage Loyalty', description: 'Configure loyalty and POS vouchers', category: 'Loyalty' },
  { id: 'stores.view', name: 'View Stores', description: 'View retail stores', category: 'Stores' },
  { id: 'stores.manage', name: 'Manage Stores', description: 'Create and configure stores', category: 'Stores' },
  { id: 'stores.operate', name: 'Operate Store', description: 'POS and store-staff operations', category: 'Stores' },
  // System
  { id: 'system.settings', name: 'System Settings', description: 'Change platform settings', category: 'System' },
  { id: 'system.themes', name: 'Manage Themes', description: 'Upload and assign themes', category: 'System' },
  { id: 'system.permissions', name: 'Manage Permissions', description: 'Edit permission roles', category: 'System' },
  { id: 'system.analytics', name: 'View Analytics', description: 'View platform analytics', category: 'System' },
  { id: 'tenants.view', name: 'View Tenants', description: 'View tenants', category: 'System' },
  { id: 'tenants.manage', name: 'Manage Tenants', description: 'Create and edit tenants', category: 'System' },
  { id: 'markets.view', name: 'View Markets', description: 'View selling markets', category: 'System' },
  { id: 'markets.manage', name: 'Manage Markets', description: 'Create and edit markets', category: 'System' },
  { id: 'support.view', name: 'View Support', description: 'View support tickets', category: 'System' },
  { id: 'support.manage', name: 'Manage Support', description: 'Assign and resolve tickets', category: 'System' },
  { id: 'uploads.manage', name: 'Manage Uploads', description: 'Upload and delete media', category: 'System' },
  { id: 'webhooks.manage', name: 'Manage Webhooks', description: 'Configure outbound webhooks', category: 'System' },
  { id: 'procurement.view', name: 'View Procurement', description: 'View procurement queues', category: 'Business Ops' },
  { id: 'procurement.manage', name: 'Manage Procurement', description: 'Process procurement submissions', category: 'Business Ops' },
] as const satisfies readonly PermissionDefinition[];

export type PermissionId = (typeof PERMISSION_CATALOG)[number]['id'] | '*';

export const PERMISSION_IDS: readonly string[] = PERMISSION_CATALOG.map((p) => p.id);

export const BUILT_IN_PERMISSION_ROLES = [
  'ADMIN',
  'PROCUREMENT',
  'FULFILLMENT',
  'CATALOG',
  'MARKETING',
  'FINANCE',
  'SALES',
  'SELLER',
  'B2C_SELLER',
  'WHOLESALER',
  'CUSTOMER',
  'CMS_EDITOR',
  'INFLUENCER',
  'STORE_STAFF',
] as const;

export type BuiltInPermissionRole = (typeof BUILT_IN_PERMISSION_ROLES)[number];

/** Default permission grants per built-in role. ADMIN gets `*`. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'],
  PROCUREMENT: [
    'users.view',
    'users.edit',
    'submissions.review',
    'submissions.approve',
    'submissions.reject',
    'products.view',
    'catalog.create',
    'procurement.view',
    'procurement.manage',
  ],
  FULFILLMENT: [
    'users.view',
    'users.edit',
    'shipments.verify',
    'orders.view',
    'orders.manage',
    'fulfillment.view',
    'fulfillment.manage',
    'inventory.view',
    'inventory.manage',
    'shipping.view',
  ],
  CATALOG: [
    'users.view',
    'users.edit',
    'catalog.create',
    'catalog.manage',
    'products.view',
    'products.edit',
    'products.create',
    'products.publish',
    'submissions.approve',
    'submissions.reject',
  ],
  MARKETING: [
    'users.view',
    'users.edit',
    'marketing.create',
    'marketing.manage',
    'promotions.view',
    'promotions.manage',
    'products.view',
    'cms.edit',
  ],
  FINANCE: [
    'users.view',
    'users.edit',
    'pricing.approve',
    'orders.view',
    'orders.refund',
    'finance.view',
    'finance.manage',
    'finance.payouts',
    'finance.reconciliation',
    'settlements.view',
    'settlements.manage',
    'cancellations.view',
    'cancellations.review',
    'returns.view',
    'returns.manage',
    'invoices.view',
    'gift-cards.view',
    'tax.view',
  ],
  SALES: ['users.view', 'users.edit', 'orders.view', 'sellers.view', 'products.view'],
  SELLER: [
    'users.view',
    'users.edit',
    'system.analytics',
    'products.create',
    'products.edit',
    'products.view',
    'products.delete',
    'orders.view',
    'orders.manage',
    'orders.accept',
    'sellers.operate',
    'inventory.view',
    'inventory.manage',
    'settlements.view',
    'invoices.view',
  ],
  B2C_SELLER: [
    'users.view',
    'users.edit',
    'system.analytics',
    'products.create',
    'products.edit',
    'products.view',
    'products.delete',
    'orders.view',
    'orders.manage',
    'orders.accept',
    'sellers.operate',
    'inventory.view',
    'inventory.manage',
    'settlements.view',
    'invoices.view',
  ],
  WHOLESALER: [
    'users.view',
    'users.edit',
    'system.analytics',
    'products.create',
    'products.edit',
    'products.view',
    'orders.view',
    'orders.manage',
    'orders.accept',
    'sellers.operate',
    'inventory.view',
    'inventory.manage',
  ],
  CUSTOMER: [
    'users.view',
    'users.edit',
    'products.view',
    'orders.view',
    'orders.manage',
    'orders.cancel',
    'invoices.view',
    'loyalty.view',
    'loyalty.manage',
    'promotions.view',
    'promotions.manage',
    'influencers.view',
    'influencers.manage',
  ],
  CMS_EDITOR: [
    'users.view',
    'users.edit',
    'products.view',
    'products.edit',
    'catalog.create',
    'cms.edit',
    'marketing.create',
  ],
  INFLUENCER: ['users.view', 'users.edit', 'influencers.view', 'products.view'],
  STORE_STAFF: ['users.view', 'users.edit', 'stores.operate', 'loyalty.view', 'loyalty.manage', 'orders.view'],
};

export interface MarketSummary {
  id: string;
  code: string;
  name: string;
  country: string;
  countryCode: string;
  currency: string;
  locale: string;
  timezone: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface RoleAssignmentSummary {
  id: string;
  permissionRoleName: string;
  permissions: string[];
  scopeType: AccessScopeType;
  scopeId: string | null;
}

export interface AccessControlMe {
  userId: string;
  role: string;
  isGlobalAdmin: boolean;
  permissions: string[];
  assignments: RoleAssignmentSummary[];
  markets: MarketSummary[];
  activeMarket: MarketSummary | null;
}

export interface RequireAccessMeta {
  /** Permission id, e.g. `orders.view` */
  permission: string;
  /** Default MARKET — GLOBAL skips market membership check */
  scope?: AccessScopeType | 'SELF';
  /** Optional CASL subject for ownership policies */
  subject?: string;
}

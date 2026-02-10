/**
 * Service Registry Configuration
 *
 * Maps route prefixes to their target microservice URLs.
 * During the migration, all routes initially point to the monolith (services/api).
 * As services are extracted, their routes are updated here to point to the new service.
 *
 * Environment variables override defaults for each service URL.
 */

export interface ServiceConfig {
  /** Service name (for logging and health checks) */
  name: string;
  /** Target URL (protocol + host + port) */
  url: string;
  /** Route prefixes that should be proxied to this service */
  prefixes: string[];
  /** Whether this service is enabled */
  enabled: boolean;
}

/**
 * Check whether a service URL env var is set to a non-empty value.
 * An empty string or undefined means the service is disabled and
 * its routes fall through to the monolith.
 */
function isServiceEnabled(envVar: string | undefined): boolean {
  return !!envVar && envVar.trim().length > 0;
}

export function getServiceConfigs(): ServiceConfig[] {
  // Default: everything goes to the monolith
  const monolithUrl =
    process.env.MONOLITH_API_URL || 'http://localhost:3001';

  return [
    // ─── Phase 1 Services (initially disabled, enabled when extracted) ──────
    {
      name: 'auth-service',
      url: process.env.AUTH_SERVICE_URL || monolithUrl,
      prefixes: ['/api/auth'],
      enabled: isServiceEnabled(process.env.AUTH_SERVICE_URL),
    },
    {
      name: 'notification-service',
      url: process.env.NOTIFICATION_SERVICE_URL || monolithUrl,
      prefixes: ['/api/notifications', '/api/whatsapp', '/api/newsletter'],
      enabled: isServiceEnabled(process.env.NOTIFICATION_SERVICE_URL),
    },
    {
      name: 'search-service',
      url: process.env.SEARCH_SERVICE_URL || monolithUrl,
      prefixes: ['/api/search', '/api/meilisearch'],
      enabled: isServiceEnabled(process.env.SEARCH_SERVICE_URL),
    },

    // ─── Phase 2 Services ──────────────────────────────────────────────────
    {
      name: 'user-service',
      url: process.env.USER_SERVICE_URL || monolithUrl,
      prefixes: ['/api/users', '/api/addresses', '/api/customer-groups'],
      enabled: isServiceEnabled(process.env.USER_SERVICE_URL),
    },
    {
      name: 'product-service',
      url: process.env.PRODUCT_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/products',
        '/api/collections',
        '/api/taxonomy',
        '/api/characters',
        '/api/fandoms',
        '/api/digital-products',
        '/api/duplicates',
      ],
      enabled: isServiceEnabled(process.env.PRODUCT_SERVICE_URL),
    },
    {
      name: 'order-service',
      url: process.env.ORDER_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/orders',
        '/api/cart',
        '/api/returns',
        '/api/return-policies',
        '/api/gift-cards',
      ],
      enabled: isServiceEnabled(process.env.ORDER_SERVICE_URL),
    },
    {
      name: 'payment-service',
      url: process.env.PAYMENT_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/payments',
        '/api/klarna',
        '/api/finance',
        '/api/settlements',
        '/api/currency',
      ],
      enabled: isServiceEnabled(process.env.PAYMENT_SERVICE_URL),
    },

    // ─── Phase 3 Services ──────────────────────────────────────────────────
    {
      name: 'inventory-service',
      url: process.env.INVENTORY_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/inventory',
        '/api/shipping',
        '/api/courier',
        '/api/logistics',
        '/api/fulfillment',
      ],
      enabled: isServiceEnabled(process.env.INVENTORY_SERVICE_URL),
    },
    {
      name: 'seller-service',
      url: process.env.SELLER_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/sellers',
        '/api/submissions',
        '/api/procurement',
        '/api/domains',
        '/api/reviews',
      ],
      enabled: isServiceEnabled(process.env.SELLER_SERVICE_URL),
    },
    {
      name: 'influencer-service',
      url: process.env.INFLUENCER_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/influencers',
        '/api/influencer-storefronts',
        '/api/influencer-campaigns',
        '/api/influencer-commissions',
        '/api/influencer-payouts',
        '/api/influencer-invitations',
        '/api/referrals',
      ],
      enabled: isServiceEnabled(process.env.INFLUENCER_SERVICE_URL),
    },
    {
      name: 'content-service',
      url: process.env.CONTENT_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/cms',
        '/api/themes',
        '/api/publishing',
        '/api/marketing',
        '/api/promotions',
        '/api/social-sharing',
        '/api/gamification',
        '/api/badges',
        '/api/quests',
      ],
      enabled: isServiceEnabled(process.env.CONTENT_SERVICE_URL),
    },
    {
      name: 'admin-service',
      url: process.env.ADMIN_SERVICE_URL || monolithUrl,
      prefixes: [
        '/api/admin',
        '/api/analytics',
        '/api/dashboard',
        '/api/monitoring',
        '/api/activity',
        '/api/discrepancies',
        '/api/support',
        '/api/ai',
        '/api/gdpr',
        '/api/compliance',
        '/api/webhooks',
        '/api/integrations',
      ],
      enabled: isServiceEnabled(process.env.ADMIN_SERVICE_URL),
    },

    // ─── Monolith Fallback (catches everything not matched above) ──────────
    {
      name: 'monolith-api',
      url: monolithUrl,
      prefixes: ['/api'],
      enabled: true,
    },
  ];
}

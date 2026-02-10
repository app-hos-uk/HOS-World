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
      enabled: process.env.AUTH_SERVICE_URL !== undefined,
    },
    {
      name: 'notification-service',
      url: process.env.NOTIFICATION_SERVICE_URL || monolithUrl,
      prefixes: ['/api/notifications', '/api/whatsapp', '/api/newsletter'],
      enabled: process.env.NOTIFICATION_SERVICE_URL !== undefined,
    },
    {
      name: 'search-service',
      url: process.env.SEARCH_SERVICE_URL || monolithUrl,
      prefixes: ['/api/search', '/api/meilisearch'],
      enabled: process.env.SEARCH_SERVICE_URL !== undefined,
    },

    // ─── Phase 2 Services ──────────────────────────────────────────────────
    {
      name: 'user-service',
      url: process.env.USER_SERVICE_URL || monolithUrl,
      prefixes: ['/api/users', '/api/addresses', '/api/customer-groups'],
      enabled: process.env.USER_SERVICE_URL !== undefined,
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
      enabled: process.env.PRODUCT_SERVICE_URL !== undefined,
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
      enabled: process.env.ORDER_SERVICE_URL !== undefined,
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
      enabled: process.env.PAYMENT_SERVICE_URL !== undefined,
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
      enabled: process.env.INVENTORY_SERVICE_URL !== undefined,
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
      enabled: process.env.SELLER_SERVICE_URL !== undefined,
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
      enabled: process.env.INFLUENCER_SERVICE_URL !== undefined,
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
      enabled: process.env.CONTENT_SERVICE_URL !== undefined,
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
      enabled: process.env.ADMIN_SERVICE_URL !== undefined,
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

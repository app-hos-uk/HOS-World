/**
 * Domain Event Contracts
 *
 * All microservices use these typed event contracts for inter-service communication.
 * Pattern: {domain}.{entity}.{action}
 *
 * Each event interface defines the payload shape. Services emit events after
 * completing their primary action (e.g., OrderService emits 'order.order.created'
 * after persisting the order).
 */

// ─── Base Event ──────────────────────────────────────────────────────────────

export interface DomainEvent<T = unknown> {
  /** Unique event ID (UUID) */
  eventId: string;
  /** Event pattern, e.g. 'order.order.created' */
  pattern: string;
  /** ISO-8601 timestamp of when the event was produced */
  timestamp: string;
  /** ID of the service that produced the event */
  source: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Typed payload */
  payload: T;
}

// ─── Auth Events ─────────────────────────────────────────────────────────────

export const AUTH_EVENTS = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged_in',
  USER_LOGGED_OUT: 'auth.user.logged_out',
  PASSWORD_RESET: 'auth.user.password_reset',
  TENANT_CREATED: 'auth.tenant.created',
} as const;

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export interface UserLoggedInPayload {
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TenantCreatedPayload {
  tenantId: string;
  name: string;
  subdomain: string;
  domain?: string;
}

// ─── User Events ─────────────────────────────────────────────────────────────

export const USER_EVENTS = {
  CREATED: 'user.user.created',
  UPDATED: 'user.user.updated',
  DELETED: 'user.user.deleted',
  ADDRESS_CHANGED: 'user.address.changed',
  ROLE_CHANGED: 'user.user.role_changed',
} as const;

export interface UserCreatedPayload {
  userId: string;
  email: string;
  role: string;
}

export interface UserUpdatedPayload {
  userId: string;
  changes: Record<string, unknown>;
}

export interface UserAddressChangedPayload {
  userId: string;
  addressId: string;
  action: 'created' | 'updated' | 'deleted';
}

// ─── Product Events ──────────────────────────────────────────────────────────

export const PRODUCT_EVENTS = {
  CREATED: 'product.product.created',
  UPDATED: 'product.product.updated',
  DELETED: 'product.product.deleted',
  PRICE_CHANGED: 'product.product.price_changed',
  STATUS_CHANGED: 'product.product.status_changed',
  STOCK_CHANGED: 'product.product.stock_changed',
} as const;

export interface ProductCreatedPayload {
  productId: string;
  sellerId: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  status: string;
}

export interface ProductUpdatedPayload {
  productId: string;
  changes: Record<string, unknown>;
}

export interface ProductDeletedPayload {
  productId: string;
  sellerId: string;
}

export interface ProductPriceChangedPayload {
  productId: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
}

// ─── Order Events ────────────────────────────────────────────────────────────

export const ORDER_EVENTS = {
  CREATED: 'order.order.created',
  STATUS_CHANGED: 'order.order.status_changed',
  CANCELLED: 'order.order.cancelled',
  COMPLETED: 'order.order.completed',
  ITEM_RETURNED: 'order.item.returned',
  RETURN_REQUESTED: 'order.return.requested',
  RETURN_APPROVED: 'order.return.approved',
} as const;

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  sellerId: string;
  items: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  currency: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  userId: string;
}

export interface OrderCancelledPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  reason?: string;
}

export interface ReturnRequestedPayload {
  returnId: string;
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    reason: string;
  }>;
}

// ─── Payment Events ──────────────────────────────────────────────────────────

export const PAYMENT_EVENTS = {
  COMPLETED: 'payment.payment.completed',
  FAILED: 'payment.payment.failed',
  REFUND_ISSUED: 'payment.refund.issued',
  PAYOUT_PROCESSED: 'payment.payout.processed',
} as const;

export interface PaymentCompletedPayload {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  provider: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
}

export interface RefundIssuedPayload {
  refundId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface PayoutProcessedPayload {
  payoutId: string;
  sellerId: string;
  amount: number;
  currency: string;
}

// ─── Inventory & Shipping Events ─────────────────────────────────────────────

export const INVENTORY_EVENTS = {
  RESERVED: 'inventory.stock.reserved',
  RELEASED: 'inventory.stock.released',
  STOCK_CHANGED: 'inventory.stock.changed',
  LOW_STOCK: 'inventory.stock.low',
} as const;

export const SHIPPING_EVENTS = {
  SHIPPED: 'shipping.shipment.shipped',
  DELIVERED: 'shipping.shipment.delivered',
  TRACKING_UPDATED: 'shipping.shipment.tracking_updated',
} as const;

export interface StockReservedPayload {
  productId: string;
  quantity: number;
  orderId: string;
  warehouseId?: string;
}

export interface StockChangedPayload {
  productId: string;
  warehouseId?: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
}

export interface ShipmentShippedPayload {
  shipmentId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
}

export interface ShipmentDeliveredPayload {
  shipmentId: string;
  orderId: string;
  deliveredAt: string;
}

// ─── Seller Events ───────────────────────────────────────────────────────────

export const SELLER_EVENTS = {
  APPROVED: 'seller.seller.approved',
  SUSPENDED: 'seller.seller.suspended',
  SUBMISSION_CREATED: 'seller.submission.created',
  SUBMISSION_APPROVED: 'seller.submission.approved',
  SUBMISSION_REJECTED: 'seller.submission.rejected',
  REVIEW_CREATED: 'seller.review.created',
} as const;

export interface SellerApprovedPayload {
  sellerId: string;
  userId: string;
  storeName: string;
}

export interface SubmissionCreatedPayload {
  submissionId: string;
  sellerId: string;
  productName: string;
}

export interface ReviewCreatedPayload {
  reviewId: string;
  productId: string;
  userId: string;
  rating: number;
}

// ─── Influencer Events ───────────────────────────────────────────────────────

export const INFLUENCER_EVENTS = {
  REFERRAL_TRACKED: 'influencer.referral.tracked',
  COMMISSION_EARNED: 'influencer.commission.earned',
  PAYOUT_REQUESTED: 'influencer.payout.requested',
  CAMPAIGN_STARTED: 'influencer.campaign.started',
} as const;

export interface ReferralTrackedPayload {
  referralId: string;
  influencerId: string;
  orderId: string;
  amount: number;
}

export interface CommissionEarnedPayload {
  commissionId: string;
  influencerId: string;
  orderId: string;
  amount: number;
  currency: string;
}

// ─── Notification Events ─────────────────────────────────────────────────────

export const NOTIFICATION_EVENTS = {
  SENT: 'notification.notification.sent',
  READ: 'notification.notification.read',
  EMAIL_QUEUED: 'notification.email.queued',
} as const;

export interface NotificationSentPayload {
  notificationId: string;
  userId: string;
  type: string;
  channel: 'in_app' | 'email' | 'push' | 'whatsapp';
}

// ─── Content & Marketing Events ──────────────────────────────────────────────

export const CONTENT_EVENTS = {
  CMS_PAGE_PUBLISHED: 'content.cms.published',
  PROMOTION_CREATED: 'content.promotion.created',
  PROMOTION_EXPIRED: 'content.promotion.expired',
} as const;

export interface PromotionCreatedPayload {
  promotionId: string;
  code?: string;
  discountType: string;
  discountValue: number;
  startsAt: string;
  expiresAt?: string;
}

// ─── Admin & Analytics Events ────────────────────────────────────────────────

export const ADMIN_EVENTS = {
  ACTIVITY_LOGGED: 'admin.activity.logged',
  WEBHOOK_DISPATCHED: 'admin.webhook.dispatched',
} as const;

export interface ActivityLoggedPayload {
  activityId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

// ─── Aggregate All Event Patterns ────────────────────────────────────────────

export const ALL_EVENTS = {
  ...AUTH_EVENTS,
  ...USER_EVENTS,
  ...PRODUCT_EVENTS,
  ...ORDER_EVENTS,
  ...PAYMENT_EVENTS,
  ...INVENTORY_EVENTS,
  ...SHIPPING_EVENTS,
  ...SELLER_EVENTS,
  ...INFLUENCER_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...CONTENT_EVENTS,
  ...ADMIN_EVENTS,
} as const;

export type EventPattern = (typeof ALL_EVENTS)[keyof typeof ALL_EVENTS];

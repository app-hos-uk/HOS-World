import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  ORDER_EVENTS,
  PAYMENT_EVENTS,
  SHIPPING_EVENTS,
  SELLER_EVENTS,
  AUTH_EVENTS,
  DomainEvent,
  OrderCreatedPayload,
  OrderStatusChangedPayload,
  OrderCancelledPayload,
  PaymentCompletedPayload,
  PaymentFailedPayload,
  ShipmentShippedPayload,
  ShipmentDeliveredPayload,
  SellerApprovedPayload,
  UserRegisteredPayload,
} from '@hos-marketplace/events';
import { NotificationService } from './notification.service';

/**
 * Event Handlers Controller
 *
 * Listens to domain events from the Redis event bus and triggers
 * the appropriate notification actions. This is the "consumer" side
 * of the event-driven architecture.
 *
 * Other services emit events (e.g., order.order.created) and this
 * service reacts by sending emails, in-app notifications, etc.
 */
@Controller()
export class EventHandlersController {
  private readonly logger = new Logger(EventHandlersController.name);

  constructor(private readonly notificationService: NotificationService) {}

  // ─── Order Events ─────────────────────────────────────────────────────────

  @EventPattern(ORDER_EVENTS.CREATED)
  async handleOrderCreated(
    @Payload() event: DomainEvent<OrderCreatedPayload>,
  ) {
    this.logger.log(
      `Order created event received: ${event.payload.orderNumber}`,
    );

    try {
      await this.notificationService.sendOrderConfirmation({
        orderId: event.payload.orderId,
        orderNumber: event.payload.orderNumber,
        userId: event.payload.userId,
        userEmail: '', // Will be resolved from user lookup or event enrichment
        items: event.payload.items.map((item) => ({
          name: item.productId, // In production, this would be enriched by the caller
          quantity: item.quantity,
          price: item.price,
        })),
        total: event.payload.total,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to handle order.created: ${error?.message}`,
      );
    }
  }

  @EventPattern(ORDER_EVENTS.CANCELLED)
  async handleOrderCancelled(
    @Payload() event: DomainEvent<OrderCancelledPayload>,
  ) {
    this.logger.log(
      `Order cancelled event received: ${event.payload.orderNumber}`,
    );

    try {
      await this.notificationService.sendNotificationToUser(
        event.payload.userId,
        'ORDER_CANCELLED',
        `Order Cancelled - ${event.payload.orderNumber}`,
        `Your order ${event.payload.orderNumber} has been cancelled.${
          event.payload.reason ? ` Reason: ${event.payload.reason}` : ''
        }`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle order.cancelled: ${error?.message}`,
      );
    }
  }

  // ─── Payment Events ───────────────────────────────────────────────────────

  @EventPattern(PAYMENT_EVENTS.COMPLETED)
  async handlePaymentCompleted(
    @Payload() event: DomainEvent<PaymentCompletedPayload>,
  ) {
    this.logger.log(
      `Payment completed event received: ${event.payload.paymentId}`,
    );

    try {
      await this.notificationService.sendNotificationToUser(
        event.payload.userId,
        'PAYMENT_RECEIVED',
        'Payment Received',
        `Your payment of ${event.payload.currency} ${event.payload.amount.toFixed(2)} has been received.`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle payment.completed: ${error?.message}`,
      );
    }
  }

  @EventPattern(PAYMENT_EVENTS.FAILED)
  async handlePaymentFailed(
    @Payload() event: DomainEvent<PaymentFailedPayload>,
  ) {
    this.logger.log(
      `Payment failed event received: ${event.payload.paymentId}`,
    );

    try {
      await this.notificationService.sendNotificationToUser(
        event.payload.userId,
        'PAYMENT_FAILED',
        'Payment Failed',
        `Your payment of ${event.payload.currency} ${event.payload.amount.toFixed(2)} has failed. Reason: ${event.payload.reason}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle payment.failed: ${error?.message}`,
      );
    }
  }

  // ─── Shipping Events ──────────────────────────────────────────────────────

  @EventPattern(SHIPPING_EVENTS.SHIPPED)
  async handleShipmentShipped(
    @Payload() event: DomainEvent<ShipmentShippedPayload>,
  ) {
    this.logger.log(
      `Shipment shipped event received: ${event.payload.shipmentId}`,
    );

    // NOTE: In a full implementation, we'd look up user/order details.
    // For now, the event handler demonstrates the pattern.
    this.logger.log(
      `Would send shipment notification for order ${event.payload.orderId}, tracking: ${event.payload.trackingNumber}`,
    );
  }

  @EventPattern(SHIPPING_EVENTS.DELIVERED)
  async handleShipmentDelivered(
    @Payload() event: DomainEvent<ShipmentDeliveredPayload>,
  ) {
    this.logger.log(
      `Shipment delivered event received: ${event.payload.shipmentId}`,
    );

    this.logger.log(
      `Would send delivery notification for order ${event.payload.orderId}`,
    );
  }

  // ─── Seller Events ────────────────────────────────────────────────────────

  @EventPattern(SELLER_EVENTS.APPROVED)
  async handleSellerApproved(
    @Payload() event: DomainEvent<SellerApprovedPayload>,
  ) {
    this.logger.log(
      `Seller approved event received: ${event.payload.sellerId}`,
    );

    try {
      await this.notificationService.sendNotificationToUser(
        event.payload.userId,
        'ORDER_CONFIRMATION', // Re-using enum; in production would add SELLER_APPROVED type
        'Seller Account Approved',
        `Congratulations! Your seller account "${event.payload.storeName}" has been approved. You can now start listing products.`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle seller.approved: ${error?.message}`,
      );
    }
  }

  // ─── Auth Events ──────────────────────────────────────────────────────────

  @EventPattern(AUTH_EVENTS.USER_REGISTERED)
  async handleUserRegistered(
    @Payload() event: DomainEvent<UserRegisteredPayload>,
  ) {
    this.logger.log(
      `User registered event received: ${event.payload.userId}`,
    );

    try {
      await this.notificationService.sendNotificationToUser(
        event.payload.userId,
        'ORDER_CONFIRMATION', // Re-using enum; in production would add WELCOME type
        'Welcome to House of Spells!',
        `Welcome ${event.payload.firstName || ''}! Your account has been created successfully.`,
        event.payload.email,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle auth.user.registered: ${error?.message}`,
      );
    }
  }
}

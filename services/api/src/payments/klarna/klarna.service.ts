import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyService } from '../../currency/currency.service';

interface KlarnaSessionRequest {
  orderAmount: number;
  orderLines: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
  billingAddress?: any;
  shippingAddress?: any;
}

@Injectable()
export class KlarnaService {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly BASE_CURRENCY = 'GBP';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private currencyService: CurrencyService,
  ) {
    const isTest = this.configService.get('NODE_ENV') !== 'production';
    this.baseUrl = isTest
      ? 'https://api.playground.klarna.com'
      : 'https://api.klarna.com';
    this.username = this.configService.get('KLARNA_USERNAME') || '';
    this.password = this.configService.get('KLARNA_PASSWORD') || '';
  }

  /**
   * Create Klarna payment session
   */
  async createSession(request: KlarnaSessionRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/payments/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
      },
      body: JSON.stringify({
        purchase_country: 'GB', // UK for GBP
        purchase_currency: 'GBP', // All payments in GBP
        locale: 'en-GB',
        order_amount: request.orderAmount, // Should already be in GBP
        order_lines: request.orderLines,
        billing_address: request.billingAddress,
        shipping_address: request.shippingAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Klarna session creation failed: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Confirm Klarna payment
   */
  async confirmPayment(authorizationToken: string, orderId: string): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Convert order total to GBP if needed
    let orderAmountGBP: number;
    if (order.currency === this.BASE_CURRENCY) {
      orderAmountGBP = Number(order.total);
    } else {
      orderAmountGBP = await this.currencyService.convertBetween(
        Number(order.total),
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    const response = await fetch(
      `${this.baseUrl}/payments/v1/authorizations/${authorizationToken}/order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
        },
        body: JSON.stringify({
          purchase_country: 'GB', // UK for GBP
          purchase_currency: 'GBP', // All payments in GBP
          locale: 'en-GB',
          order_amount: orderAmountGBP, // Amount in GBP
          order_lines: order.items.map((item) => {
            // Convert item prices to GBP if needed
            const itemPriceGBP = order.currency === this.BASE_CURRENCY
              ? Number(item.price)
              : null; // Will need conversion - simplified for now
            return {
              name: item.productName,
              quantity: item.quantity,
              unit_price: itemPriceGBP || Number(item.price), // Should be in GBP
              total_amount: (itemPriceGBP || Number(item.price)) * item.quantity,
            };
          }),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Klarna payment confirmation failed: ${error.message}`);
    }

    const result = await response.json();

    // Convert order total to GBP for payment record
    let paymentAmountGBP: number;
    if (order.currency === this.BASE_CURRENCY) {
      paymentAmountGBP = Number(order.total);
    } else {
      paymentAmountGBP = await this.currencyService.convertBetween(
        Number(order.total),
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    // Create payment record - always in GBP
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentId: result.order_id, // Store Klarna order ID
        amount: paymentAmountGBP, // Amount in GBP
        currency: this.BASE_CURRENCY, // Always GBP for payments
        status: 'COMPLETED',
        paymentMethod: 'klarna',
        metadata: {
          klarnaOrderId: result.order_id,
          authorizationToken,
          originalCurrency: order.currency,
          originalAmount: Number(order.total).toFixed(2),
        } as any,
      },
    });

    return result;
  }

  /**
   * Capture Klarna payment (after order fulfillment)
   */
  async capturePayment(klarnaOrderId: string, amount?: number): Promise<any> {
    const url = amount
      ? `${this.baseUrl}/ordermanagement/v1/orders/${klarnaOrderId}/captures`
      : `${this.baseUrl}/ordermanagement/v1/orders/${klarnaOrderId}/captures`;

    const body = amount
      ? {
          captured_amount: amount,
        }
      : {};

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Klarna capture failed: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Refund Klarna payment
   * Note: Amount should be in GBP
   */
  async refundPayment(klarnaOrderId: string, amount: number, description?: string): Promise<any> {
    // Amount is expected to be in GBP (base currency)
    const response = await fetch(
      `${this.baseUrl}/ordermanagement/v1/orders/${klarnaOrderId}/refunds`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
        },
        body: JSON.stringify({
          refunded_amount: amount,
          description: description || 'Order refund',
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Klarna refund failed: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Handle Klarna webhook
   */
  async handleWebhook(payload: any, signature: string): Promise<any> {
    // Verify webhook signature if needed
    // Klarna sends different webhook events

    const eventType = payload.event_type;

    switch (eventType) {
      case 'FRAUD_RISK_ACCEPTED':
      case 'FRAUD_RISK_REJECTED':
      case 'FRAUD_RISK_STOPPED':
        // Handle fraud risk events
        break;
      case 'ORDER_CAPTURED':
        // Update order status
        break;
      case 'ORDER_CANCELLED':
        // Cancel order
        break;
    }

    return { received: true };
  }
}


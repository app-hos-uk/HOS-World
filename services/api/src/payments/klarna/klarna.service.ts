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
  private readonly BASE_CURRENCY = 'USD';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private currencyService: CurrencyService,
  ) {
    const isTest = this.configService.get('NODE_ENV') !== 'production';
    this.baseUrl = isTest ? 'https://api.playground.klarna.com' : 'https://api.klarna.com';
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
        purchase_country: 'US',
        purchase_currency: 'USD',
        locale: 'en-US',
        order_amount: request.orderAmount,
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
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    let orderAmountUSD: number;
    if (order.currency === this.BASE_CURRENCY) {
      orderAmountUSD = Number(order.total);
    } else {
      orderAmountUSD = await this.currencyService.convertBetween(
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
          purchase_country: 'US',
          purchase_currency: 'USD',
          locale: 'en-US',
          order_amount: orderAmountUSD,
          order_lines: order.items.map((item) => {
            const itemPrice = order.currency === this.BASE_CURRENCY ? Number(item.price) : null;
            return {
              name: item.product?.name || 'Product',
              quantity: item.quantity,
              unit_price: itemPrice || Number(item.price),
              total_amount: (itemPrice || Number(item.price)) * item.quantity,
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

    let paymentAmount: number;
    if (order.currency === this.BASE_CURRENCY) {
      paymentAmount = Number(order.total);
    } else {
      paymentAmount = await this.currencyService.convertBetween(
        Number(order.total),
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentId: result.order_id, // Store Klarna order ID
        amount: paymentAmount,
        currency: this.BASE_CURRENCY,
        status: 'PAID',
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
   * Note: Amount should be in USD (base currency)
   */
  async refundPayment(klarnaOrderId: string, amount: number, description?: string): Promise<any> {
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

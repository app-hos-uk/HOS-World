import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import { CourierFactoryService } from '../shipping/courier/courier-factory.service';
import {
  Address,
  PackageDimensions,
  RateResponse,
  ShipmentResponse,
} from '../shipping/courier/interfaces/courier-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../finance/transactions.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { PLATFORM_DEFAULT_CURRENCY } from '../common/currency-defaults';

const DEFAULT_PACKAGE: PackageDimensions = {
  length: 30,
  width: 20,
  height: 10,
  weight: 1,
};

@Injectable()
export class OrderShippingService {
  private readonly logger = new Logger(OrderShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courierFactory: CourierFactoryService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly transactionsService: TransactionsService,
    private readonly vendorLedgerService: VendorLedgerService,
    @Optional()
    @Inject(NotificationsService)
    private readonly notificationsService?: NotificationsService,
  ) {}

  async getOrderShippingRates(orderId: string, providerName?: string): Promise<RateResponse[]> {
    const { packages, from, to } = await this.buildShipmentContext(orderId);

    const provider = this.resolveProvider(providerName);
    if (!provider) {
      throw new BadRequestException(
        'No active shipping provider configured. Add Shippo under Admin → Integrations → Shipping and ensure the API token is saved (shippo_live_… or shippo_test_…).',
      );
    }

    try {
      return await this.courierFactory.getRates(provider, { from, to, packages });
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(
        error?.message || 'Failed to fetch shipping rates from carrier',
      );
    }
  }

  async shipOrder(
    orderId: string,
    options: { provider?: string; serviceCode?: string; fromAddressId?: string },
  ): Promise<ShipmentResponse & { orderId: string }> {
    const { order, packages, from, to } = await this.buildShipmentContext(
      orderId,
      options.fromAddressId,
    );

    if (order.trackingCode?.trim()) {
      throw new BadRequestException('Order already has a tracking number');
    }

    if (order.status !== 'FULFILLED') {
      throw new BadRequestException(
        `Order must be in FULFILLED status to ship (current: ${order.status}). ` +
          'Move it through CONFIRMED → PROCESSING → FULFILLED first.',
      );
    }

    const providerName = this.resolveProvider(options.provider);
    if (!providerName) {
      throw new BadRequestException(
        'No active shipping provider configured. Add Shippo under Admin → Integrations → Shipping.',
      );
    }

    const fromWithContact = this.ensureShipFromContact(from, order);
    const toWithContact = {
      ...to,
      phone: to.phone || order.shippingAddress?.phone || undefined,
      email: to.email || undefined,
    };

    if (!fromWithContact.phone?.trim() || !fromWithContact.email?.trim()) {
      throw new BadRequestException(
        'Origin address needs both phone and email for carrier labels (USPS requirement). ' +
          'Set seller Ops Contact phone/email, or Shippo fromPhone/fromEmail under Admin → Integrations → Shipping.',
      );
    }

    let response;
    try {
      response = await this.courierFactory.createShipment(providerName, {
        orderId: order.id,
        from: fromWithContact,
        to: toWithContact,
        packages,
        serviceCode: options.serviceCode || '',
        reference1: order.orderNumber || order.id,
        labelFormat: 'PDF',
      });
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(error?.message || 'Failed to purchase shipping label');
    }

    const carrier =
      (response.metadata?.carrier as string | undefined) ||
      response.serviceName?.split(' ')[0] ||
      providerName;

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        trackingCode: response.trackingNumber,
        carrier,
        trackingUrl: response.trackingUrl || null,
        estimatedDeliveryAt: response.estimatedDeliveryDate || null,
        shippingCost: response.rate ?? null,
        shippingLabelUrl: response.labels?.[0]?.url || null,
        status: 'SHIPPED',
      },
    });

    if (response.rate && response.rate > 0) {
      try {
        await this.transactionsService.createTransaction({
          type: 'FEE',
          amount: response.rate,
          currency: response.currency || order.currency || PLATFORM_DEFAULT_CURRENCY,
          orderId: order.id,
          sellerId: order.sellerId || undefined,
          description: `Shipping label cost via ${providerName} (${response.serviceName})`,
          status: 'COMPLETED',
          metadata: {
            shipmentId: response.shipmentId,
            trackingNumber: response.trackingNumber,
            carrier,
            serviceCode: response.serviceCode,
            provider: providerName,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to record shipping cost transaction for order ${order.id}: ${(error as Error).message}`,
        );
      }

      if (order.sellerId) {
        try {
          await this.vendorLedgerService.recordShippingCost({
            sellerId: order.sellerId,
            orderId: order.id,
            amount: response.rate,
            currency: response.currency || order.currency || PLATFORM_DEFAULT_CURRENCY,
            description: `Shipping label cost via ${providerName} (${response.serviceName})`,
            metadata: {
              shipmentId: response.shipmentId,
              trackingNumber: response.trackingNumber,
              carrier,
              serviceCode: response.serviceCode,
              provider: providerName,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Failed to record vendor shipping cost for order ${order.id}: ${(error as Error).message}`,
          );
        }
      }
    }

    this.notificationsService
      ?.sendOrderShipped(order.id, response.trackingNumber, carrier)
      .catch((error) =>
        this.logger.warn(`Failed to send shipment notification: ${(error as Error).message}`),
      );

    this.logger.log(
      `Shipped order ${order.orderNumber || order.id} via ${providerName}: ${response.trackingNumber}`,
    );

    return { ...response, orderId: order.id };
  }

  async trackOrderShipment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { trackingCode: true, carrier: true },
    });

    if (!order?.trackingCode) {
      throw new NotFoundException('Order has no tracking number');
    }

    return this.trackByTrackingCode(order.trackingCode, order.carrier);
  }

  async trackOrderShipmentByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber: orderNumber.trim() },
      select: { id: true, trackingCode: true, carrier: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.trackingCode) {
      throw new NotFoundException('Order has no tracking number');
    }

    return this.trackByTrackingCode(order.trackingCode, order.carrier);
  }

  private async trackByTrackingCode(trackingCode: string, carrier?: string | null) {
    const shippoProvider = this.courierFactory.getProvider('shippo');
    if (shippoProvider) {
      return this.courierFactory.trackShipment(
        trackingCode,
        'shippo',
        this.normalizeCarrier(carrier),
      );
    }

    return this.courierFactory.trackShipment(trackingCode);
  }

  private normalizeCarrier(carrier?: string | null): string | undefined {
    if (!carrier) return undefined;
    return carrier.toLowerCase().replace(/\s+/g, '_');
  }

  private resolveProvider(preferred?: string): string | null {
    if (preferred) {
      if (!this.courierFactory.getProvider(preferred)) {
        throw new BadRequestException(
          `Shipping provider "${preferred}" is not configured or inactive. ` +
            `Active providers: ${this.courierFactory.getAvailableProviderNames().join(', ') || 'none'}`,
        );
      }
      return preferred;
    }

    if (this.courierFactory.getProvider('shippo')) return 'shippo';

    const defaultProvider = this.courierFactory.getDefaultProvider();
    return defaultProvider?.providerId || null;
  }

  private async buildShipmentContext(orderId: string, fromAddressId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shippingAddress: true,
        items: {
          include: {
            product: {
              select: {
                weight: true,
                length: true,
                width: true,
                height: true,
              },
            },
          },
        },
        seller: {
          select: {
            warehouseAddressId: true,
            storeName: true,
            opsContactName: true,
            opsContactEmail: true,
            opsContactPhone: true,
            user: { select: { email: true, phone: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.shippingAddress) {
      throw new BadRequestException('Order is missing a shipping address');
    }

    const to = this.addressFromRecord(order.shippingAddress);
    const from = await this.resolveFromAddress(order, fromAddressId);
    const packages = this.buildPackages(order.items);

    return { order, from, to, packages };
  }

  private addressFromRecord(addr: {
    firstName: string;
    lastName: string;
    street: string;
    addressLine2?: string | null;
    company?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
    phone?: string | null;
  }): Address {
    const { postalCode, state } = this.normalizePostalAndState(
      addr.postalCode,
      addr.state || undefined,
      addr.country,
    );
    return {
      name: `${addr.firstName} ${addr.lastName}`.trim(),
      company: addr.company || undefined,
      street1: addr.street,
      street2: addr.addressLine2 || undefined,
      city: addr.city,
      state,
      postalCode,
      country: addr.country,
      phone: addr.phone || undefined,
    };
  }

  /** Fix postalCode values like "NY 10036" that break USPS/Shippo ZIP validation. */
  private normalizePostalAndState(
    postalCode?: string | null,
    state?: string | null,
    _country?: string | null,
  ): { postalCode: string; state?: string } {
    const rawZip = String(postalCode || '').trim();
    let nextState = state?.trim() || undefined;

    const stateZip = rawZip.match(/^([A-Za-z]{2})[\s,.-]*(\d{5}(?:[-\s]?\d{4})?)$/);
    if (stateZip) {
      if (!nextState) nextState = stateZip[1].toUpperCase();
      return { postalCode: stateZip[2].replace(/\s+/g, '-'), state: nextState };
    }

    const zipOnly = rawZip.match(/\b(\d{5}(?:[-\s]?\d{4})?)\b/);
    if (zipOnly) {
      return { postalCode: zipOnly[1].replace(/\s+/g, '-'), state: nextState };
    }

    return { postalCode: rawZip, state: nextState };
  }

  private async resolveFromAddress(order: any, fromAddressId?: string): Promise<Address> {
    const addressId = fromAddressId || order.seller?.warehouseAddressId;
    if (addressId) {
      const warehouse = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (warehouse) {
        const base = this.addressFromRecord(warehouse);
        // Warehouse addresses often lack email; prefer ops/user contact for carriers
        return {
          ...base,
          name:
            order.seller?.opsContactName?.trim() ||
            base.name ||
            order.seller?.storeName ||
            'Shipper',
          phone:
            base.phone || order.seller?.opsContactPhone || order.seller?.user?.phone || undefined,
          email:
            base.email || order.seller?.opsContactEmail || order.seller?.user?.email || undefined,
        };
      }
    }

    const integrationFrom = await this.getShippoDefaultFromAddress();
    if (integrationFrom) return integrationFrom;

    const envFrom = this.getEnvFromAddress();
    if (envFrom) return envFrom;

    throw new BadRequestException(
      'No origin address configured. Set a seller warehouse address or configure Shippo fromAddress in integrations.',
    );
  }

  /** Ensure Shippo/USPS get phone + email on the from address. */
  private ensureShipFromContact(from: Address, order: any): Address {
    const envPhone = this.configService.get<string>('SHIPPO_FROM_PHONE')?.trim();
    const envEmail = this.configService.get<string>('SHIPPO_FROM_EMAIL')?.trim();
    return {
      ...from,
      phone:
        from.phone?.trim() ||
        order.seller?.opsContactPhone?.trim() ||
        order.seller?.user?.phone?.trim() ||
        envPhone ||
        undefined,
      email:
        from.email?.trim() ||
        order.seller?.opsContactEmail?.trim() ||
        order.seller?.user?.email?.trim() ||
        envEmail ||
        undefined,
    };
  }

  private async getShippoDefaultFromAddress(): Promise<Address | null> {
    try {
      const integration = await this.prisma.integrationConfig.findUnique({
        where: { category_provider: { category: 'SHIPPING', provider: 'shippo' } },
      });
      if (!integration?.isActive) return null;

      const credentials = this.encryptionService.decryptJson(integration.credentials);
      const from =
        credentials.fromAddress ||
        (credentials.fromStreet
          ? {
              name: credentials.fromName,
              street1: credentials.fromStreet,
              city: credentials.fromCity,
              state: credentials.fromState,
              postalCode: credentials.fromPostalCode,
              country: credentials.fromCountry,
              phone: credentials.fromPhone,
              email: credentials.fromEmail,
            }
          : null);
      if (!from?.street1 && !from?.street) return null;

      const { postalCode, state } = this.normalizePostalAndState(
        from.postalCode || from.zip,
        from.state,
        from.country,
      );
      return {
        name: from.name || 'House of Spells',
        company: from.company,
        street1: from.street1 || from.street,
        street2: from.street2 || from.addressLine2,
        city: from.city,
        state,
        postalCode,
        country: from.country,
        phone: from.phone,
        email: from.email,
      };
    } catch {
      return null;
    }
  }

  private getEnvFromAddress(): Address | null {
    const street1 = this.configService.get<string>('SHIPPO_FROM_STREET');
    const city = this.configService.get<string>('SHIPPO_FROM_CITY');
    const postalCode = this.configService.get<string>('SHIPPO_FROM_POSTAL_CODE');
    const country = this.configService.get<string>('SHIPPO_FROM_COUNTRY');

    if (!street1 || !city || !postalCode || !country) return null;

    return {
      name: this.configService.get<string>('SHIPPO_FROM_NAME') || 'House of Spells',
      company: this.configService.get<string>('SHIPPO_FROM_COMPANY') || undefined,
      street1,
      street2: this.configService.get<string>('SHIPPO_FROM_STREET2') || undefined,
      city,
      state: this.configService.get<string>('SHIPPO_FROM_STATE') || undefined,
      postalCode,
      country,
      phone: this.configService.get<string>('SHIPPO_FROM_PHONE') || undefined,
      email: this.configService.get<string>('SHIPPO_FROM_EMAIL') || undefined,
    };
  }

  private buildPackages(items: any[]): PackageDimensions[] {
    if (!items.length) {
      return [DEFAULT_PACKAGE];
    }

    const safeDim = (value: unknown, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    const packages: PackageDimensions[] = items.map((item) => {
      const product = item.product;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitWeight = product?.weight != null ? safeDim(product.weight, 0.5) : 0.5;

      return {
        length:
          product?.length != null
            ? safeDim(product.length, DEFAULT_PACKAGE.length)
            : DEFAULT_PACKAGE.length,
        width:
          product?.width != null
            ? safeDim(product.width, DEFAULT_PACKAGE.width)
            : DEFAULT_PACKAGE.width,
        height:
          product?.height != null
            ? safeDim(product.height, DEFAULT_PACKAGE.height)
            : DEFAULT_PACKAGE.height,
        weight: Math.max(0.01, unitWeight * qty),
      };
    });

    if (packages.length === 1) return packages;

    return [
      {
        length: Math.max(...packages.map((p) => p.length)),
        width: Math.max(...packages.map((p) => p.width)),
        height: Math.max(
          packages.reduce((sum, p) => sum + p.height, 0),
          DEFAULT_PACKAGE.height,
        ),
        weight: packages.reduce((sum, p) => sum + p.weight, 0),
      },
    ];
  }
}

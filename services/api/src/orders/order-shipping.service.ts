import {
  BadRequestException,
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
    @Optional() @Inject(NotificationsService) private readonly notificationsService?: NotificationsService,
  ) {}

  async getOrderShippingRates(
    orderId: string,
    providerName?: string,
  ): Promise<RateResponse[]> {
    const { packages, from, to } = await this.buildShipmentContext(orderId);

    const provider = this.resolveProvider(providerName);
    if (provider) {
      return this.courierFactory.getRates(provider, { from, to, packages });
    }

    return this.courierFactory.getAllRates({ from, to, packages });
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

    const response = await this.courierFactory.createShipment(providerName, {
      orderId: order.id,
      from,
      to,
      packages,
      serviceCode: options.serviceCode || '',
      reference1: order.orderNumber || order.id,
      labelFormat: 'PDF',
    });

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
        status: 'SHIPPED',
      },
    });

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

    const shippoProvider = this.courierFactory.getProvider('shippo');
    if (shippoProvider) {
      return this.courierFactory.trackShipment(
        order.trackingCode,
        'shippo',
        this.normalizeCarrier(order.carrier),
      );
    }

    return this.courierFactory.trackShipment(order.trackingCode);
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
    return {
      name: `${addr.firstName} ${addr.lastName}`.trim(),
      company: addr.company || undefined,
      street1: addr.street,
      street2: addr.addressLine2 || undefined,
      city: addr.city,
      state: addr.state || undefined,
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone || undefined,
    };
  }

  private async resolveFromAddress(order: any, fromAddressId?: string): Promise<Address> {
    const addressId = fromAddressId || order.seller?.warehouseAddressId;
    if (addressId) {
      const warehouse = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (warehouse) {
        return this.addressFromRecord(warehouse);
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

      return {
        name: from.name || 'House of Spells',
        company: from.company,
        street1: from.street1 || from.street,
        street2: from.street2 || from.addressLine2,
        city: from.city,
        state: from.state,
        postalCode: from.postalCode || from.zip,
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

    const packages: PackageDimensions[] = items.map((item) => {
      const product = item.product;
      const qty = Math.max(1, item.quantity || 1);
      const unitWeight = product?.weight ? Number(product.weight) : 0.5;

      return {
        length: product?.length ? Number(product.length) : DEFAULT_PACKAGE.length,
        width: product?.width ? Number(product.width) : DEFAULT_PACKAGE.width,
        height: product?.height ? Number(product.height) : DEFAULT_PACKAGE.height,
        weight: Math.max(0.01, unitWeight * qty),
      };
    });

    if (packages.length === 1) return packages;

    return [
      {
        length: Math.max(...packages.map((p) => p.length)),
        width: Math.max(...packages.map((p) => p.width)),
        height: Math.max(packages.reduce((sum, p) => sum + p.height, 0), DEFAULT_PACKAGE.height),
        weight: packages.reduce((sum, p) => sum + p.weight, 0),
      },
    ];
  }
}

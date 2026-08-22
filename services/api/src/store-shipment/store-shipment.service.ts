import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import { POSAdapterFactory } from '../pos/pos-adapter.factory';
import type { POSAdapter } from '../pos/interfaces/pos-adapter.interface';
import { SkuCustomsService } from './sku-customs.service';
import { CourierFactoryService } from '../shipping/courier/courier-factory.service';
import type {
  CustomsInfo,
  PackageDimensions,
  RateResponse,
} from '../shipping/courier/interfaces/courier-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentProviderService } from '../payments/payment-provider.service';

const CLAIM_TTL_DAYS = 14;

@Injectable()
export class StoreShipmentService {
  private readonly logger = new Logger(StoreShipmentService.name);

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
    private skuCustoms: SkuCustomsService,
    private courierFactory: CourierFactoryService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private paymentProvider: PaymentProviderService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildClaimUrl(token: string): string {
    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/ship/claim/${token}`;
  }

  /** B1 step 2–3: staff captures consent and sends claim link. */
  async createClaimFromTill(params: {
    storeId: string;
    invoiceNumber: string;
    email: string;
    shippingConsent: boolean;
    staffUserId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!params.shippingConsent) {
      throw new BadRequestException('Shipping consent is required');
    }
    const email = params.email.trim().toLowerCase();
    if (!email.includes('@')) throw new BadRequestException('Valid email required');

    const store = await this.prisma.store.findUnique({ where: { id: params.storeId } });
    if (!store?.isActive) throw new NotFoundException('Store not found');

    await this.prisma.gDPRConsentLog.create({
      data: {
        email,
        consentType: 'SHIPPING',
        consentSource: 'POS_TILL',
        granted: true,
        grantedAt: new Date(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    const token = randomBytes(32).toString('hex');
    const claimTokenHash = this.hashToken(token);
    const claimTokenExpiresAt = new Date(Date.now() + CLAIM_TTL_DAYS * 24 * 60 * 60 * 1000);

    const shipment = await this.prisma.storeShipmentRequest.create({
      data: {
        storeId: params.storeId,
        invoiceNumber: params.invoiceNumber.trim(),
        claimEmail: email,
        claimTokenHash,
        claimTokenExpiresAt,
        status: 'DRAFT',
        metadata: { createdByStaff: params.staffUserId ?? null } as object,
      },
    });

    const claimUrl = this.buildClaimUrl(token);
    this.logger.log(`Store shipment claim link for ${email}: ${claimUrl}`);

    let emailQueued = false;
    try {
      await this.notifications.sendStoreShipmentClaimEmail({
        email,
        claimUrl,
        invoiceNumber: params.invoiceNumber.trim(),
        storeName: store.name,
        expiresAt: claimTokenExpiresAt,
      });
      emailQueued = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to queue store shipment claim email for ${email}: ${message}`);
    }

    return { shipmentId: shipment.id, claimUrl, expiresAt: claimTokenExpiresAt, emailQueued };
  }

  private async resolveClaim(token: string) {
    const hash = this.hashToken(token.trim());
    const row = await this.prisma.storeShipmentRequest.findUnique({
      where: { claimTokenHash: hash },
      include: { store: { include: { posConnection: true } } },
    });
    if (!row) throw new NotFoundException('Claim link not found');
    if (row.claimTokenExpiresAt && row.claimTokenExpiresAt < new Date()) {
      throw new ForbiddenException('Claim link has expired');
    }
    return row;
  }

  /** Public claim page bootstrap. */
  async getClaimContext(token: string) {
    const row = await this.resolveClaim(token);
    return {
      shipmentId: row.id,
      invoiceNumber: row.invoiceNumber,
      email: row.claimEmail,
      status: row.status,
      storeName: row.store.name,
    };
  }

  /** Verify email matches claim and attach user after registration/login. */
  async attachUserToClaim(token: string, userId: string, userEmail: string) {
    const row = await this.resolveClaim(token);
    const email = userEmail.trim().toLowerCase();
    if (row.claimEmail && row.claimEmail !== email) {
      throw new ForbiddenException('Email does not match this shipping claim');
    }

    await this.prisma.storeShipmentRequest.update({
      where: { id: row.id },
      data: { userId, claimEmail: email },
    });

    await this.prisma.gDPRConsentLog.updateMany({
      where: { email, userId: null, consentType: 'SHIPPING' },
      data: { userId },
    });

    return this.resolveSaleForShipment(row.id);
  }

  private async buildAdapter(storeId: string): Promise<POSAdapter | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { posConnection: true },
    });
    if (!store?.posConnection?.isActive || !store.posConnection.credentials) return null;
    const creds = this.encryption.decryptJson<Record<string, unknown>>(
      store.posConnection.credentials,
    );
    const adapter = this.factory.create(store.posConnection.provider, store.posConnection.credentials);
    await adapter.authenticate(creds);
    return adapter;
  }

  /** B1 step 5–8: resolve POS sale and customs enrichment. */
  async resolveSaleForShipment(shipmentId: string, userId?: string) {
    const shipment = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: { store: { include: { posConnection: true } }, posSale: { include: { items: true } } },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (userId && shipment.userId && shipment.userId !== userId) {
      throw new ForbiddenException('Not your shipment');
    }

    if (shipment.posSaleId && shipment.posSale) {
      return this.enrichShipment(shipment.id, shipment.posSale.items);
    }

    const invoice = shipment.invoiceNumber?.trim();
    if (!invoice) throw new BadRequestException('Invoice number missing');

    let posSale = await this.prisma.pOSSale.findFirst({
      where: {
        storeId: shipment.storeId,
        OR: [{ externalInvoice: invoice }, { externalSaleId: invoice }],
      },
      include: { items: true },
    });

    if (!posSale) {
      const adapter = await this.buildAdapter(shipment.storeId);
      if (adapter?.getSaleByInvoice) {
        const outletId = shipment.store.posConnection?.externalOutletId ?? undefined;
        const remote = await adapter.getSaleByInvoice({ invoiceNumber: invoice, outletId });
        if (remote) {
          posSale = await this.prisma.pOSSale.findFirst({
            where: {
              provider: adapter.providerName,
              externalSaleId: remote.externalId,
            },
            include: { items: true },
          });
        }
      }
    }

    if (!posSale) {
      await this.prisma.storeShipmentRequest.update({
        where: { id: shipment.id },
        data: { status: 'DRAFT', metadata: { saleLookup: 'queued' } as object },
      });
      throw new BadRequestException(
        'We are confirming your purchase with the store. Please try again shortly.',
      );
    }

    if (posSale.status === 'VOIDED') {
      await this.prisma.storeShipmentRequest.update({
        where: { id: shipment.id },
        data: { status: 'BLOCKED' },
      });
      throw new BadRequestException('This purchase was refunded and cannot be shipped');
    }

    await this.prisma.storeShipmentRequest.update({
      where: { id: shipment.id },
      data: {
        posSaleId: posSale.id,
        posExternalSaleId: posSale.externalSaleId,
      },
    });

    return this.enrichShipment(shipment.id, posSale.items);
  }

  private async enrichShipment(
    shipmentId: string,
    items: Array<{ sku: string | null; productId: string | null; name: string; quantity: number }>,
  ) {
    const { allReady, anyBlocked, results } = await this.skuCustoms.enrichSaleItems(items);

    const status = anyBlocked ? 'BLOCKED' : allReady ? 'DRAFT' : 'PENDING_ENRICHMENT';
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: { status, metadata: { enrichment: results } as object },
    });

    return { shipmentId, status, enrichment: results, allReady };
  }

  async setDestinationAddress(shipmentId: string, userId: string, addressId: string) {
    const shipment = await this.prisma.storeShipmentRequest.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.userId && shipment.userId !== userId) {
      throw new ForbiddenException('Not your shipment');
    }

    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');

    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: { destinationAddressId: addressId, userId },
    });
    return { ok: true };
  }

  async getShippingRates(shipmentId: string, userId: string): Promise<RateResponse[]> {
    const shipment = await this.loadShipmentForQuote(shipmentId, userId);
    const { from, to, packages, customsInfo } = await this.buildRateContext(shipment);

    const defaultProv = this.courierFactory.getDefaultProvider();
    if (!defaultProv) throw new BadRequestException('No shipping provider configured');

    const rates = await this.courierFactory.getRates(defaultProv.providerId, {
      from,
      to,
      packages,
    });
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: { status: 'QUOTED', metadata: { rateCount: rates.length } as object },
    });
    return rates;
  }

  private async loadShipmentForQuote(shipmentId: string, userId: string) {
    const shipment = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: {
        store: true,
        destinationAddress: true,
        posSale: { include: { items: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.userId && shipment.userId !== userId) {
      throw new ForbiddenException('Not your shipment');
    }
    if (!shipment.destinationAddress) {
      throw new BadRequestException('Destination address required');
    }
    if (shipment.status === 'BLOCKED' || shipment.status === 'CANCELLED') {
      throw new BadRequestException(`Shipment is ${shipment.status}`);
    }
    return shipment;
  }

  private async buildRateContext(shipment: {
    store: {
      address?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      countryCode?: string | null;
    };
    destinationAddress: {
      street: string;
      addressLine2?: string | null;
      city: string;
      state?: string | null;
      postalCode: string;
      country: string;
      countryCode?: string | null;
    } | null;
    posSale?: {
      items: Array<{
        sku: string | null;
        productId: string | null;
        name: string;
        quantity: number;
        unitPrice: Decimal | number;
      }>;
    } | null;
  }) {
    if (!shipment.destinationAddress) throw new BadRequestException('Address required');

    const from = {
      name: 'House of Spells',
      street1: shipment.store.address || 'Store',
      city: shipment.store.city || 'New York',
      state: shipment.store.state || 'NY',
      postalCode: shipment.store.postalCode || '10001',
      country: shipment.store.countryCode || shipment.store.country || 'US',
    };

    const to = {
      name: 'Customer',
      street1: shipment.destinationAddress.street,
      street2: shipment.destinationAddress.addressLine2 || undefined,
      city: shipment.destinationAddress.city,
      state: shipment.destinationAddress.state || undefined,
      postalCode: shipment.destinationAddress.postalCode,
      country: shipment.destinationAddress.countryCode || shipment.destinationAddress.country,
    };

    const packages: PackageDimensions[] = [];
    const customsItems = [];
    let blocked = false;
    const destCountry = to.country.trim().toUpperCase();

    for (const item of shipment.posSale?.items ?? []) {
      const sku = await this.skuCustoms.resolveLineSku(item);
      if (!sku) {
        blocked = true;
        continue;
      }
      const attr = await this.skuCustoms.getOrCreateForSku(sku, item.productId);
      if (this.skuCustoms.isRestrictedForDestination(attr, destCountry)) {
        throw new BadRequestException(
          `SKU ${sku} cannot be shipped to ${destCountry}. Choose another destination or contact the store.`,
        );
      }
      if (attr.status === 'BLOCKED' || attr.status === 'PENDING') {
        blocked = true;
        continue;
      }
      const weight = Number(attr.weightKg ?? 0.5);
      packages.push({
        weight,
        length: Number(attr.lengthCm ?? 30),
        width: Number(attr.widthCm ?? 20),
        height: Number(attr.heightCm ?? 10),
      });
      customsItems.push({
        description: item.name.slice(0, 60),
        quantity: item.quantity,
        value: Number(item.unitPrice),
        weight,
        hsCode: attr.hsCode ?? undefined,
        countryOfOrigin: attr.countryOfOrigin ?? 'US',
      });
    }

    if (blocked && packages.length === 0) {
      throw new BadRequestException('Items are not ready for international shipping');
    }
    if (packages.length === 0) {
      packages.push({ weight: 1, length: 30, width: 20, height: 10 });
    }

    const customsInfo: CustomsInfo | undefined =
      from.country !== to.country
        ? {
            contentsType: 'MERCHANDISE',
            nonDeliveryOption: 'RETURN',
            items: customsItems.map((i) => ({ ...i, currency: 'USD' })),
            totalValue: customsItems.reduce((s, i) => s + i.value * i.quantity, 0),
            currency: 'USD',
          }
        : undefined;

    return { from, to, packages, customsInfo };
  }

  async authorizeShipping(
    shipmentId: string,
    userId: string,
    params: { carrier: string; service: string; amount: number; currency?: string },
  ) {
    const shipment = await this.loadShipmentForQuote(shipmentId, userId);

    if (shipment.status === 'LABEL_PURCHASED') {
      throw new BadRequestException('Label already purchased — cannot re-authorize');
    }

    await this.paymentProvider.ensureAvailableProviders();
    if (!this.paymentProvider.isProviderAvailable('stripe')) {
      throw new BadRequestException('Payment provider unavailable');
    }

    const provider = this.paymentProvider.getProvider('stripe');

    if (shipment.stripePaymentIntentId && provider.cancelPaymentIntent) {
      try {
        await provider.cancelPaymentIntent(shipment.stripePaymentIntentId);
      } catch (cancelErr) {
        this.logger.warn(
          `Failed to cancel previous PaymentIntent ${shipment.stripePaymentIntentId}: ${(cancelErr as Error).message}`,
        );
      }
    }

    const intent = await provider.createPaymentIntent({
      amount: params.amount,
      currency: params.currency || shipment.currency,
      orderId: shipmentId,
      metadata: {
        type: 'store_shipment',
        shipmentId,
        carrier: params.carrier,
        service: params.service,
      },
    });

    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: {
        shippingAmount: new Decimal(params.amount.toFixed(2)),
        selectedCarrier: params.carrier,
        selectedService: params.service,
        stripePaymentIntentId: intent.paymentIntentId,
        status: 'QUOTED',
      },
    });

    return { clientSecret: intent.clientSecret, paymentIntentId: intent.paymentIntentId };
  }

  async purchaseLabel(shipmentId: string, userId: string) {
    const shipment = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: {
        store: { include: { posConnection: true } },
        destinationAddress: true,
        posSale: { include: { items: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.userId !== userId) throw new ForbiddenException('Not your shipment');
    if (shipment.status === 'LABEL_PURCHASED') {
      return {
        trackingCode: shipment.trackingCode,
        labelUrl: shipment.labelUrl,
        status: 'LABEL_PURCHASED',
      };
    }
    if (!shipment.stripePaymentIntentId) {
      throw new BadRequestException('Shipping payment not authorized');
    }

    const stripe = this.paymentProvider.getProvider('stripe');
    const paymentStatus = await stripe.getPaymentStatus(shipment.stripePaymentIntentId);
    if (paymentStatus !== ('succeeded' as any)) {
      throw new BadRequestException(
        `Shipping payment has not succeeded (status: ${paymentStatus}). Complete payment before purchasing a label.`,
      );
    }

    if (shipment.posSale?.status === 'VOIDED') {
      await this.prisma.storeShipmentRequest.update({
        where: { id: shipmentId },
        data: { status: 'CANCELLED' },
      });
      throw new BadRequestException('Store sale was refunded — shipping cancelled');
    }

    const { from, to, packages, customsInfo } = await this.buildRateContext({
      store: shipment.store,
      destinationAddress: shipment.destinationAddress,
      posSale: shipment.posSale,
    });

    const providerName =
      shipment.selectedCarrier ||
      this.courierFactory.getDefaultProvider()?.providerId ||
      '';
    if (!providerName) throw new BadRequestException('No carrier selected');

    const label = await this.courierFactory.createShipment(providerName, {
      orderId: shipmentId,
      from,
      to,
      packages,
      serviceCode: shipment.selectedService || 'standard',
      customsInfo,
      reference1: shipment.invoiceNumber || shipment.id,
    });

    const labelUrl = label.labels?.[0]?.url ?? label.trackingUrl;

    const snapshot = {
      capturedAt: new Date().toISOString(),
      customsInfo,
      invoiceNumber: shipment.invoiceNumber,
      posSaleId: shipment.posSaleId,
    };

    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: {
        status: 'LABEL_PURCHASED',
        trackingCode: label.trackingNumber,
        labelUrl,
        shippingCost: shipment.shippingAmount,
        customsSnapshot: snapshot as object,
        metadata: { provider: providerName } as object,
      },
    });

    if (shipment.claimEmail) {
      this.logger.log(
        `Label purchased for shipment ${shipmentId}: ${label.trackingNumber} → ${shipment.claimEmail}`,
      );
    }

    return {
      trackingCode: label.trackingNumber,
      labelUrl,
      status: 'LABEL_PURCHASED',
    };
  }

  async listAdmin(status?: string, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.storeShipmentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { store: { select: { name: true, code: true } }, user: { select: { email: true } } },
      }),
      this.prisma.storeShipmentRequest.count({ where }),
    ]);
    return { items, pagination: { page, limit, total } };
  }
}

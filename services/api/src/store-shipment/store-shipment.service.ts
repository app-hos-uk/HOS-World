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
import { PosSalesImportService, posSaleItemsNeedRefresh } from '../pos/sync/sales-import.service';
import {
  isClosedSale,
  isVoidedSale,
} from '../pos/adapters/lightspeed/lightspeed.mapper';
import type { POSSale } from '../pos/interfaces/pos-types';
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
const LIGHTSPEED_LOOKUP_BUDGET_MS = 20_000;
const DEFAULT_PARCEL = { weight: 0.5, length: 30, width: 20, height: 10 };
const IN_FLIGHT_SHIPMENT_STATUSES = [
  'QUOTED',
  'PAID',
  'LABEL_PURCHASED',
  'IN_TRANSIT',
  'DELIVERED',
] as const;
const RESENDABLE_SHIPMENT_STATUSES = ['DRAFT', 'PENDING_ENRICHMENT'] as const;

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
    private salesImport: PosSalesImportService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildClaimUrl(token: string): string {
    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/ship/claim/${token}`;
  }

  /** B1 step 2–3: confirm the till invoice, then capture consent and send the claim link. */
  async createClaimFromTill(params: {
    storeId?: string;
    assignedStoreId?: string | null;
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

    const invoice = params.invoiceNumber.trim();
    if (!invoice) throw new BadRequestException('Invoice number is required');

    const storeId = params.assignedStoreId || params.storeId?.trim();
    if (!storeId) throw new BadRequestException('Store is required');
    if (params.assignedStoreId && params.storeId?.trim() && params.storeId.trim() !== params.assignedStoreId) {
      throw new ForbiddenException('You can only create shipping claims for your assigned store');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { posConnection: true },
    });
    if (!store?.isActive) throw new NotFoundException('Store not found');

    const confirmed = await this.confirmTillInvoice({
      storeId,
      invoiceNumber: invoice,
      store,
    });

    const existing = await this.prisma.storeShipmentRequest.findFirst({
      where: {
        storeId,
        OR: [
          { posExternalSaleId: confirmed.externalId },
          { invoiceNumber: { equals: confirmed.invoiceNumber, mode: 'insensitive' } },
          { invoiceNumber: { equals: invoice, mode: 'insensitive' } },
        ],
        status: { notIn: ['CANCELLED', 'BLOCKED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing && IN_FLIGHT_SHIPMENT_STATUSES.includes(existing.status as (typeof IN_FLIGHT_SHIPMENT_STATUSES)[number])) {
      throw new BadRequestException(
        'A shipping claim for this invoice is already in progress. Do not send another link.',
      );
    }
    if (existing && existing.userId) {
      throw new BadRequestException(
        'A shipping claim for this invoice is already in progress for this customer.',
      );
    }
    if (
      existing &&
      RESENDABLE_SHIPMENT_STATUSES.includes(existing.status as (typeof RESENDABLE_SHIPMENT_STATUSES)[number]) &&
      existing.claimEmail &&
      existing.claimEmail !== email
    ) {
      throw new BadRequestException(
        'This invoice already has a shipping claim for a different email.',
      );
    }

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
    const metadata = {
      createdByStaff: params.staffUserId ?? null,
      invoiceValidatedAt: new Date().toISOString(),
      lightspeedSaleId: confirmed.externalId,
    } as object;

    const shipment =
      existing &&
      RESENDABLE_SHIPMENT_STATUSES.includes(existing.status as (typeof RESENDABLE_SHIPMENT_STATUSES)[number])
        ? await this.prisma.storeShipmentRequest.update({
            where: { id: existing.id },
            data: {
              claimEmail: email,
              claimTokenHash,
              claimTokenExpiresAt,
              invoiceNumber: confirmed.invoiceNumber,
              posSaleId: confirmed.localSaleId ?? existing.posSaleId,
              posExternalSaleId: confirmed.externalId,
              metadata,
            },
          })
        : await this.prisma.storeShipmentRequest.create({
            data: {
              storeId,
              invoiceNumber: confirmed.invoiceNumber,
              claimEmail: email,
              claimTokenHash,
              claimTokenExpiresAt,
              status: 'DRAFT',
              posSaleId: confirmed.localSaleId,
              posExternalSaleId: confirmed.externalId,
              metadata,
            },
          });

    const claimUrl = this.buildClaimUrl(token);
    this.logger.log(`Store shipment claim link for ${email}: ${claimUrl}`);

    let emailQueued = false;
    try {
      await this.notifications.sendStoreShipmentClaimEmail({
        email,
        claimUrl,
        invoiceNumber: confirmed.invoiceNumber,
        storeName: store.name,
        expiresAt: claimTokenExpiresAt,
      });
      emailQueued = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to queue store shipment claim email for ${email}: ${message}`);
    }

    return {
      shipmentId: shipment.id,
      claimUrl,
      expiresAt: claimTokenExpiresAt,
      emailQueued,
      resent: Boolean(existing),
      confirmedInvoice: {
        number: confirmed.invoiceNumber,
        totalAmount: confirmed.totalAmount,
        currency: confirmed.currency,
        saleDate: confirmed.saleDate,
      },
    };
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

  private adapterFromStore(
    store: {
      posConnection?: {
        isActive: boolean;
        credentials: string | null;
        provider: string;
        externalOutletId?: string | null;
      } | null;
    },
    deadlineAt?: number,
  ): POSAdapter | null {
    if (!store.posConnection?.isActive || !store.posConnection.credentials) return null;
    const creds = this.encryption.decryptJson<Record<string, unknown>>(
      store.posConnection.credentials,
    );
    const adapter = this.factory.create(store.posConnection.provider, store.posConnection.credentials);
    adapter.setRequestDeadline?.(deadlineAt);
    return adapter;
  }

  private async buildAdapter(storeId: string, deadlineAt?: number): Promise<POSAdapter | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { posConnection: true },
    });
    if (!store) return null;
    const adapter = this.adapterFromStore(store, deadlineAt);
    if (!adapter) return null;
    const creds = this.encryption.decryptJson<Record<string, unknown>>(
      store.posConnection!.credentials,
    );
    await adapter.authenticate(creds);
    return adapter;
  }

  /**
   * Confirm the till invoice exists and is a completed Lightspeed sale.
   * Does not import line items — product details wait until the customer continues.
   */
  private async confirmTillInvoice(params: {
    storeId: string;
    invoiceNumber: string;
    store: {
      externalStoreId?: string | null;
      posConnection?: {
        isActive: boolean;
        credentials: string | null;
        provider: string;
        externalOutletId?: string | null;
      } | null;
    };
  }): Promise<{
    externalId: string;
    invoiceNumber: string;
    totalAmount: number;
    currency: string;
    saleDate: Date;
    localSaleId?: string;
  }> {
    const invoice = params.invoiceNumber;
    const local = await this.prisma.pOSSale.findFirst({
      where: {
        storeId: params.storeId,
        OR: [
          { externalInvoice: { equals: invoice, mode: 'insensitive' } },
          { externalSaleId: invoice },
        ],
      },
    });

    let remote: POSSale | null = null;
    let lightspeedError: Error | null = null;
    const adapter = this.adapterFromStore(params.store, Date.now() + LIGHTSPEED_LOOKUP_BUDGET_MS);
    if (adapter) {
      try {
        const creds = this.encryption.decryptJson<Record<string, unknown>>(
          params.store.posConnection!.credentials as string,
        );
        await adapter.authenticate(creds);
        const outletId =
          params.store.posConnection?.externalOutletId || params.store.externalStoreId || undefined;
        if (adapter.getSaleByInvoice) {
          remote = await adapter.getSaleByInvoice({
            invoiceNumber: invoice,
            outletId,
            hydrateProducts: false,
          });
        }
      } catch (e) {
        lightspeedError = e as Error;
        this.logger.warn(`Invoice validation Lightspeed lookup failed: ${lightspeedError.message}`);
      }
    } else if (!local) {
      throw new BadRequestException(
        'This store is not connected to Lightspeed, so the invoice cannot be confirmed.',
      );
    }

    if (remote && isVoidedSale(remote)) {
      throw new BadRequestException('This sale was refunded or voided and cannot be shipped.');
    }
    if (remote && !isClosedSale(remote)) {
      throw new BadRequestException(
        'This till sale is not completed in Lightspeed yet. Finish the sale, then send the claim link.',
      );
    }
    if (local?.status === 'VOIDED' && !remote) {
      throw new BadRequestException('This sale was refunded or voided and cannot be shipped.');
    }

    if (remote) {
      return {
        externalId: remote.externalId,
        invoiceNumber: (remote.invoiceNumber || invoice).trim(),
        totalAmount: remote.totalAmount,
        currency: remote.currency,
        saleDate: remote.saleDate,
        localSaleId: local?.externalSaleId === remote.externalId ? local.id : undefined,
      };
    }

    if (local) {
      return {
        externalId: local.externalSaleId,
        invoiceNumber: (local.externalInvoice || invoice).trim(),
        totalAmount: Number(local.totalAmount),
        currency: local.currency,
        saleDate: local.saleDate,
        localSaleId: local.id,
      };
    }

    if (lightspeedError) {
      throw new BadRequestException(
        'Could not confirm this invoice with Lightspeed. Check the connection and try again.',
      );
    }
    throw new BadRequestException(
      `No Lightspeed sale found for invoice "${invoice}". Check the invoice or receipt number.`,
    );
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

    const invoice = shipment.invoiceNumber?.trim();
    if (!invoice) throw new BadRequestException('Invoice number missing');

    let posSale = shipment.posSale;
    if (!posSale) {
      posSale = await this.prisma.pOSSale.findFirst({
        where: {
          storeId: shipment.storeId,
          OR: [
            { externalInvoice: { equals: invoice, mode: 'insensitive' } },
            { externalSaleId: invoice },
          ],
        },
        include: { items: true },
      });
    }

    if (!posSale || posSaleItemsNeedRefresh(posSale.items)) {
      try {
        const adapter = await this.buildAdapter(
          shipment.storeId,
          Date.now() + LIGHTSPEED_LOOKUP_BUDGET_MS,
        );
        const outletId =
          shipment.store.posConnection?.externalOutletId ||
          shipment.store.externalStoreId ||
          undefined;
        let remote: POSSale | null = null;
        if (shipment.posExternalSaleId && adapter?.getSaleById) {
          remote = await adapter.getSaleById(shipment.posExternalSaleId);
        }
        if (!remote && adapter?.getSaleByInvoice) {
          remote = await adapter.getSaleByInvoice({ invoiceNumber: invoice, outletId });
        }
        if (remote) {
          const provider = shipment.store.posConnection?.provider || adapter!.providerName;
          const imported = await this.salesImport.importParsedSale(
            shipment.storeId,
            provider,
            remote,
            { refreshItems: true },
          );
          if (imported.skipped && !imported.id) {
            throw new BadRequestException(
              'This till sale is not completed in Lightspeed yet. Finish the sale, then refresh this page.',
            );
          }
          if (imported.id) {
            posSale = await this.prisma.pOSSale.findUnique({
              where: { id: imported.id },
              include: { items: true },
            });
          }
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        this.logger.warn(`Lightspeed sale lookup failed: ${(e as Error).message}`);
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
    items: Array<{
      sku: string | null;
      productId: string | null;
      name: string;
      quantity: number;
      externalProductId?: string | null;
    }>,
  ) {
    const { anyBlocked, results } = await this.skuCustoms.enrichSaleItems(items);

    // Quote with default parcel sizes when HS/dimensions are still pending. Only
    // block restricted SKUs, or wait when Lightspeed has not given us any lines.
    const canQuote = items.length > 0 && !anyBlocked;
    const status = anyBlocked ? 'BLOCKED' : canQuote ? 'DRAFT' : 'PENDING_ENRICHMENT';
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: { status, metadata: { enrichment: results } as object },
    });

    return { shipmentId, status, enrichment: results, allReady: canQuote };
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
        externalProductId?: string | null;
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
        packages.push({ ...DEFAULT_PARCEL });
        continue;
      }
      const attr = await this.skuCustoms.getOrCreateForSku(sku, item.productId);
      if (this.skuCustoms.isRestrictedForDestination(attr, destCountry)) {
        throw new BadRequestException(
          `SKU ${sku} cannot be shipped to ${destCountry}. Choose another destination or contact the store.`,
        );
      }
      if (attr.status === 'BLOCKED') {
        blocked = true;
        continue;
      }
      const weight = Number(attr.weightKg ?? DEFAULT_PARCEL.weight);
      packages.push({
        weight,
        length: Number(attr.lengthCm ?? DEFAULT_PARCEL.length),
        width: Number(attr.widthCm ?? DEFAULT_PARCEL.width),
        height: Number(attr.heightCm ?? DEFAULT_PARCEL.height),
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
      packages.push({ ...DEFAULT_PARCEL, weight: 1 });
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

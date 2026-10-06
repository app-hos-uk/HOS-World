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
  invoicesEquivalent,
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
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';

const CLAIM_TTL_DAYS = 14;
const LIGHTSPEED_LOOKUP_BUDGET_MS = 20_000;
const DEFAULT_PARCEL = { weight: 0.5, length: 30, width: 20, height: 10 };
const IN_FLIGHT_SHIPMENT_STATUSES = [
  'QUOTED',
  'AWAITING_PAYMENT',
  'PAID',
  'SENT_TO_LOGISTICS',
  'PACKING',
  'PACKED',
  'LABEL_CREATED',
  'READY_FOR_PICKUP',
  'HANDED_TO_CARRIER',
  'LABEL_PURCHASED',
  'IN_TRANSIT',
  'DELIVERED',
] as const;
const RESENDABLE_SHIPMENT_STATUSES = [
  'DRAFT',
  'NEW',
  'PENDING_ENRICHMENT',
  'CUSTOMER_DETAILS_REQUIRED',
] as const;

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
    private featureFlags: FeatureFlagsService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildClaimUrl(token: string): string {
    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/ship/claim/${token}`;
  }

  private buildLookupUrl(storeId: string): string {
    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/ship/lookup?store=${storeId}`;
  }

  private async generateHosOrderNumber(storeCode: string): Promise<string> {
    const code = (storeCode || 'HOS').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'HOS';
    const now = new Date();
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(now.getUTCFullYear()).slice(-2);
    const prefix = `HOS-${code}-${dd}${mm}${yy}-`;
    const count = await this.prisma.storeShipmentRequest.count({
      where: { hosOrderNumber: { startsWith: prefix } },
    });
    let seq = count + 1;
    for (let i = 0; i < 25; i++) {
      const candidate = `${prefix}${String(seq).padStart(4, '0')}`;
      const exists = await this.prisma.storeShipmentRequest.findUnique({
        where: { hosOrderNumber: candidate },
      });
      if (!exists) return candidate;
      seq += 1;
    }
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  /** B1 step 2–3: confirm the till invoice, then capture consent and send the claim link. */
  async createClaimFromTill(params: {
    storeId?: string;
    assignedStoreId?: string | null;
    invoiceNumber: string;
    email?: string;
    shippingConsent: boolean;
    staffUserId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!params.shippingConsent) {
      throw new BadRequestException('Shipping consent is required');
    }
    const enteredEmail = this.normalizeEmail(params.email);

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
    if (
      this.featureFlags.isEnabled(FeatureFlag.ANCHOR_STORE_GATING) &&
      store.isAnchorStore !== true
    ) {
      throw new BadRequestException('Ship-from-store is only available at House of Spells anchor stores');
    }

    const confirmed = await this.confirmTillInvoice({
      storeId,
      invoiceNumber: invoice,
      store,
    });

    let saleEmail = this.normalizeEmail(confirmed.customerEmail);

    // confirmTillInvoice may miss the email when customer hydration fails
    // silently or the local sale was imported before the email was added.
    // Fall back to the richer resolveInvoiceCustomerEmail chain which does
    // an additional live Lightspeed customer lookup.
    if (!saleEmail) {
      saleEmail = await this.resolveInvoiceCustomerEmail({
        storeId,
        invoiceNumber: invoice,
        store,
        posExternalSaleId: confirmed.externalId,
        metadata: undefined,
      });
    }

    let email = enteredEmail;
    if (!email) {
      if (!saleEmail) {
        throw new BadRequestException(
          'This Lightspeed sale has no customer email. Enter the email manually.',
        );
      }
      email = saleEmail;
    } else if (saleEmail && email !== saleEmail) {
      this.assertEmailMatchesSaleCustomer(email, saleEmail, 'till');
    } else if (!saleEmail && !email.includes('@')) {
      throw new BadRequestException('Valid email required');
    }

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
      // Customer already registered and attached — redirect staff to the existing order
      // instead of blocking with an error.
      return {
        shipmentId: existing.id,
        hosOrderNumber: existing.hosOrderNumber,
        qrAccessCode: existing.qrAccessCode,
        lookupUrl: this.buildLookupUrl(storeId),
        claimUrl: undefined,
        expiresAt: existing.claimTokenExpiresAt,
        emailQueued: false,
        resent: false,
        customerEmail: existing.claimEmail || email,
        existingOrder: true,
        items: [],
      };
    }
    if (
      existing &&
      RESENDABLE_SHIPMENT_STATUSES.includes(existing.status as (typeof RESENDABLE_SHIPMENT_STATUSES)[number]) &&
      existing.claimEmail &&
      existing.claimEmail !== email &&
      email !== saleEmail
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
    const hosOrderNumber =
      existing?.hosOrderNumber || (await this.generateHosOrderNumber(store.code));
    const qrAccessCode = existing?.qrAccessCode || randomBytes(4).toString('hex').toUpperCase();
    const metadata = {
      createdByStaff: params.staffUserId ?? null,
      invoiceValidatedAt: new Date().toISOString(),
      lightspeedSaleId: confirmed.externalId,
      invoiceCustomerEmail: saleEmail || email,
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
              hosOrderNumber,
              qrAccessCode,
              currency: confirmed.currency || store.currency || existing.currency,
              status: 'CUSTOMER_DETAILS_REQUIRED',
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
              hosOrderNumber,
              qrAccessCode,
              status: 'CUSTOMER_DETAILS_REQUIRED',
              currency: 'USD',
              posSaleId: confirmed.localSaleId,
              posExternalSaleId: confirmed.externalId,
              metadata,
            },
          });

    const claimUrl = this.buildClaimUrl(token);
    const lookupUrl = this.buildLookupUrl(storeId);
    this.logger.log(`Store shipment claim link generated for ${email} (shipment ${shipment.id})`);

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

    let items: Array<{ id?: string; sku?: string | null; name: string; quantity: number }> = [];
    try {
      const resolved = await this.resolveSaleForShipment(shipment.id);
      items = (resolved.enrichment || []).map((row, i) => ({
        sku: row.sku,
        name: row.name || row.sku || 'Item',
        quantity: row.quantity ?? 1,
        id: String(i),
      }));
      const sale = await this.prisma.pOSSale.findFirst({
        where: {
          storeId,
          OR: [
            { externalSaleId: confirmed.externalId },
            { externalInvoice: { equals: confirmed.invoiceNumber, mode: 'insensitive' } },
          ],
        },
        include: { items: true },
      });
      if (sale?.items?.length) {
        items = sale.items.map((it) => ({
          id: it.id,
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
        }));
      }
      await this.prisma.storeShipmentRequest.update({
        where: { id: shipment.id },
        data: { status: 'CUSTOMER_DETAILS_REQUIRED' },
      });
    } catch (err) {
      this.logger.warn(
        `Could not import invoice items for ${shipment.id}: ${(err as Error).message}`,
      );
    }

    return {
      shipmentId: shipment.id,
      hosOrderNumber,
      qrAccessCode,
      lookupUrl,
      claimUrl,
      expiresAt: claimTokenExpiresAt,
      emailQueued,
      resent: Boolean(existing),
      customerEmail: email,
      items,
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

  /** Public claim page bootstrap. Optionally checks a signed-in email against Lightspeed. */
  async getClaimContext(token: string, userEmail?: string) {
    const row = await this.resolveClaim(token);
    let emailMatchesInvoice: boolean | null = null;
    if (userEmail) {
      const saleEmail = await this.resolveInvoiceCustomerEmail({
        storeId: row.storeId,
        invoiceNumber: row.invoiceNumber || '',
        store: row.store,
        posExternalSaleId: row.posExternalSaleId,
        metadata: row.metadata,
      });
      const signedIn = this.normalizeEmail(userEmail);
      const claimEmail = this.normalizeEmail(row.claimEmail);
      // Accept when the signed-in email matches either the Lightspeed sale
      // customer OR the email the claim link was originally sent to.
      emailMatchesInvoice =
        (Boolean(saleEmail) && signedIn === saleEmail) ||
        (Boolean(claimEmail) && signedIn === claimEmail);
    }
    return {
      shipmentId: row.id,
      hosOrderNumber: row.hosOrderNumber,
      invoiceNumber: row.invoiceNumber,
      email: row.claimEmail,
      status: row.status,
      storeName: row.store.name,
      lookupUrl: this.buildLookupUrl(row.storeId),
      emailMatchesInvoice,
    };
  }

  /** Verify email matches the Lightspeed invoice customer, then attach the user. */
  async attachUserToClaim(token: string, userId: string, userEmail: string) {
    const row = await this.resolveClaim(token);
    const email = this.normalizeEmail(userEmail);
    const saleEmail = await this.resolveInvoiceCustomerEmail({
      storeId: row.storeId,
      invoiceNumber: row.invoiceNumber || '',
      store: row.store,
      posExternalSaleId: row.posExternalSaleId,
      metadata: row.metadata,
    });
    // Also accept the claim email: the customer received the magic link at
    // this address, so it is a valid identity even when Lightspeed holds a
    // different email for the same customer.
    const claimEmail = this.normalizeEmail(row.claimEmail);
    if (claimEmail && email === claimEmail) {
      // Matches the email the claim was sent to — skip the stricter
      // Lightspeed check to avoid blocking customers whose POS record
      // has a different address.
    } else {
      this.assertEmailMatchesSaleCustomer(email, saleEmail, 'claim');
    }

    await this.prisma.storeShipmentRequest.update({
      where: { id: row.id },
      data: { userId, claimEmail: email },
    });

    await this.prisma.gDPRConsentLog.updateMany({
      where: { email, userId: null, consentType: 'SHIPPING' },
      data: { userId },
    });

    const result = await this.resolveSaleForShipment(row.id, userId);

    // Consume the claim token only after the full flow succeeds so a
    // client-side timeout during resolveSaleForShipment does not orphan
    // the link (the customer can retry with the same token).
    await this.prisma.storeShipmentRequest.update({
      where: { id: row.id },
      data: { claimTokenHash: null },
    });

    return result;
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

  private normalizeEmail(email?: string | null): string {
    return (email ?? '').trim().toLowerCase();
  }

  private metadataCustomerEmail(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const value = (metadata as { invoiceCustomerEmail?: unknown }).invoiceCustomerEmail;
    return typeof value === 'string' ? value : undefined;
  }

  private assertEmailMatchesSaleCustomer(
    enteredEmail: string,
    saleEmail: string,
    mode: 'till' | 'claim',
  ): void {
    if (!saleEmail) {
      const message =
        'This Lightspeed sale has no customer email. Add the customer on the sale, then try again.';
      throw mode === 'till' ? new BadRequestException(message) : new ForbiddenException(message);
    }
    if (saleEmail !== enteredEmail) {
      const message =
        'This email does not match the customer on this Lightspeed sale. Use the email on the receipt.';
      throw mode === 'till' ? new BadRequestException(message) : new ForbiddenException(message);
    }
  }

  private async resolveInvoiceCustomerEmail(params: {
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
    posExternalSaleId?: string | null;
    metadata?: unknown;
  }): Promise<string> {
    const snapshot = this.normalizeEmail(this.metadataCustomerEmail(params.metadata));
    // Prefer matching by exact Lightspeed sale ID when available; fall back
    // to invoice number. Order by most recent to avoid stale duplicates.
    const local = params.posExternalSaleId
      ? await this.prisma.pOSSale.findFirst({
          where: { storeId: params.storeId, externalSaleId: params.posExternalSaleId },
          select: { customerEmail: true },
        }) ??
        await this.prisma.pOSSale.findFirst({
          where: {
            storeId: params.storeId,
            OR: [
              { externalInvoice: { equals: params.invoiceNumber, mode: 'insensitive' } },
              { externalSaleId: params.invoiceNumber },
            ],
          },
          orderBy: { saleDate: 'desc' },
          select: { customerEmail: true },
        })
      : await this.prisma.pOSSale.findFirst({
          where: {
            storeId: params.storeId,
            OR: [
              { externalInvoice: { equals: params.invoiceNumber, mode: 'insensitive' } },
              { externalSaleId: params.invoiceNumber },
            ],
          },
          orderBy: { saleDate: 'desc' },
          select: { customerEmail: true },
        });
    const localEmail = this.normalizeEmail(local?.customerEmail);

    const adapter = this.adapterFromStore(params.store, Date.now() + LIGHTSPEED_LOOKUP_BUDGET_MS);
    if (adapter) {
      try {
        const creds = this.encryption.decryptJson<Record<string, unknown>>(
          params.store.posConnection!.credentials as string,
        );
        await adapter.authenticate(creds);
        const outletId =
          params.store.posConnection?.externalOutletId || params.store.externalStoreId || undefined;
        let remote: POSSale | null = null;
        if (params.posExternalSaleId && adapter.getSaleById) {
          remote = await adapter.getSaleById(params.posExternalSaleId, { hydrateProducts: false });
        }
        if (!remote && adapter.getSaleByInvoice && params.invoiceNumber) {
          remote = await adapter.getSaleByInvoice({
            invoiceNumber: params.invoiceNumber,
            outletId,
            hydrateProducts: false,
          });
        }
        const live = this.normalizeEmail(remote?.customer?.email);
        if (live) return live;

        // Sale has a customer ID but hydration returned no email — try a
        // direct customer lookup as a final fallback. This bypasses the
        // hydrateSaleCustomer path which silently swallows timeouts.
        const customerId = remote?.customer?.externalId?.trim();
        if (customerId && adapter.lookupCustomer) {
          try {
            const customer = await adapter.lookupCustomer(customerId);
            const directEmail = this.normalizeEmail(customer?.email);
            if (directEmail) {
              this.logger.log(
                `Resolved email via direct customer lookup (${customerId}) after sale hydration missed it`,
              );
              return directEmail;
            }
          } catch (custErr) {
            this.logger.warn(
              `Direct customer lookup failed for ${customerId}: ${(custErr as Error).message}`,
            );
          }
        }
      } catch (e) {
        this.logger.warn(
          `Invoice customer email lookup failed: ${(e as Error).message}`,
        );
      }
    }

    return snapshot || localEmail;
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
    customerEmail?: string;
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
      orderBy: { saleDate: 'desc' },
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
      const email = remote.customer?.email || local?.customerEmail || undefined;
      if (!email) {
        this.logger.warn(
          `confirmTillInvoice: no email found for invoice ${invoice} ` +
            `(customerId=${remote.customer?.externalId || 'none'}, ` +
            `hasCustomer=${Boolean(remote.customer)}, ` +
            `localEmail=${local?.customerEmail || 'none'})`,
        );
      }
      return {
        externalId: remote.externalId,
        invoiceNumber: (remote.invoiceNumber || invoice).trim(),
        totalAmount: remote.totalAmount,
        currency: remote.currency,
        saleDate: remote.saleDate,
        localSaleId: local?.externalSaleId === remote.externalId ? local.id : undefined,
        customerEmail: email,
      };
    }

    if (lightspeedError) {
      throw new BadRequestException(
        'Could not confirm this invoice with Lightspeed. Check the connection and try again.',
      );
    }

    if (local) {
      return {
        externalId: local.externalSaleId,
        invoiceNumber: (local.externalInvoice || invoice).trim(),
        totalAmount: Number(local.totalAmount),
        currency: local.currency,
        saleDate: local.saleDate,
        localSaleId: local.id,
        customerEmail: local.customerEmail || undefined,
      };
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
    if (userId) {
      const cachedEmail = this.metadataCustomerEmail(shipment.metadata);
      if (!cachedEmail) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        const saleEmail = await this.resolveInvoiceCustomerEmail({
          storeId: shipment.storeId,
          invoiceNumber: shipment.invoiceNumber || '',
          store: shipment.store,
          posExternalSaleId: shipment.posExternalSaleId,
          metadata: shipment.metadata,
        });
        const normalizedUserEmail = this.normalizeEmail(user?.email);
        const claimEmail = this.normalizeEmail(shipment.claimEmail);
        // Accept when the user email matches the claim email (the address the
        // magic link was sent to), even if Lightspeed holds a different address.
        if (!(claimEmail && normalizedUserEmail === claimEmail)) {
          this.assertEmailMatchesSaleCustomer(normalizedUserEmail, saleEmail, 'claim');
        }
        if (saleEmail) {
          await this.prisma.storeShipmentRequest.update({
            where: { id: shipmentId },
            data: { metadata: { ...(shipment.metadata as object || {}), invoiceCustomerEmail: saleEmail } },
          });
        }
      }
    }

    const invoice = shipment.invoiceNumber?.trim();
    if (!invoice) throw new BadRequestException('Invoice number missing');

    let posSale = shipment.posSale;
    const expectedExternalId = shipment.posExternalSaleId?.trim() || '';
    if (posSale && expectedExternalId && posSale.externalSaleId !== expectedExternalId) {
      this.logger.warn(
        `Discarding linked POS sale ${posSale.id} for shipment ${shipment.id}: ` +
          `external id ${posSale.externalSaleId} does not match Lightspeed sale ${expectedExternalId}`,
      );
      posSale = null;
    }
    if (!posSale && expectedExternalId) {
      posSale = await this.prisma.pOSSale.findFirst({
        where: {
          storeId: shipment.storeId,
          externalSaleId: expectedExternalId,
        },
        include: { items: true },
      });
    }
    // Only search by invoice number when we do not already know the Lightspeed sale UUID.
    // Invoice "22" can match an older local sale while Lightspeed's receipt is HOS22.
    if (!posSale && !expectedExternalId) {
      posSale = await this.prisma.pOSSale.findFirst({
        where: {
          storeId: shipment.storeId,
          OR: [
            { externalInvoice: { equals: invoice, mode: 'insensitive' } },
            { externalSaleId: invoice },
          ],
        },
        orderBy: { saleDate: 'desc' },
        include: { items: true },
      });
    }

    const shouldFetchLive =
      Boolean(expectedExternalId) || !posSale || posSaleItemsNeedRefresh(posSale.items);

    if (shouldFetchLive) {
      try {
        const adapter = await this.buildAdapter(
          shipment.storeId,
          Date.now() + LIGHTSPEED_LOOKUP_BUDGET_MS,
        );
        const outletId =
          shipment.store.posConnection?.externalOutletId ||
          shipment.store.externalStoreId ||
          undefined;
        let byId: POSSale | null = null;
        let byInvoice: POSSale | null = null;
        if (expectedExternalId && adapter?.getSaleById) {
          byId = await adapter.getSaleById(expectedExternalId);
        }
        if (adapter?.getSaleByInvoice) {
          byInvoice = await adapter.getSaleByInvoice({ invoiceNumber: invoice, outletId });
        }
        const remote = this.preferLiveSaleForInvoice(byId, byInvoice, invoice);
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

  /**
   * When till staff typed a short invoice ("22"), a previously linked sale UUID
   * may be an older invoice 22 while Lightspeed search now finds HOS22.
   * Prefer the live sale whose invoice matches and that closed most recently.
   */
  private preferLiveSaleForInvoice(
    byId: POSSale | null,
    byInvoice: POSSale | null,
    invoice: string,
  ): POSSale | null {
    const candidates = [byId, byInvoice].filter((s): s is POSSale => Boolean(s));
    const matching = candidates.filter(
      (s) =>
        invoicesEquivalent(s.invoiceNumber || '', invoice) ||
        invoicesEquivalent(s.externalId, invoice),
    );
    const pool = matching.length ? matching : candidates;
    if (!pool.length) return null;
    const time = (s: POSSale) => {
      const t = s.saleDate instanceof Date ? s.saleDate.getTime() : Date.parse(String(s.saleDate ?? ''));
      return Number.isFinite(t) ? t : 0;
    };
    return pool.reduce((best, s) => (time(s) > time(best) ? s : best));
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

    const enrichment = results.map((r, i) => ({
      ...r,
      quantity: items[i]?.quantity ?? 1,
    }));

    // Quote with default parcel sizes when HS/dimensions are still pending. Only
    // block restricted SKUs, or wait when Lightspeed has not given us any lines.
    const canQuote = items.length > 0 && !anyBlocked;
    const status = anyBlocked ? 'BLOCKED' : canQuote ? 'CUSTOMER_DETAILS_REQUIRED' : 'PENDING_ENRICHMENT';
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: { status, metadata: { enrichment } as object },
    });

    return { shipmentId, status, enrichment, allReady: canQuote };
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
        groups: { select: { id: true, boxSizeId: true, customerPrice: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.userId && shipment.userId !== userId) {
      throw new ForbiddenException('Not your shipment');
    }
    const hasFixedQuote =
      Number(shipment.totalCustomerCharge || 0) > 0 && (shipment.groups?.length || 0) > 0;
    if (!hasFixedQuote && !shipment.destinationAddress) {
      throw new BadRequestException('Destination address required');
    }
    if (shipment.status === 'BLOCKED' || shipment.status === 'CANCELLED') {
      throw new BadRequestException(`Shipment is ${shipment.status}`);
    }
    return shipment;
  }

  private async buildRateContext(shipment: {
    store: {
      name?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      countryCode?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
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
      name: shipment.store.name || 'House of Spells',
      street1: shipment.store.address || 'Store',
      city: shipment.store.city || 'New York',
      state: shipment.store.state || 'NY',
      postalCode: shipment.store.postalCode || '10001',
      country: shipment.store.countryCode || shipment.store.country || 'US',
      phone: shipment.store.contactPhone || this.config.get<string>('SHIPPO_SENDER_PHONE') || '',
      email: shipment.store.contactEmail || this.config.get<string>('SHIPPO_SENDER_EMAIL') || '',
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
    params: { carrier?: string; service?: string; amount?: number; currency?: string },
  ) {
    const shipment = await this.loadShipmentForQuote(shipmentId, userId);

    if (!this.featureFlags.isEnabled(FeatureFlag.SHIPPING_ONLINE_PAYMENT)) {
      throw new BadRequestException('Online payment is disabled. Pay cash or card at the shipping counter.');
    }

    if (shipment.status === 'LABEL_PURCHASED' || shipment.status === 'LABEL_CREATED') {
      throw new BadRequestException('Label already purchased — cannot re-authorize');
    }
    if (['PAID', 'PACKING', 'PACKED', 'READY_FOR_PICKUP', 'HANDED_TO_CARRIER'].includes(shipment.status)) {
      return {
        clientSecret: undefined,
        paymentIntentId: shipment.stripePaymentIntentId,
        alreadyPaid: true,
      };
    }

    const fixed = Number(shipment.totalCustomerCharge || 0);
    if (fixed <= 0) {
      throw new BadRequestException(
        'Shipping quote has not been finalized. Staff must set box sizes before payment can proceed.',
      );
    }
    const amount = fixed;
    const carrier = 'HOS';
    const service = 'FIXED_BOX';

    await this.paymentProvider.ensureAvailableProviders();
    if (!this.paymentProvider.isProviderAvailable('stripe')) {
      throw new BadRequestException('Payment provider unavailable');
    }

    const provider = this.paymentProvider.getProvider('stripe');

    if (shipment.stripePaymentIntentId && provider.cancelPaymentIntent) {
      let outcome: 'cancelled' | 'already_succeeded' | 'skipped';
      try {
        outcome = await provider.cancelPaymentIntent(shipment.stripePaymentIntentId);
      } catch (cancelErr) {
        // The prior intent may still be chargeable. Minting a second one would
        // orphan it, and a payment against it could never satisfy purchaseLabel.
        this.logger.error(
          `Failed to cancel previous PaymentIntent ${shipment.stripePaymentIntentId}: ${(cancelErr as Error).message}`,
        );
        throw new BadRequestException(
          'Could not release the previous payment attempt. Refresh the page and try again.',
        );
      }

      // Shipping is already paid — hand back the captured intent so the customer
      // can go straight to purchasing the label instead of paying twice.
      if (outcome === 'already_succeeded') {
        return {
          clientSecret: undefined,
          paymentIntentId: shipment.stripePaymentIntentId,
          alreadyPaid: true,
        };
      }
    }

    let intent: { clientSecret?: string; paymentIntentId: string };
    try {
      intent = await provider.createPaymentIntent({
        amount,
        currency: params.currency || shipment.currency,
        orderId: shipmentId,
        metadata: {
          type: 'store_shipment',
          shipmentId,
          carrier,
          service,
        },
        // Each authorization cancels the prior intent, so the key must be fresh —
        // reusing it replays Stripe's cached (now cancelled) intent, or throws when
        // the carrier/service metadata differs at the same amount.
        idempotencyKey: `shipment-${shipmentId}-${Date.now()}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      this.logger.error(
        `Stripe createPaymentIntent failed for shipment ${shipmentId}` +
          `${code ? ` [${code}]` : ''}: ${msg}`,
      );
      throw new BadRequestException(
        `Payment could not be processed: ${msg}${code ? ` (${code})` : ''}`,
      );
    }

    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: {
        shippingAmount: new Decimal(amount.toFixed(2)),
        selectedCarrier: carrier,
        selectedService: service,
        stripePaymentIntentId: intent.paymentIntentId,
        status: 'AWAITING_PAYMENT',
      },
    });

    return {
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      alreadyPaid: false,
    };
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

  /** Shipments where the customer hasn't finished entering their details yet. */
  async listPendingCustomerQueue(page = 1, limit = 30, storeId?: string) {
    const where: Record<string, unknown> = {
      status: { in: ['NEW', 'CUSTOMER_DETAILS_REQUIRED', 'DRAFT', 'PENDING_ENRICHMENT'] },
    };
    if (storeId) where.storeId = storeId;
    const [items, total] = await Promise.all([
      this.prisma.storeShipmentRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          store: { select: { name: true, code: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.storeShipmentRequest.count({ where }),
    ]);
    return { items, pagination: { page, limit, total } };
  }
}

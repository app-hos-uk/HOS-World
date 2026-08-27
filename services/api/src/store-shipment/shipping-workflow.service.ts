import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { CourierFactoryService } from '../shipping/courier/courier-factory.service';
import type { RateResponse } from '../shipping/courier/interfaces/courier-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentProviderService } from '../payments/payment-provider.service';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { BoxSizeService } from './box-size.service';
import { ShippingSlipService } from './shipping-slip.service';

export const PREFERRED_CARRIERS = ['UPS', 'FedEx', 'DHL'] as const;

export const COUNTER_PAYMENT_METHODS = ['CASH', 'CARD', 'OTHER'] as const;
export type CounterPaymentMethod = (typeof COUNTER_PAYMENT_METHODS)[number];

const PAID_STATUSES = new Set([
  'PAID',
  'SENT_TO_LOGISTICS',
  'PACKING',
  'PACKED',
  'LABEL_CREATED',
  'READY_FOR_PICKUP',
  'HANDED_TO_CARRIER',
  'IN_TRANSIT',
  'DELIVERED',
]);

@Injectable()
export class ShippingWorkflowService {
  private readonly logger = new Logger(ShippingWorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private boxSizes: BoxSizeService,
    private slip: ShippingSlipService,
    private courierFactory: CourierFactoryService,
    private notifications: NotificationsService,
    private paymentProvider: PaymentProviderService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
  ) {}

  async lookupPublic(query: string | undefined, storeId?: string) {
    const q = (query ?? '').trim();
    if (!q) throw new BadRequestException('Enter a shipping order number or email');
    const row = await this.prisma.storeShipmentRequest.findFirst({
      where: {
        ...(storeId ? { storeId } : {}),
        status: { notIn: ['CANCELLED', 'BLOCKED'] },
        OR: [
          { hosOrderNumber: { equals: q, mode: 'insensitive' } },
          { qrAccessCode: { equals: q, mode: 'insensitive' } },
          { invoiceNumber: { equals: q, mode: 'insensitive' } },
          { claimEmail: { equals: q.toLowerCase(), mode: 'insensitive' } },
        ],
      },
      include: { store: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new NotFoundException('No shipping order found. Check the number or email.');
    return {
      shipmentId: row.id,
      hosOrderNumber: row.hosOrderNumber,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      storeId: row.storeId,
      storeName: row.store.name,
    };
  }

  async attachByLogin(shipmentId: string, userId: string, userEmail: string) {
    const row = await this.prisma.storeShipmentRequest.findUnique({ where: { id: shipmentId } });
    if (!row) throw new NotFoundException('Shipping order not found');
    const email = (userEmail || '').trim().toLowerCase();
    const claim = (row.claimEmail || '').trim().toLowerCase();
    if (claim && email !== claim) {
      throw new ForbiddenException(
        'This account email does not match the customer on this shipping order.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: {
        userId,
        claimEmail: email || row.claimEmail,
        customerName: name || row.customerName,
        customerPhone: user?.phone || row.customerPhone,
        status: row.status === 'NEW' || row.status === 'DRAFT' ? 'CUSTOMER_DETAILS_REQUIRED' : row.status,
      },
    });
    return this.getProgress(shipmentId, { userId, role: 'CUSTOMER' });
  }

  async updateCustomerProfile(
    shipmentId: string,
    userId: string,
    body: { firstName?: string; lastName?: string; phone?: string },
  ) {
    const row = await this.requireCustomerOrder(shipmentId, userId);
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const phone = body.phone?.trim();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName != null ? { firstName } : {}),
        ...(lastName != null ? { lastName } : {}),
        ...(phone != null ? { phone } : {}),
      },
    });
    const name = [firstName ?? undefined, lastName ?? undefined].filter(Boolean).join(' ').trim();
    await this.prisma.storeShipmentRequest.update({
      where: { id: row.id },
      data: {
        customerName: name || row.customerName,
        customerPhone: phone || row.customerPhone,
      },
    });
    return this.getProgress(shipmentId, { userId, role: 'CUSTOMER' });
  }

  async assignItems(
    shipmentId: string,
    userId: string,
    body: {
      assignments: Array<{
        addressId: string;
        recipientName?: string;
        recipientEmail?: string;
        recipientPhone?: string;
        items: Array<{ posSaleItemId: string; quantity: number }>;
      }>;
      carryInHand?: Array<{ posSaleItemId: string; quantity: number }>;
    },
  ) {
    const order = await this.requireCustomerOrder(shipmentId, userId);
    if (PAID_STATUSES.has(order.status)) {
      throw new BadRequestException('This order is already paid and cannot be reassigned');
    }
    const sale = order.posSaleId
      ? await this.prisma.pOSSale.findUnique({
          where: { id: order.posSaleId },
          include: { items: true },
        })
      : null;
    const saleItems = sale?.items || [];
    if (!saleItems.length) throw new BadRequestException('Invoice items are not loaded yet');

    const qtyById = new Map(saleItems.map((i) => [i.id, i.quantity]));
    const used = new Map<string, number>();
    const bump = (id: string, qty: number) => used.set(id, (used.get(id) || 0) + qty);

    if (!body.assignments?.length) {
      throw new BadRequestException('Assign at least one item to a shipping address, or mark all as carry-in-hand');
    }

    for (const group of body.assignments) {
      if (!group.addressId) throw new BadRequestException('Each shipment needs a destination address');
      if (!group.items?.length) throw new BadRequestException('Each address group needs at least one item');
      for (const line of group.items) {
        if (!qtyById.has(line.posSaleItemId)) {
          throw new BadRequestException('Item is not on this invoice');
        }
        if (line.quantity < 1) throw new BadRequestException('Quantity must be at least 1');
        bump(line.posSaleItemId, line.quantity);
      }
    }
    for (const line of body.carryInHand || []) {
      if (!qtyById.has(line.posSaleItemId)) throw new BadRequestException('Item is not on this invoice');
      bump(line.posSaleItemId, line.quantity);
    }
    for (const [id, qty] of used) {
      const available = qtyById.get(id) || 0;
      if (qty > available) {
        throw new BadRequestException('Assigned quantity exceeds the invoice quantity');
      }
    }

    await this.prisma.shipmentGroupItem.deleteMany({
      where: { group: { shippingOrderId: shipmentId } },
    });
    await this.prisma.shipmentGroup.deleteMany({ where: { shippingOrderId: shipmentId } });

    for (const group of body.assignments) {
      const address = await this.prisma.address.findFirst({
        where: { id: group.addressId, userId },
      });
      if (!address) throw new NotFoundException('Address not found');
      await this.prisma.shipmentGroup.create({
        data: {
          shippingOrderId: shipmentId,
          destinationAddressId: address.id,
          destinationSnapshot: {
            firstName: address.firstName,
            lastName: address.lastName,
            street: address.street,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            countryCode: address.countryCode,
            phone: address.phone,
          },
          recipientName: group.recipientName || `${address.firstName} ${address.lastName}`.trim(),
          recipientEmail: group.recipientEmail,
          recipientPhone: group.recipientPhone || address.phone,
          status: 'PENDING',
          items: {
            create: group.items.map((line) => {
              const saleItem = saleItems.find((s) => s.id === line.posSaleItemId);
              return {
                posSaleItemId: line.posSaleItemId,
                sku: saleItem?.sku,
                name: saleItem?.name || 'Item',
                quantity: line.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });
    }

    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: {
        selectedItems: {
          assignments: body.assignments,
          carryInHand: body.carryInHand || [],
        } as object,
        destinationAddressId: body.assignments[0]?.addressId || order.destinationAddressId,
        status: 'CUSTOMER_DETAILS_REQUIRED',
      },
    });

    return this.getProgress(shipmentId, { userId, role: 'CUSTOMER' });
  }

  async setBoxSizes(
    shipmentId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body: { groups: Array<{ groupId: string; boxSizeId: string; customPrice?: number }> },
  ) {
    const order = await this.requireStaffOrder(shipmentId, staff);
    if (PAID_STATUSES.has(order.status)) {
      throw new BadRequestException('This order is already paid — void the payment before re-quoting');
    }
    if (!body.groups?.length) throw new BadRequestException('Select a box size for each shipment');

    let totalCharge = 0;
    let totalPackaging = 0;
    let currency = order.currency || 'USD';
    const groupCurrencies = new Set<string>();

    type GroupWrite = { id: string; boxSizeId: string; boxSizeName: string; customerPrice: Decimal; packagingCost: Decimal };
    const groupWrites: GroupWrite[] = [];

    for (const g of body.groups) {
      const group = await this.prisma.shipmentGroup.findFirst({
        where: { id: g.groupId, shippingOrderId: shipmentId },
      });
      if (!group) throw new NotFoundException(`Shipment group ${g.groupId} not found`);
      const box = await this.prisma.boxSize.findUnique({ where: { id: g.boxSizeId } });
      if (!box || !box.isActive) throw new BadRequestException('Box size is not available');
      const dest = (group.destinationSnapshot || {}) as Record<string, string>;
      const country = dest.countryCode || dest.country;
      const quoted = await this.boxSizes.resolveRate(box.id, country);
      const resolvedCurrency = quoted.currency || currency;
      groupCurrencies.add(resolvedCurrency);
      const price =
        box.name === 'CUSTOM' && g.customPrice != null ? g.customPrice : quoted.price;
      if (!(price >= 0)) throw new BadRequestException('Invalid box price');
      totalCharge += price;
      totalPackaging += quoted.packagingCost;
      currency = resolvedCurrency;
      groupWrites.push({
        id: group.id,
        boxSizeId: box.id,
        boxSizeName: box.label,
        customerPrice: new Decimal(price.toFixed(2)),
        packagingCost: box.packagingCost,
      });
    }

    if (groupCurrencies.size > 1) {
      throw new BadRequestException(
        `All destination tiers must use the same currency to create a single charge. Found: ${[...groupCurrencies].join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      ...groupWrites.map((gw) =>
        this.prisma.shipmentGroup.update({
          where: { id: gw.id },
          data: {
            boxSizeId: gw.boxSizeId,
            boxSizeName: gw.boxSizeName,
            customerPrice: gw.customerPrice,
            packagingCost: gw.packagingCost,
          },
        }),
      ),
      this.prisma.storeShipmentRequest.update({
        where: { id: shipmentId },
        data: {
          totalCustomerCharge: new Decimal(totalCharge.toFixed(2)),
          totalPackagingCost: new Decimal(totalPackaging.toFixed(2)),
          shippingAmount: new Decimal(totalCharge.toFixed(2)),
          currency,
          status: 'AWAITING_PAYMENT',
        },
      }),
    ]);

    return this.getProgress(shipmentId, { userId: staff.id, role: 'STAFF' });
  }

  async staffConfirmPayment(
    shipmentId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body: { method?: string },
  ) {
    const method = (body.method || '').trim().toUpperCase();
    if (!COUNTER_PAYMENT_METHODS.includes(method as CounterPaymentMethod)) {
      throw new BadRequestException('Select how the customer paid: Cash, Card, or Other');
    }

    const order = await this.requireStaffOrder(shipmentId, staff);
    if (PAID_STATUSES.has(order.status)) {
      return this.getProgress(shipmentId, { userId: staff.id, role: 'STAFF' });
    }
    if (order.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException('Finalize the shipping quote before confirming payment');
    }

    const wrote = await this.markPaid(shipmentId, method);
    if (wrote) await this.sendPaidEmail(order);

    return this.getProgress(shipmentId, { userId: staff.id, role: 'STAFF' });
  }

  async confirmPayment(shipmentId: string, userId: string) {
    const order = await this.requireCustomerOrder(shipmentId, userId);
    if (PAID_STATUSES.has(order.status)) {
      return this.getProgress(shipmentId, { userId, role: 'CUSTOMER' });
    }
    if (!order.stripePaymentIntentId) {
      if (!this.featureFlags.isEnabled(FeatureFlag.SHIPPING_ONLINE_PAYMENT)) {
        throw new BadRequestException('Online payment is disabled. Pay at the shipping counter.');
      }
      throw new BadRequestException('Shipping payment has not been started');
    }
    const stripe = this.paymentProvider.getProvider('stripe');
    const paymentStatus = await stripe.getPaymentStatus(order.stripePaymentIntentId);
    if (paymentStatus !== 'succeeded') {
      throw new BadRequestException(`Payment has not succeeded (status: ${paymentStatus})`);
    }

    const wrote = await this.markPaid(shipmentId, 'CARD');
    if (wrote) await this.sendPaidEmail(order);

    return this.getProgress(shipmentId, { userId, role: 'CUSTOMER' });
  }

  async slipPdf(shipmentId: string, staff: { storeId?: string; role?: string }) {
    const order = await this.requireStaffOrder(shipmentId, staff);
    if (!PAID_STATUSES.has(order.status)) {
      throw new BadRequestException('Confirm payment before printing the shipping slip');
    }
    return this.slip.generatePdf(shipmentId);
  }

  private async markPaid(shipmentId: string, paymentMethod: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.storeShipmentRequest.updateMany({
        where: { id: shipmentId, status: 'AWAITING_PAYMENT' },
        data: {
          status: 'PAID',
          paymentMethod,
          shippingSlipUrl: `/store-shipment/${shipmentId}/slip`,
        },
      });
      if (updated.count === 0) return false;
      await tx.shipmentGroup.updateMany({
        where: { shippingOrderId: shipmentId },
        data: { status: 'PAID' },
      });
      return true;
    });
  }

  private async sendPaidEmail(order: {
    id: string;
    storeId: string;
    claimEmail?: string | null;
    hosOrderNumber?: string | null;
    totalCustomerCharge?: { toString(): string } | number | null;
    shippingAmount?: { toString(): string } | number | null;
    currency: string;
  }) {
    try {
      await this.notifications.sendStoreShipmentPaidEmail({
        email: order.claimEmail || '',
        hosOrderNumber: order.hosOrderNumber || order.id,
        storeName: (await this.prisma.store.findUnique({ where: { id: order.storeId } }))?.name || 'House of Spells',
        amount: Number(order.totalCustomerCharge || order.shippingAmount || 0),
        currency: order.currency,
      });
    } catch (err) {
      this.logger.warn(`Paid email failed: ${(err as Error).message}`);
    }
  }

  async receiveByLogistics(
    shipmentId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body: { employeeName: string },
  ) {
    const order = await this.requireStaffOrder(shipmentId, staff);
    if (order.status !== 'PAID' && order.status !== 'SENT_TO_LOGISTICS') {
      throw new BadRequestException('Order must be paid before logistics intake');
    }
    const name = body.employeeName?.trim();
    if (!name) throw new BadRequestException('Employee name is required');
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: {
        receivedByEmployee: name,
        receivedAt: new Date(),
        status: 'PACKING',
      },
    });
    await this.prisma.shipmentGroup.updateMany({
      where: { shippingOrderId: shipmentId, status: { in: ['PAID', 'PENDING'] } },
      data: { status: 'PACKING' },
    });
    return this.getProgress(shipmentId, { userId: staff.id, role: 'STAFF' });
  }

  async verifyItems(
    groupId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body: { verifiedItemIds: string[]; packedBy?: string },
  ) {
    const group = await this.loadStaffGroup(groupId, staff);
    const items = group.items;
    const verified = new Set(body.verifiedItemIds || []);
    const missing = items.filter((i) => !verified.has(i.id));
    if (missing.length) {
      await this.prisma.storeShipmentRequest.update({
        where: { id: group.shippingOrderId },
        data: { status: 'ITEM_MISSING' },
      });
      throw new BadRequestException(
        `Scan/check all items before sealing. Missing: ${missing.map((m) => m.name).join(', ')}`,
      );
    }
    await this.prisma.shipmentGroupItem.updateMany({
      where: { groupId, id: { in: [...verified] } },
      data: { verified: true, verifiedAt: new Date() },
    });
    await this.prisma.shipmentGroup.update({
      where: { id: groupId },
      data: {
        status: 'PACKED',
        packedBy: body.packedBy || staff.id,
        packedAt: new Date(),
      },
    });
    await this.syncParentPackStatus(group.shippingOrderId);
    return this.getProgress(group.shippingOrderId, { userId: staff.id, role: 'STAFF' });
  }

  async setWeight(
    groupId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body: { weightKg: number; lengthCm?: number; widthCm?: number; heightCm?: number },
  ) {
    const group = await this.loadStaffGroup(groupId, staff);
    if (!(body.weightKg > 0)) throw new BadRequestException('Weight must be greater than 0');
    await this.prisma.shipmentGroup.update({
      where: { id: groupId },
      data: {
        actualWeightKg: new Decimal(body.weightKg),
        actualLengthCm: body.lengthCm != null ? new Decimal(body.lengthCm) : group.actualLengthCm,
        actualWidthCm: body.widthCm != null ? new Decimal(body.widthCm) : group.actualWidthCm,
        actualHeightCm: body.heightCm != null ? new Decimal(body.heightCm) : group.actualHeightCm,
      },
    });
    return this.getProgress(group.shippingOrderId, { userId: staff.id, role: 'STAFF' });
  }

  async generateLabel(
    groupId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body?: { serviceCode?: string },
  ) {
    const group = await this.loadStaffGroup(groupId, staff);
    const order = group.shippingOrder;
    if (!['PACKED', 'PACKING', 'LABEL_CREATED'].includes(group.status) && group.status !== 'PAID') {
      throw new BadRequestException('Pack and verify items before generating a label');
    }
    const dest = (group.destinationSnapshot || {}) as Record<string, string>;
    if (!dest.street || !dest.city || !dest.postalCode) {
      throw new BadRequestException('Destination address is incomplete');
    }
    const box = group.boxSize;
    const weight = Number(group.actualWeightKg || 0.5);
    const length = Number(group.actualLengthCm || box?.lengthCm || 30);
    const width = Number(group.actualWidthCm || box?.widthCm || 20);
    const height = Number(group.actualHeightCm || box?.heightCm || 10);

    const from = {
      name: order.store.name || 'House of Spells',
      street1: order.store.address || 'Store',
      city: order.store.city || 'New York',
      state: order.store.state || 'NY',
      postalCode: order.store.postalCode || '10001',
      country: order.store.countryCode || order.store.country || 'US',
    };
    const to = {
      name: group.recipientName || `${dest.firstName || ''} ${dest.lastName || ''}`.trim() || 'Customer',
      street1: dest.street,
      street2: dest.addressLine2 || undefined,
      city: dest.city,
      state: dest.state || undefined,
      postalCode: dest.postalCode,
      country: dest.countryCode || dest.country || 'US',
      phone: group.recipientPhone || dest.phone,
      email: group.recipientEmail || order.claimEmail || undefined,
    };

    const defaultProv = this.courierFactory.getDefaultProvider();
    if (!defaultProv) throw new BadRequestException('No shipping provider configured');

    const rates = await this.courierFactory.getRates(defaultProv.providerId, {
      from,
      to,
      packages: [{ weight, length, width, height }],
      preferredCarriers: [...PREFERRED_CARRIERS],
    });
    const selected = this.pickPreferredRate(rates, body?.serviceCode);
    if (!selected) throw new BadRequestException('No UPS, FedEx, or DHL rates are available');

    const label = await this.courierFactory.createShipment(defaultProv.providerId, {
      orderId: `${order.id}:${group.id}`,
      from,
      to,
      packages: [{ weight, length, width, height }],
      serviceCode: selected.serviceCode,
      reference1: order.hosOrderNumber || order.invoiceNumber || order.id,
    });
    const labelUrl = label.labels?.[0]?.url ?? label.trackingUrl;
    const carrierCost = selected.rate;

    await this.prisma.shipmentGroup.update({
      where: { id: groupId },
      data: {
        status: 'LABEL_CREATED',
        trackingCode: label.trackingNumber,
        labelUrl,
        carrierName: String(selected.metadata?.carrier || selected.providerName),
        carrierService: selected.serviceName,
        carrierCost: new Decimal(carrierCost.toFixed(2)),
        shippoTransactionId: label.trackingNumber,
        labelCreatedAt: new Date(),
      },
    });

    const groups = await this.prisma.shipmentGroup.findMany({ where: { shippingOrderId: order.id } });
    const allLabeled = groups.every((g) => g.id === groupId || ['LABEL_CREATED', 'READY_FOR_PICKUP', 'HANDED_TO_CARRIER'].includes(g.status));
    const totalCarrier = groups.reduce(
      (s, g) => s + (g.id === groupId ? carrierCost : Number(g.carrierCost || 0)),
      0,
    );
    await this.prisma.storeShipmentRequest.update({
      where: { id: order.id },
      data: {
        status: allLabeled ? 'LABEL_CREATED' : order.status,
        totalCarrierCost: new Decimal(totalCarrier.toFixed(2)),
        trackingCode: label.trackingNumber,
        labelUrl,
      },
    });

    return {
      ...(await this.getProgress(order.id, { userId: staff.id, role: 'STAFF' })),
      rates,
      selectedRate: selected,
    };
  }

  async verifyLabel(
    groupId: string,
    staff: { id?: string; storeId?: string; role?: string },
    body: { hosOrderNumber: string; carrierTrackingNumber: string },
  ) {
    const group = await this.loadStaffGroup(groupId, staff);
    const expectedOrder = (group.shippingOrder.hosOrderNumber || '').trim().toUpperCase();
    const scannedOrder = (body.hosOrderNumber || '').trim().toUpperCase();
    const expectedTrack = (group.trackingCode || '').trim().toUpperCase();
    const scannedTrack = (body.carrierTrackingNumber || '').trim().toUpperCase();
    if (!expectedOrder || scannedOrder !== expectedOrder) {
      throw new BadRequestException('HOS order barcode does not match this package');
    }
    if (!expectedTrack || scannedTrack !== expectedTrack) {
      throw new BadRequestException('Carrier tracking barcode does not match the label for this package');
    }
    await this.prisma.shipmentGroup.update({
      where: { id: groupId },
      data: { status: 'READY_FOR_PICKUP' },
    });
    const groups = await this.prisma.shipmentGroup.findMany({ where: { shippingOrderId: group.shippingOrderId } });
    const allReady = groups.every(
      (g) => g.id === groupId || ['READY_FOR_PICKUP', 'HANDED_TO_CARRIER'].includes(g.status),
    );
    if (allReady) {
      await this.prisma.storeShipmentRequest.update({
        where: { id: group.shippingOrderId },
        data: { status: 'READY_FOR_PICKUP' },
      });
    }
    return this.getProgress(group.shippingOrderId, { userId: staff.id, role: 'STAFF' });
  }

  async carrierPickup(
    shipmentId: string,
    staff: { id?: string; storeId?: string; role?: string },
  ) {
    const order = await this.requireStaffOrder(shipmentId, staff);
    const store = await this.prisma.store.findUnique({ where: { id: order.storeId } });
    await this.prisma.shipmentGroup.updateMany({
      where: { shippingOrderId: shipmentId },
      data: { status: 'HANDED_TO_CARRIER', handedToCarrierAt: new Date() },
    });
    await this.prisma.storeShipmentRequest.update({
      where: { id: shipmentId },
      data: { status: 'HANDED_TO_CARRIER' },
    });

    const groups = await this.prisma.shipmentGroup.findMany({
      where: { shippingOrderId: shipmentId },
      include: { items: true },
    });
    for (const group of groups) {
      const payload = {
        hosOrderNumber: order.hosOrderNumber || shipmentId,
        storeName: store?.name || 'House of Spells',
        destination: this.formatDest(group.destinationSnapshot),
        carrier: group.carrierName || 'Carrier',
        trackingCode: group.trackingCode || '',
        trackingUrl: group.labelUrl || '',
        items: group.items.map((i) => `${i.name} ×${i.quantity}`).join(', '),
      };
      if (order.claimEmail) {
        try {
          await this.notifications.sendStoreShipmentTrackingEmail({
            email: order.claimEmail,
            ...payload,
          });
        } catch (err) {
          this.logger.warn(`Tracking email failed: ${(err as Error).message}`);
        }
      }
      if (group.recipientEmail && group.recipientEmail.toLowerCase() !== order.claimEmail?.toLowerCase()) {
        try {
          await this.notifications.sendStoreShipmentTrackingEmail({
            email: group.recipientEmail,
            ...payload,
          });
        } catch (err) {
          this.logger.warn(`Recipient tracking email failed: ${(err as Error).message}`);
        }
      }
    }

    return this.getProgress(shipmentId, { userId: staff.id, role: 'STAFF' });
  }

  async listStaffOrders(
    staff: { id?: string; storeId?: string; role?: string },
    opts?: { status?: string; page?: number; limit?: number },
  ) {
    const page = opts?.page || 1;
    const limit = Math.min(opts?.limit || 30, 100);
    const where: Record<string, unknown> = {};
    if (staff.role !== 'ADMIN') {
      if (!staff.storeId) throw new ForbiddenException('Store context required');
      where.storeId = staff.storeId;
    }
    if (opts?.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      this.prisma.storeShipmentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          store: { select: { name: true, code: true } },
          groups: { select: { id: true, status: true, trackingCode: true, boxSizeName: true } },
        },
      }),
      this.prisma.storeShipmentRequest.count({ where }),
    ]);
    return { items, pagination: { page, limit, total } };
  }

  async listBackoffice(
    staff: { id?: string; storeId?: string; role?: string },
    status?: string,
    opts?: { page?: number; limit?: number },
  ) {
    const page = opts?.page || 1;
    const limit = Math.min(opts?.limit || 50, 200);
    const where: Record<string, unknown> = {
      status: status || { in: ['PAID', 'SENT_TO_LOGISTICS', 'PACKING', 'PACKED', 'LABEL_CREATED', 'READY_FOR_PICKUP', 'ITEM_MISSING'] },
    };
    if (staff.role !== 'ADMIN') {
      if (!staff.storeId) throw new ForbiddenException('Store context required');
      where.storeId = staff.storeId;
    }
    const [items, total] = await Promise.all([
      this.prisma.storeShipmentRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          store: { select: { name: true, code: true } },
          groups: { include: { items: true, boxSize: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.storeShipmentRequest.count({ where }),
    ]);
    return { items, pagination: { page, limit, total } };
  }

  async getProgress(
    shipmentId: string,
    actor: { userId?: string; role?: string },
  ) {
    const order = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: {
        store: { select: { id: true, name: true, code: true, currency: true } },
        posSale: { include: { items: true } },
        groups: { include: { items: true, boxSize: true }, orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Shipping order not found');
    if (actor.role === 'CUSTOMER' && order.userId && actor.userId && order.userId !== actor.userId) {
      throw new ForbiddenException('Not your shipping order');
    }

    const boxes = await this.boxSizes.list(order.storeId);
    const invoiceItems = (order.posSale?.items || []).map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    }));

    const priceCache = new Map<string, Awaited<ReturnType<BoxSizeService['pricesForCountry']>>>();
    const groups = [];
    for (const g of order.groups) {
      const dest = (g.destinationSnapshot || {}) as Record<string, string>;
      const country = dest.countryCode || dest.country;
      const cacheKey = (country || '').toUpperCase();
      let priced = priceCache.get(cacheKey);
      if (!priced) {
        priced = await this.boxSizes.pricesForCountry(country);
        priceCache.set(cacheKey, priced);
      }
      groups.push({
        ...g,
        customerPrice: Number(g.customerPrice || 0),
        packagingCost: Number(g.packagingCost || 0),
        carrierCost: Number(g.carrierCost || 0),
        actualWeightKg: g.actualWeightKg != null ? Number(g.actualWeightKg) : null,
        recommendedBoxName: this.boxSizes.recommendName(g.items.reduce((s, i) => s + i.quantity, 0)),
        shippingTier: priced.tier,
        pricesByBox: priced.prices,
        destinationCountry: this.boxSizes.normalizeCountry(country),
      });
    }

    return {
      id: order.id,
      hosOrderNumber: order.hosOrderNumber,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      nextAction: this.nextAction(order),
      store: order.store,
      claimEmail: order.claimEmail,
      customerName: order.customerName || [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' '),
      customerPhone: order.customerPhone || order.user?.phone,
      user: order.user,
      currency: order.currency,
      totalCustomerCharge: Number(order.totalCustomerCharge || 0),
      totalCarrierCost: Number(order.totalCarrierCost || 0),
      totalPackagingCost: Number(order.totalPackagingCost || 0),
      paymentMethod: order.paymentMethod,
      onlinePaymentEnabled: this.featureFlags.isEnabled(FeatureFlag.SHIPPING_ONLINE_PAYMENT),
      specialInstructions: order.specialInstructions,
      receivedByEmployee: order.receivedByEmployee,
      receivedAt: order.receivedAt,
      invoiceItems,
      selectedItems: order.selectedItems,
      groups,
      boxSizes: boxes,
      lookupUrl: this.lookupUrl(order.storeId),
    };
  }

  async dashboardSummary(from?: Date, to?: Date) {
    const where = this.dateWhere(from, to);
    const rows = await this.prisma.storeShipmentRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = r._count._all;
    const problem = ['ADDRESS_ISSUE', 'ITEM_MISSING', 'PAYMENT_ISSUE', 'SHIPPING_HOLD', 'RETURNED_TO_STORE', 'LOST_CARRIER_ISSUE', 'BLOCKED']
      .reduce((s, k) => s + (counts[k] || 0), 0);
    return {
      created: rows.reduce((s, r) => s + r._count._all, 0),
      awaitingPayment: counts.AWAITING_PAYMENT || 0,
      customerDetailsRequired: counts.CUSTOMER_DETAILS_REQUIRED || counts.NEW || 0,
      paid: counts.PAID || 0,
      waitingForPacking: counts.SENT_TO_LOGISTICS || 0,
      packing: counts.PACKING || 0,
      readyForCarrier: (counts.LABEL_CREATED || 0) + (counts.READY_FOR_PICKUP || 0),
      shipped: (counts.HANDED_TO_CARRIER || 0) + (counts.IN_TRANSIT || 0),
      delivered: counts.DELIVERED || 0,
      problemOrders: problem,
      byStatus: counts,
    };
  }

  async dashboardFinancials(from?: Date, to?: Date) {
    const where = this.dateWhere(from, to);
    const paid = await this.prisma.storeShipmentRequest.findMany({
      where: { ...where, status: { in: [...PAID_STATUSES] } },
      select: {
        totalCustomerCharge: true,
        totalCarrierCost: true,
        totalPackagingCost: true,
        groups: { select: { id: true } },
      },
    });
    const revenue = paid.reduce((s, r) => s + Number(r.totalCustomerCharge || 0), 0);
    const carrier = paid.reduce((s, r) => s + Number(r.totalCarrierCost || 0), 0);
    const packaging = paid.reduce((s, r) => s + Number(r.totalPackagingCost || 0), 0);
    const boxes = paid.reduce((s, r) => s + r.groups.length, 0);
    return {
      shippingRevenue: round2(revenue),
      actualCarrierCost: round2(carrier),
      packagingCost: round2(packaging),
      profit: round2(revenue - carrier - packaging),
      averageShippingCost: paid.length ? round2(carrier / paid.length) : 0,
      averageBoxesPerOrder: paid.length ? round2(boxes / paid.length) : 0,
      paidOrders: paid.length,
    };
  }

  async dashboardOperations(from?: Date, to?: Date) {
    const where = this.dateWhere(from, to);
    const rows = await this.prisma.storeShipmentRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        receivedAt: true,
        updatedAt: true,
        groups: { select: { packedAt: true, labelCreatedAt: true } },
      },
    });
    const now = Date.now();
    const counterTimes: number[] = [];
    const packTimes: number[] = [];
    for (const r of rows) {
      if (PAID_STATUSES.has(r.status)) {
        counterTimes.push((r.updatedAt.getTime() - r.createdAt.getTime()) / 60000);
      }
      const packedAt = r.groups.map((g) => g.packedAt).find(Boolean);
      if (r.receivedAt && packedAt) {
        packTimes.push((packedAt.getTime() - r.receivedAt.getTime()) / 60000);
      }
    }
    const waiting = rows.filter((r) =>
      ['PAID', 'SENT_TO_LOGISTICS', 'PACKING', 'CUSTOMER_DETAILS_REQUIRED', 'AWAITING_PAYMENT'].includes(r.status),
    );
    return {
      averageCounterMinutes: avg(counterTimes),
      averagePackingMinutes: avg(packTimes),
      waitingOver30Min: waiting.filter((r) => now - r.updatedAt.getTime() > 30 * 60000).length,
      waitingOver2Hours: waiting.filter((r) => now - r.updatedAt.getTime() > 120 * 60000).length,
      missingItemAlerts: rows.filter((r) => r.status === 'ITEM_MISSING').length,
      addressProblems: rows.filter((r) => r.status === 'ADDRESS_ISSUE').length,
      labelErrors: rows.filter((r) => r.status === 'PAYMENT_ISSUE' || r.status === 'LOST_CARRIER_ISSUE').length,
    };
  }

  lookupUrl(storeId: string) {
    const base = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/ship/lookup?store=${storeId}`;
  }

  private pickPreferredRate(rates: RateResponse[], serviceCode?: string) {
    if (serviceCode) {
      return rates.find((r) => r.serviceCode === serviceCode) || rates[0];
    }
    for (const carrier of PREFERRED_CARRIERS) {
      const matches = rates.filter((r) =>
        `${r.metadata?.carrier || ''} ${r.serviceName || ''}`.toLowerCase().includes(carrier.toLowerCase()),
      );
      if (matches.length) return [...matches].sort((a, b) => a.rate - b.rate)[0];
    }
    return [...rates].sort((a, b) => a.rate - b.rate)[0];
  }

  private nextAction(order: {
    status: string;
    userId?: string | null;
    groups: Array<{ boxSizeId?: string | null; status: string }>;
    customerName?: string | null;
  }) {
    if (!order.userId) return 'LOGIN';
    if (!order.customerName) return 'COMPLETE_PROFILE';
    if (!order.groups.length) return 'ASSIGN_ITEMS';
    if (order.groups.some((g) => !g.boxSizeId) || order.status === 'CUSTOMER_DETAILS_REQUIRED') {
      return 'STAFF_QUOTE';
    }
    if (order.status === 'AWAITING_PAYMENT') {
      return this.featureFlags.isEnabled(FeatureFlag.SHIPPING_ONLINE_PAYMENT)
        ? 'PAY'
        : 'STAFF_CONFIRM_PAYMENT';
    }
    if (order.status === 'PAID') return 'SEND_TO_LOGISTICS';
    if (order.status === 'PACKING' || order.status === 'SENT_TO_LOGISTICS') return 'PACK';
    if (order.status === 'PACKED') return 'GENERATE_LABEL';
    if (order.status === 'LABEL_CREATED') return 'VERIFY_LABEL';
    if (order.status === 'READY_FOR_PICKUP') return 'CARRIER_PICKUP';
    return order.status;
  }

  private formatDest(snapshot: unknown) {
    const d = (snapshot || {}) as Record<string, string>;
    return [d.street, d.city, d.postalCode, d.country].filter(Boolean).join(', ');
  }

  private dateWhere(from?: Date, to?: Date) {
    if (!from && !to) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { createdAt: { gte: start } };
    }
    return {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
  }

  private async requireCustomerOrder(shipmentId: string, userId: string, include?: object) {
    const order = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: include as never,
    });
    if (!order) throw new NotFoundException('Shipping order not found');
    if (order.userId && order.userId !== userId) throw new ForbiddenException('Not your shipping order');
    if (!order.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      const userEmail = (user?.email || '').toLowerCase();
      const claimEmail = (order.claimEmail || '').toLowerCase();
      if (claimEmail) {
        if (!userEmail) {
          throw new ForbiddenException('Your account has no email — cannot verify ownership of this shipping order');
        }
        if (userEmail !== claimEmail) {
          throw new ForbiddenException('Your email does not match this shipping order');
        }
      }
      await this.prisma.storeShipmentRequest.update({ where: { id: shipmentId }, data: { userId } });
    }
    return order;
  }

  private async requireStaffOrder(shipmentId: string, staff: { storeId?: string; role?: string }, include?: object) {
    const order = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: include as never,
    });
    if (!order) throw new NotFoundException('Shipping order not found');
    if (staff.role !== 'ADMIN') {
      if (!staff.storeId) throw new ForbiddenException('Store context required');
      if (order.storeId !== staff.storeId) throw new ForbiddenException('This order belongs to another store');
    }
    return order;
  }

  private async loadStaffGroup(groupId: string, staff: { storeId?: string; role?: string }) {
    const group = await this.prisma.shipmentGroup.findUnique({
      where: { id: groupId },
      include: {
        items: true,
        boxSize: true,
        shippingOrder: {
          include: { store: true },
        },
      },
    });
    if (!group) throw new NotFoundException('Shipment group not found');
    if (staff.role !== 'ADMIN') {
      if (!staff.storeId) throw new ForbiddenException('Store context required');
      if (group.shippingOrder.storeId !== staff.storeId) throw new ForbiddenException('This order belongs to another store');
    }
    return group;
  }

  private async syncParentPackStatus(shippingOrderId: string) {
    const groups = await this.prisma.shipmentGroup.findMany({ where: { shippingOrderId } });
    if (groups.length && groups.every((g) => ['PACKED', 'LABEL_CREATED', 'READY_FOR_PICKUP'].includes(g.status))) {
      await this.prisma.storeShipmentRequest.update({
        where: { id: shippingOrderId },
        data: { status: 'PACKED' },
      });
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return round2(values.reduce((s, v) => s + v, 0) / values.length);
}

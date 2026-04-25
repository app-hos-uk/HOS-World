import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { MarketingEventBus } from '../journeys/marketing-event.bus';
import { LoyaltyEarnEngine } from '../loyalty/engines/earn.engine';
import { CreateClickCollectDto } from './dto/create-click-collect.dto';

const ACTIVE_CC = ['PENDING', 'PREPARING', 'READY'] as const;

@Injectable()
export class ClickCollectService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private config: ConfigService,
    private marketingBus: MarketingEventBus,
    @Inject(forwardRef(() => LoyaltyEarnEngine))
    private earnEngine: LoyaltyEarnEngine,
  ) {}

  private expiryHours(): number {
    return Number(this.config.get('CC_EXPIRY_HOURS', 72));
  }

  private bonusPoints(): number {
    return Number(this.config.get('CC_BONUS_POINTS', 0));
  }

  private reminderHoursBefore(): number {
    return Number(this.config.get('CC_REMINDER_HOURS_BEFORE', 24));
  }

  async findBestInventoryLocationId(storeId: string, productId: string): Promise<string | null> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return null;

    const locations = await this.prisma.inventoryLocation.findMany({
      where: {
        productId,
        warehouse: { isActive: true, country: store.country },
      },
      include: {
        warehouse: true,
        stockReservations: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        },
      },
    });

    let best: { id: string; avail: number } | null = null;
    for (const loc of locations) {
      const reserved = loc.stockReservations.reduce((s, r) => s + r.quantity, 0);
      const avail = loc.quantity - reserved;
      if (avail <= 0) continue;
      if (!best || avail > best.avail) {
        best = { id: loc.id, avail };
      }
    }
    return best?.id ?? null;
  }

  async createClickCollect(userId: string, dto: CreateClickCollectDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId, parentOrderId: null, deletedAt: null },
      include: { items: true, clickCollect: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestException('Order must be paid before click & collect setup');
    }
    if (order.clickCollect) {
      throw new BadRequestException('Click & collect already exists for this order');
    }

    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const expiresAt = new Date(Date.now() + this.expiryHours() * 3600 * 1000);
    const estimatedReady = dto.estimatedReady ? new Date(dto.estimatedReady) : null;

    let created: Awaited<ReturnType<typeof this.prisma.clickCollectOrder.create>>;
    try {
      const unreservable: string[] = [];
      for (const item of order.items) {
        const locId = await this.findBestInventoryLocationId(dto.storeId, item.productId);
        if (!locId) {
          unreservable.push(item.productId);
          continue;
        }
        await this.inventory.reserveStock({
          inventoryLocationId: locId,
          orderId: order.id,
          quantity: item.quantity,
          expiresAt: expiresAt.toISOString(),
        });
      }
      if (unreservable.length > 0) {
        await this.releaseStockForOrder(order.id);
        throw new BadRequestException(
          `Insufficient stock at this store for ${unreservable.length} product(s)`,
        );
      }

      created = await this.prisma.clickCollectOrder.create({
        data: {
          orderId: order.id,
          storeId: dto.storeId,
          status: 'PENDING',
          estimatedReady,
          expiresAt,
          notes: dto.notes?.trim() || null,
        },
        include: { store: true, order: { select: { orderNumber: true } } },
      });
    } catch (e) {
      await this.releaseStockForOrder(order.id);
      throw e;
    }

    try {
      await this.earnEngine.applyDeferredClickCollectBonus(order.id);
    } catch {
      /* loyalty bonus is best-effort; reservation and C&C order are intact */
    }
    return created;
  }

  async listMine(userId: string) {
    return this.prisma.clickCollectOrder.findMany({
      where: {
        order: { userId },
        status: { in: [...ACTIVE_CC] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
            country: true,
            latitude: true,
            longitude: true,
            operatingHours: true,
          },
        },
        order: { select: { id: true, orderNumber: true, total: true, status: true } },
      },
    });
  }

  async getEligibleStores(productIds: string[], opts?: { verifyInventory?: boolean }) {
    const ids = [...new Set(productIds.filter(Boolean))];
    if (ids.length === 0) {
      return this.prisma.store.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          country: true,
          latitude: true,
          longitude: true,
          defaultRegionCode: true,
        },
      });
    }

    const channels = await this.prisma.productChannel.findMany({
      where: {
        productId: { in: ids },
        channelType: 'STORE',
        isActive: true,
        storeId: { not: null },
      },
      select: { storeId: true, productId: true },
    });

    const byStore = new Map<string, Set<string>>();
    for (const ch of channels) {
      if (!ch.storeId) continue;
      if (!byStore.has(ch.storeId)) byStore.set(ch.storeId, new Set());
      byStore.get(ch.storeId)!.add(ch.productId);
    }

    const eligibleIds = [...byStore.entries()]
      .filter(([, set]) => ids.every((pid) => set.has(pid)))
      .map(([sid]) => sid);

    if (!eligibleIds.length) return [];

    let stores = await this.prisma.store.findMany({
      where: { id: { in: eligibleIds }, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        defaultRegionCode: true,
        currency: true,
      },
    });

    if (opts?.verifyInventory) {
      const filtered: typeof stores = [];
      for (const s of stores) {
        let ok = true;
        for (const pid of ids) {
          const locId = await this.findBestInventoryLocationId(s.id, pid);
          if (!locId) {
            ok = false;
            break;
          }
        }
        if (ok) filtered.push(s);
      }
      stores = filtered;
    }

    return stores;
  }

  async adminList(filters: { storeId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.status) where.status = filters.status;
    return this.prisma.clickCollectOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        store: { select: { id: true, name: true, code: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            status: true,
            paymentStatus: true,
            total: true,
          },
        },
      },
    });
  }

  async adminGet(id: string) {
    const row = await this.prisma.clickCollectOrder.findUnique({
      where: { id },
      include: {
        store: true,
        order: { include: { items: { include: { product: { select: { id: true, name: true } } } } } },
      },
    });
    if (!row) throw new NotFoundException('Click & collect order not found');
    return row;
  }

  private async releaseStockForOrder(orderId: string) {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
    });
    for (const r of reservations) {
      try {
        await this.inventory.cancelReservation(r.id);
      } catch {
        /* ignore */
      }
    }
  }

  async markPreparing(id: string) {
    const row = await this.adminGet(id);
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING orders can move to PREPARING');
    }
    return this.prisma.clickCollectOrder.update({
      where: { id },
      data: { status: 'PREPARING' },
    });
  }

  async markReady(id: string) {
    const row = await this.adminGet(id);
    if (!['PENDING', 'PREPARING'].includes(row.status)) {
      throw new BadRequestException('Order cannot be marked ready from this status');
    }
    const updated = await this.prisma.clickCollectOrder.update({
      where: { id },
      data: {
        status: 'READY',
        readyAt: new Date(),
        notifiedAt: new Date(),
      },
    });
    await this.marketingBus.emit('CLICK_COLLECT_READY', row.order.userId, {
      orderId: row.orderId,
      storeId: row.storeId,
      clickCollectId: id,
    });
    return updated;
  }

  async markCollected(id: string, staffUserId?: string) {
    const row = await this.adminGet(id);
    if (row.status !== 'READY') {
      throw new BadRequestException('Order must be READY before collection');
    }
    const updated = await this.prisma.clickCollectOrder.update({
      where: { id },
      data: {
        status: 'COLLECTED',
        collectedAt: new Date(),
        collectedBy: staffUserId ?? null,
      },
    });

    const order = await this.prisma.order.findUnique({
      where: { id: row.orderId },
      select: { loyaltyPointsEarned: true },
    });
    if (order && order.loyaltyPointsEarned === 0) {
      await this.earnEngine.processOrderComplete(row.orderId);
    }

    return updated;
  }

  async cancelClickCollect(id: string) {
    const row = await this.adminGet(id);
    if (['COLLECTED', 'CANCELLED', 'EXPIRED'].includes(row.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }
    await this.releaseStockForOrder(row.orderId);
    return this.prisma.clickCollectOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async expireStaleOrders(): Promise<number> {
    const now = new Date();
    const stale = await this.prisma.clickCollectOrder.findMany({
      where: {
        status: { in: [...ACTIVE_CC] },
        expiresAt: { lt: now },
      },
    });
    for (const cc of stale) {
      await this.releaseStockForOrder(cc.orderId);
      await this.prisma.clickCollectOrder.update({
        where: { id: cc.id },
        data: { status: 'EXPIRED' },
      });
    }
    return stale.length;
  }

  async sendPickupReminders(): Promise<number> {
    const now = new Date();
    const windowMs = this.reminderHoursBefore() * 3600 * 1000;
    const soon = new Date(now.getTime() + windowMs);
    const rows = await this.prisma.clickCollectOrder.findMany({
      where: {
        status: 'READY',
        expiresAt: { lte: soon, gt: now },
        reminderNotifiedAt: null,
      },
    });
    for (const row of rows) {
      const order = await this.prisma.order.findUnique({
        where: { id: row.orderId },
        select: { userId: true },
      });
      if (order?.userId) {
        await this.marketingBus.emit('CLICK_COLLECT_REMINDER', order.userId, {
          clickCollectId: row.id,
          orderId: row.orderId,
          storeId: row.storeId,
        });
      }
      await this.prisma.clickCollectOrder.update({
        where: { id: row.id },
        data: { reminderNotifiedAt: new Date() },
      });
    }
    return rows.length;
  }

  async getStoreAvailability(storeId: string) {
    const counts = await this.prisma.clickCollectOrder.groupBy({
      by: ['status'],
      where: { storeId, status: { in: [...ACTIVE_CC] } },
      _count: { id: true },
    });
    const out: Record<string, number> = {};
    for (const c of counts) {
      out[c.status] = c._count.id;
    }
    return { storeId, byStatus: out };
  }
}

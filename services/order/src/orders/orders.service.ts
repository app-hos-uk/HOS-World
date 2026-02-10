import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventBusService, ORDER_EVENTS } from '@hos-marketplace/events';
import { OrderPrismaService } from '../database/prisma.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private prisma: OrderPrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(userId: string, query: { page?: number; limit?: number; status?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const where: any = { userId };
    if (query.status) where.status = query.status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({ where, skip: (page - 1) * limit, take: limit, include: { items: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;
    const order = await this.prisma.order.findFirst({ where, include: { items: true, returnRequests: true } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(userId: string, data: any) {
    const orderNumber = `HOS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const order = await this.prisma.order.create({
      data: { ...data, userId, orderNumber },
      include: { items: true },
    });

    // Emit order.order.created event
    try {
      this.eventBus.emit(ORDER_EVENTS.CREATED, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        userEmail: data.userEmail || '',
        sellerId: data.sellerId || '',
        items: (order.items || []).map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: Number(item.price || 0),
        })),
        total: Number(order.total || 0),
        currency: order.currency || 'GBP',
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit order.created event: ${e?.message}`);
    }

    return order;
  }

  async updateStatus(id: string, status: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    const oldStatus = order.status;
    const updated = await this.prisma.order.update({ where: { id }, data: { status } });

    // Emit order status changed event
    try {
      const eventType = status === 'CANCELLED' ? ORDER_EVENTS.CANCELLED : ORDER_EVENTS.STATUS_CHANGED;
      this.eventBus.emit(eventType, {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        oldStatus,
        newStatus: status,
        userId: updated.userId,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit order status event: ${e?.message}`);
    }

    return updated;
  }
}

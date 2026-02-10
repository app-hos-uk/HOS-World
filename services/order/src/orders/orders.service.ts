import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { OrderPrismaService } from '../database/prisma.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(private prisma: OrderPrismaService) {}

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
    return this.prisma.order.create({
      data: { ...data, userId, orderNumber },
      include: { items: true },
    });
  }

  async updateStatus(id: string, status: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}

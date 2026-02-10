import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminPrismaService } from '../database/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(private prisma: AdminPrismaService) {}

  async create(data: { url: string; events: string[]; secret?: string; sellerId?: string }) {
    return this.prisma.webhook.create({ data });
  }

  async findAll(sellerId?: string) {
    return this.prisma.webhook.findMany({ where: sellerId ? { sellerId } : {}, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const wh = await this.prisma.webhook.findUnique({ where: { id }, include: { deliveries: { take: 10, orderBy: { createdAt: 'desc' } } } });
    if (!wh) throw new NotFoundException('Webhook not found');
    return wh;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.webhook.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.webhook.delete({ where: { id } });
  }
}

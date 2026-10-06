import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SellerMarketService {
  constructor(private prisma: PrismaService) {}

  async findBySeller(sellerId: string) {
    return this.prisma.sellerMarket.findMany({
      where: { sellerId },
      include: { market: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByMarket(marketId: string) {
    return this.prisma.sellerMarket.findMany({
      where: { marketId },
      include: { seller: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assign(sellerId: string, marketId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market not found');

    return this.prisma.sellerMarket.upsert({
      where: { sellerId_marketId: { sellerId, marketId } },
      create: { sellerId, marketId, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
      include: { market: true },
    });
  }

  async remove(sellerId: string, marketId: string) {
    const existing = await this.prisma.sellerMarket.findUnique({
      where: { sellerId_marketId: { sellerId, marketId } },
    });
    if (!existing) throw new NotFoundException('Seller market assignment not found');
    return this.prisma.sellerMarket.delete({
      where: { id: existing.id },
    });
  }

  async updateStatus(sellerId: string, marketId: string, status: string) {
    const validStatuses = ['ACTIVE', 'PENDING', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Status must be one of: ${validStatuses.join(', ')}`);
    }
    const existing = await this.prisma.sellerMarket.findUnique({
      where: { sellerId_marketId: { sellerId, marketId } },
    });
    if (!existing) throw new NotFoundException('Seller market assignment not found');
    return this.prisma.sellerMarket.update({
      where: { id: existing.id },
      data: { status },
      include: { market: true },
    });
  }

  async bulkAssign(sellerIds: string[], marketId: string) {
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market not found');

    const results = [];
    for (const sellerId of sellerIds) {
      const result = await this.prisma.sellerMarket.upsert({
        where: { sellerId_marketId: { sellerId, marketId } },
        create: { sellerId, marketId, status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      results.push(result);
    }
    return results;
  }
}

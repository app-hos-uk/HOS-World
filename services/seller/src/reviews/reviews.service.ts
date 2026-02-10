import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SellerPrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private prisma: SellerPrismaService) {}

  async create(data: { productId: string; userId: string; sellerId?: string; rating: number; title?: string; comment?: string }) {
    return this.prisma.productReview.create({ data });
  }

  async findByProduct(productId: string) {
    return this.prisma.productReview.findMany({
      where: { productId, isApproved: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySeller(sellerId: string) {
    return this.prisma.productReview.findMany({
      where: { sellerId, isApproved: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string) {
    return this.prisma.productReview.update({ where: { id }, data: { isApproved: true } });
  }

  async remove(id: string) {
    return this.prisma.productReview.delete({ where: { id } });
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SellerPrismaService } from '../database/prisma.service';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(private prisma: SellerPrismaService) {}

  async create(sellerId: string, data: { productName: string; productData?: any }) {
    return this.prisma.productSubmission.create({
      data: { sellerId, productName: data.productName, productData: data.productData, status: 'PENDING' },
    });
  }

  async findAll(sellerId?: string, status?: string) {
    const where: any = {};
    if (sellerId) where.sellerId = sellerId;
    if (status) where.status = status;
    return this.prisma.productSubmission.findMany({
      where,
      include: { seller: { select: { id: true, storeName: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sub = await this.prisma.productSubmission.findUnique({
      where: { id },
      include: { seller: { select: { id: true, storeName: true, slug: true } } },
    });
    if (!sub) throw new NotFoundException('Submission not found');
    return sub;
  }

  async approve(id: string, reviewedBy: string, reviewNotes?: string) {
    const sub = await this.findOne(id);
    if (sub.status !== 'PENDING') throw new BadRequestException('Submission is not pending');
    return this.prisma.productSubmission.update({
      where: { id },
      data: { status: 'PROCUREMENT_APPROVED', reviewedBy, reviewNotes, reviewedAt: new Date() },
    });
  }

  async reject(id: string, reviewedBy: string, reviewNotes?: string) {
    const sub = await this.findOne(id);
    if (sub.status !== 'PENDING') throw new BadRequestException('Submission is not pending');
    return this.prisma.productSubmission.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy, reviewNotes, reviewedAt: new Date() },
    });
  }
}

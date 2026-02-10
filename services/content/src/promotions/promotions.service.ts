import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ContentPrismaService } from '../database/prisma.service';

@Injectable()
export class PromotionsService {
  constructor(private prisma: ContentPrismaService) {}

  async create(data: any) {
    return this.prisma.promotion.create({ data: { ...data, isActive: data.isActive ?? true } });
  }

  async findAll(activeOnly = true) {
    return this.prisma.promotion.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: { coupons: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id }, include: { coupons: true } });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.promotion.update({ where: { id }, data });
  }

  async createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
  }

  async validateCoupon(code: string, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code }, include: { promotion: true } });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Invalid or inactive coupon');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BadRequestException('Coupon expired');
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) throw new BadRequestException('Coupon usage limit reached');

    const alreadyUsed = await this.prisma.couponUsage.findFirst({ where: { couponId: coupon.id, userId } });
    if (alreadyUsed) throw new BadRequestException('Coupon already used');

    return { valid: true, coupon };
  }

  async applyCoupon(code: string, userId: string, orderId?: string) {
    const { coupon } = await this.validateCoupon(code, userId);
    await this.prisma.couponUsage.create({ data: { couponId: coupon.id, userId, orderId } });
    await this.prisma.coupon.update({ where: { id: coupon.id }, data: { currentUses: { increment: 1 } } });
    return coupon;
  }
}

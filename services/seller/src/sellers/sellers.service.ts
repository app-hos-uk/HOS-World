import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SellerPrismaService } from '../database/prisma.service';

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(private prisma: SellerPrismaService) {}

  async findOne(userId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return {
      ...seller,
      accountNumberLast4: seller.accountNumberEnc ? seller.accountNumberEnc.slice(-4) : null,
      sortCodeLast4: seller.sortCodeEnc ? seller.sortCodeEnc.slice(-4) : null,
      accountNumberEnc: undefined,
      sortCodeEnc: undefined,
    };
  }

  async findAllPublic() {
    return this.prisma.seller.findMany({
      select: {
        id: true, userId: true, storeName: true, slug: true, description: true,
        logo: true, country: true, city: true, region: true, rating: true,
        totalSales: true, sellerType: true, verified: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    let seller = await this.prisma.seller.findUnique({ where: { slug } });
    if (!seller) {
      seller = await this.prisma.seller.findFirst({ where: { subDomain: slug } });
    }
    if (!seller) throw new NotFoundException('Seller not found');
    return { ...seller, accountNumberEnc: undefined, sortCodeEnc: undefined };
  }

  async update(userId: string, data: any) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return this.prisma.seller.update({ where: { userId }, data });
  }

  async updateDomain(userId: string, customDomain?: string, subDomain?: string, domainPackagePurchased?: boolean) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return this.prisma.seller.update({ where: { userId }, data: { customDomain, subDomain, domainPackagePurchased } });
  }
}

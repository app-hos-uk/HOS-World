import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerType, LogisticsOption } from '@prisma/client';
import { slugify } from '@hos-marketplace/utils';

@Injectable()
export class SellersService {
  constructor(private prisma: PrismaService) {}

  async findMyProducts(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { order: 'asc' }, take: 1 },
      },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      price: Number(p.price),
      stock: p.stock,
      images: p.images?.map((i) => i.url) ?? [],
      createdAt: p.createdAt.toISOString(),
      category: p.category ?? undefined,
      fandom: p.fandom ?? undefined,
    }));
  }

  async findOne(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    // Mask sensitive bank details in response
    return {
      ...seller,
      accountNumberLast4: seller.accountNumberEnc ? seller.accountNumberEnc.slice(-4) : null,
      sortCodeLast4: seller.sortCodeEnc ? seller.sortCodeEnc.slice(-4) : null,
      accountNumberEnc: undefined,
      sortCodeEnc: undefined,
    };
  }

  async findAllPublic() {
    const sellers = await this.prisma.seller.findMany({
      select: {
        id: true,
        userId: true,
        storeName: true,
        slug: true,
        description: true,
        logo: true,
        country: true,
        city: true,
        region: true,
        rating: true,
        totalSales: true,
        sellerType: true,
        verified: true,
        createdAt: true,
        user: {
          select: {
            avatar: true,
          },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sellers;
  }

  async findBySlug(slug: string) {
    // First try exact slug match
    let seller = await this.prisma.seller.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    // Fallback: try matching by subDomain field (subdomain may differ from slug
    // due to DNS-safe character stripping, e.g. slug "my_store" → subDomain "my-store")
    if (!seller) {
      seller = await this.prisma.seller.findFirst({
        where: { subDomain: slug },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              avatar: true,
            },
          },
          _count: {
            select: { products: true },
          },
        },
      });
    }

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Return public-safe seller data (strip sensitive bank fields)
    return {
      ...seller,
      accountNumberEnc: undefined,
      sortCodeEnc: undefined,
    };
  }

  async update(userId: string, updateSellerDto: UpdateSellerDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    // Build update data, excluding nested objects and sensitive fields that need special handling
    const { warehouseAddress, accountNumber, sortCode, ...restDto } = updateSellerDto;
    const updateData: any = { ...restDto };

    // Handle bank account fields - store encrypted
    // TODO: Implement proper encryption for production
    if (accountNumber) {
      updateData.accountNumberEnc = accountNumber; // In production, encrypt this
    }
    if (sortCode) {
      updateData.sortCodeEnc = sortCode; // In production, encrypt this
    }

    // If updating slug (via storeName), ensure uniqueness
    if (updateSellerDto.storeName && updateSellerDto.storeName !== seller.storeName) {
      const baseSlug = slugify(updateSellerDto.storeName);
      let slug = baseSlug;
      let counter = 1;

      while (await this.prisma.seller.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updateData.slug = slug;
    }

    const updated = await this.prisma.seller.update({
      where: { userId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    });

    // Mask sensitive data in response
    return {
      ...updated,
      accountNumberLast4: updated.accountNumberEnc ? updated.accountNumberEnc.slice(-4) : null,
      sortCodeLast4: updated.sortCodeEnc ? updated.sortCodeEnc.slice(-4) : null,
      accountNumberEnc: undefined,
      sortCodeEnc: undefined,
    };
  }

  async updateSellerType(userId: string, sellerType: SellerType) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.prisma.seller.update({
      where: { userId },
      data: { sellerType },
    });
  }

  async updateLogisticsOption(userId: string, logisticsOption: LogisticsOption) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.prisma.seller.update({
      where: { userId },
      data: { logisticsOption },
    });
  }

  async updateDomain(
    userId: string,
    customDomain?: string,
    subDomain?: string,
    domainPackagePurchased?: boolean,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.prisma.seller.update({
      where: { userId },
      data: {
        customDomain,
        subDomain,
        domainPackagePurchased,
      },
    });
  }
}

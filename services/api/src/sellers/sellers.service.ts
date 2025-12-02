import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerType, LogisticsOption } from '@prisma/client';

@Injectable()
export class SellersService {
  constructor(private prisma: PrismaService) {}

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

    return seller;
  }

  async findBySlug(slug: string) {
    const seller = await this.prisma.seller.findUnique({
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
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }

  async update(userId: string, updateSellerDto: UpdateSellerDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    // If updating slug (via storeName), ensure uniqueness
    if (updateSellerDto.storeName && updateSellerDto.storeName !== seller.storeName) {
      const baseSlug = this.slugify(updateSellerDto.storeName);
      let slug = baseSlug;
      let counter = 1;

      while (await this.prisma.seller.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      return this.prisma.seller.update({
        where: { userId },
        data: {
          ...updateSellerDto,
          slug,
        },
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
    }

    return this.prisma.seller.update({
      where: { userId },
      data: updateSellerDto,
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

  async updateDomain(userId: string, customDomain?: string, subDomain?: string, domainPackagePurchased?: boolean) {
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

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}


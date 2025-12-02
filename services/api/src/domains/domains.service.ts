import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  AssignCustomDomainDto,
  CreateSubDomainDto,
} from './dto/assign-domain.dto';

@Injectable()
export class DomainsService {
  constructor(private prisma: PrismaService) {}

  async getSellerDomains(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        userId: true,
        storeName: true,
        slug: true,
        customDomain: true,
        subDomain: true,
        domainPackagePurchased: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }

  async getSellerDomainsByUserId(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        storeName: true,
        slug: true,
        customDomain: true,
        subDomain: true,
        domainPackagePurchased: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return seller;
  }

  async assignCustomDomain(
    sellerId: string,
    assignDto: AssignCustomDomainDto,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Check if domain is already assigned to another seller
    const existingSeller = await this.prisma.seller.findFirst({
      where: {
        customDomain: assignDto.customDomain,
        id: { not: sellerId },
      },
    });

    if (existingSeller) {
      throw new ConflictException('This domain is already assigned to another seller');
    }

    // Validate domain format (basic validation)
    if (!this.isValidDomain(assignDto.customDomain)) {
      throw new BadRequestException('Invalid domain format');
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        customDomain: assignDto.customDomain,
        domainPackagePurchased: assignDto.domainPackagePurchased ?? true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // TODO: Generate DNS configuration documentation

    return updated;
  }

  async createSubDomain(sellerId: string, createDto: CreateSubDomainDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Check if sub-domain is already taken
    const existingSeller = await this.prisma.seller.findFirst({
      where: {
        subDomain: createDto.subDomain,
        id: { not: sellerId },
      },
    });

    if (existingSeller) {
      throw new ConflictException('This sub-domain is already taken');
    }

    // Validate sub-domain format
    if (!this.isValidSubDomain(createDto.subDomain)) {
      throw new BadRequestException('Invalid sub-domain format');
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        subDomain: createDto.subDomain,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  async removeCustomDomain(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        customDomain: null,
        domainPackagePurchased: false,
      },
    });

    return updated;
  }

  async removeSubDomain(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        subDomain: null,
      },
    });

    return updated;
  }

  async getDomainPackages() {
    // Return available domain packages
    // This could be stored in database or configuration
    return [
      {
        id: 'basic',
        name: 'Basic Domain Package',
        price: 29.99,
        features: ['Custom domain', 'SSL certificate', 'Basic DNS management'],
      },
      {
        id: 'premium',
        name: 'Premium Domain Package',
        price: 49.99,
        features: [
          'Custom domain',
          'SSL certificate',
          'Advanced DNS management',
          'Email forwarding',
          'Priority support',
        ],
      },
    ];
  }

  async getDNSConfiguration(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        customDomain: true,
        subDomain: true,
        slug: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    if (!seller.customDomain && !seller.subDomain) {
      throw new BadRequestException('No domain configured for this seller');
    }

    // Generate DNS configuration documentation
    const baseUrl = process.env.FRONTEND_URL || 'https://houseofspells.com';
    const domain = seller.customDomain || `${seller.subDomain}.houseofspells.com`;

    return {
      domain,
      dnsRecords: [
        {
          type: 'A',
          name: '@',
          value: process.env.DNS_IP || 'YOUR_SERVER_IP',
          ttl: 3600,
        },
        {
          type: 'CNAME',
          name: 'www',
          value: domain,
          ttl: 3600,
        },
        {
          type: 'TXT',
          name: '@',
          value: `hos-verification=${seller.id}`,
          ttl: 3600,
        },
      ],
      instructions: [
        '1. Log in to your domain registrar',
        '2. Navigate to DNS management',
        '3. Add the DNS records listed above',
        '4. Wait for DNS propagation (usually 24-48 hours)',
        '5. Contact support if you need assistance',
      ],
    };
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  private isValidSubDomain(subDomain: string): boolean {
    const subDomainRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/i;
    return subDomainRegex.test(subDomain) && subDomain.length >= 3 && subDomain.length <= 63;
  }
}


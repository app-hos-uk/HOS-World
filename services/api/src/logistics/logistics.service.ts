import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import {
  CreateLogisticsPartnerDto,
  UpdateLogisticsPartnerDto,
} from './dto/create-logistics-partner.dto';

@Injectable()
export class LogisticsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /** Remove the stored carrier apiKey before returning partner data to API clients. */
  private sanitizePartner<T extends { apiKey?: string | null } | null>(partner: T): T {
    if (!partner || typeof partner !== 'object') return partner;
    const { apiKey, ...rest } = partner as any;
    return { ...rest, hasApiKey: !!apiKey } as T;
  }

  async createPartner(createDto: CreateLogisticsPartnerDto) {
    const data: any = {
      ...createDto,
      contactInfo: createDto.contactInfo as any,
    };
    if (data.apiKey) {
      data.apiKey = this.encryption.encrypt(data.apiKey);
    }
    const partner = await this.prisma.logisticsPartner.create({ data });
    return this.sanitizePartner(partner);
  }

  async findAllPartners(activeOnly: boolean = false) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const partners = await this.prisma.logisticsPartner.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        shipments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return partners.map((p) => this.sanitizePartner(p));
  }

  async findOnePartner(id: string) {
    const partner = await this.prisma.logisticsPartner.findUnique({
      where: { id },
      include: {
        shipments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Logistics partner not found');
    }

    return this.sanitizePartner(partner);
  }

  async updatePartner(id: string, updateDto: UpdateLogisticsPartnerDto) {
    const partner = await this.prisma.logisticsPartner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException('Logistics partner not found');
    }

    const data: any = {
      ...updateDto,
      contactInfo: updateDto.contactInfo ? (updateDto.contactInfo as any) : undefined,
    };
    if (data.apiKey) {
      if (this.encryption.isMaskedSecret(data.apiKey)) {
        delete data.apiKey;
      } else {
        data.apiKey = this.encryption.encrypt(data.apiKey);
      }
    }
    const updated = await this.prisma.logisticsPartner.update({ where: { id }, data });
    return this.sanitizePartner(updated);
  }

  async deletePartner(id: string) {
    const partner = await this.prisma.logisticsPartner.findUnique({
      where: { id },
      include: {
        shipments: true,
      },
    });

    if (!partner) {
      throw new NotFoundException('Logistics partner not found');
    }

    if (partner.shipments.length > 0) {
      throw new BadRequestException('Cannot delete logistics partner with active shipments');
    }

    return this.prisma.logisticsPartner.delete({
      where: { id },
    });
  }

  async assignPartnerToShipment(shipmentId: string, partnerId: string) {
    const [shipment, partner] = await Promise.all([
      this.prisma.shipment.findUnique({
        where: { id: shipmentId },
      }),
      this.prisma.logisticsPartner.findUnique({
        where: { id: partnerId },
      }),
    ]);

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (!partner) {
      throw new NotFoundException('Logistics partner not found');
    }

    if (!partner.isActive) {
      throw new BadRequestException('Logistics partner is not active');
    }

    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        logisticsPartnerId: partnerId,
      },
      include: {
        logisticsPartner: true,
      },
    });
  }
}

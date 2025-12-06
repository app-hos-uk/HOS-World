import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateLogisticsPartnerDto, UpdateLogisticsPartnerDto } from './dto/create-logistics-partner.dto';

@Injectable()
export class LogisticsService {
  constructor(private prisma: PrismaService) {}

  async createPartner(createDto: CreateLogisticsPartnerDto) {
    return this.prisma.logisticsPartner.create({
      data: createDto,
    });
  }

  async findAllPartners(activeOnly: boolean = false) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    return this.prisma.logisticsPartner.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        shipments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
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

    return partner;
  }

  async updatePartner(id: string, updateDto: UpdateLogisticsPartnerDto) {
    const partner = await this.prisma.logisticsPartner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException('Logistics partner not found');
    }

    return this.prisma.logisticsPartner.update({
      where: { id },
      data: updateDto,
    });
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
      throw new BadRequestException(
        'Cannot delete logistics partner with active shipments',
      );
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



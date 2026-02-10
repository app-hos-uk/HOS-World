import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryPrismaService } from '../database/prisma.service';

@Injectable()
export class LogisticsService {
  constructor(private prisma: InventoryPrismaService) {}

  async createPartner(data: any) {
    return this.prisma.logisticsPartner.create({ data: { ...data, contactInfo: data.contactInfo as any } });
  }

  async findAllPartners(activeOnly = false) {
    return this.prisma.logisticsPartner.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
      include: { shipments: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
  }

  async findOnePartner(id: string) {
    const partner = await this.prisma.logisticsPartner.findUnique({
      where: { id },
      include: { shipments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!partner) throw new NotFoundException('Logistics partner not found');
    return partner;
  }

  async updatePartner(id: string, data: any) {
    await this.findOnePartner(id);
    return this.prisma.logisticsPartner.update({
      where: { id },
      data: { ...data, contactInfo: data.contactInfo ? (data.contactInfo as any) : undefined },
    });
  }

  async deletePartner(id: string) {
    const partner = await this.prisma.logisticsPartner.findUnique({
      where: { id },
      include: { shipments: true },
    });
    if (!partner) throw new NotFoundException('Logistics partner not found');
    if (partner.shipments.length > 0) {
      throw new BadRequestException('Cannot delete partner with active shipments');
    }
    return this.prisma.logisticsPartner.delete({ where: { id } });
  }

  async assignPartnerToShipment(shipmentId: string, partnerId: string) {
    const [shipment, partner] = await Promise.all([
      this.prisma.shipment.findUnique({ where: { id: shipmentId } }),
      this.prisma.logisticsPartner.findUnique({ where: { id: partnerId } }),
    ]);
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!partner) throw new NotFoundException('Logistics partner not found');
    if (!partner.isActive) throw new BadRequestException('Partner is not active');

    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { logisticsPartnerId: partnerId },
      include: { logisticsPartner: true },
    });
  }
}

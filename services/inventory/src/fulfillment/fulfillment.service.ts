import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InventoryPrismaService } from '../database/prisma.service';

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(private prisma: InventoryPrismaService) {}

  async createFulfillmentCenter(data: any) {
    return this.prisma.fulfillmentCenter.create({ data });
  }

  async findAllFulfillmentCenters(activeOnly = false) {
    return this.prisma.fulfillmentCenter.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
      include: { shipments: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
  }

  async findOneFulfillmentCenter(id: string) {
    const center = await this.prisma.fulfillmentCenter.findUnique({
      where: { id },
      include: { shipments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!center) throw new NotFoundException('Fulfillment center not found');
    return center;
  }

  async updateFulfillmentCenter(id: string, data: any) {
    await this.findOneFulfillmentCenter(id);
    return this.prisma.fulfillmentCenter.update({ where: { id }, data });
  }

  async deleteFulfillmentCenter(id: string) {
    const center = await this.prisma.fulfillmentCenter.findUnique({
      where: { id },
      include: { shipments: true },
    });
    if (!center) throw new NotFoundException('Fulfillment center not found');
    if (center.shipments.length > 0) {
      throw new BadRequestException('Cannot delete with existing shipments');
    }
    await this.prisma.fulfillmentCenter.delete({ where: { id } });
    return { message: 'Deleted successfully' };
  }

  async createShipment(data: {
    submissionId?: string;
    fulfillmentCenterId: string;
    trackingNumber?: string;
  }) {
    await this.findOneFulfillmentCenter(data.fulfillmentCenterId);
    return this.prisma.shipment.create({
      data: { ...data, status: 'PENDING' },
      include: { fulfillmentCenter: true },
    });
  }

  async findAllShipments(status?: string, fulfillmentCenterId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (fulfillmentCenterId) where.fulfillmentCenterId = fulfillmentCenterId;
    return this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { fulfillmentCenter: true, logisticsPartner: true },
    });
  }

  async findOneShipment(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { fulfillmentCenter: true, logisticsPartner: true },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  async verifyShipment(id: string, userId: string, data: { status: string; verificationNotes?: string; trackingNumber?: string }) {
    const shipment = await this.findOneShipment(id);
    if (shipment.status === 'VERIFIED' || shipment.status === 'REJECTED') {
      throw new BadRequestException(`Cannot verify in status: ${shipment.status}`);
    }

    const updateData: any = { status: data.status, verifiedBy: userId };
    if (data.verificationNotes) updateData.verificationNotes = data.verificationNotes;
    if (data.trackingNumber) updateData.trackingNumber = data.trackingNumber;
    if (data.status === 'VERIFIED') updateData.receivedAt = new Date();

    return this.prisma.shipment.update({
      where: { id },
      data: updateData,
      include: { fulfillmentCenter: true },
    });
  }

  async getDashboardStats(fulfillmentCenterId?: string) {
    const where: any = fulfillmentCenterId ? { fulfillmentCenterId } : {};
    const [total, pending, inTransit, received, verified, rejected] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'IN_TRANSIT' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'RECEIVED' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'VERIFIED' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'REJECTED' } }),
    ]);
    return { total, pending, inTransit, received, verified, rejected };
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InventoryPrismaService } from '../database/prisma.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: InventoryPrismaService) {}

  async createWarehouse(data: {
    name: string;
    code: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    contactEmail?: string;
    contactPhone?: string;
    managerName?: string;
    capacity?: number;
    warehouseType?: string;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.warehouse.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException('Warehouse code already exists');

    return this.prisma.warehouse.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAllWarehouses(includeInactive = false) {
    return this.prisma.warehouse.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { inventory: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWarehouseById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async updateWarehouse(id: string, data: Record<string, any>) {
    await this.findWarehouseById(id);
    return this.prisma.warehouse.update({ where: { id }, data });
  }

  async deleteWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { inventory: { take: 1 } },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (warehouse.inventory.length > 0) {
      throw new BadRequestException('Cannot delete warehouse with existing inventory');
    }
    return this.prisma.warehouse.delete({ where: { id } });
  }

  async getProductInventory(productId: string) {
    const locations = await this.prisma.inventoryLocation.findMany({
      where: { productId },
      include: {
        warehouse: true,
        stockReservations: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        },
      },
    });

    let totalQuantity = 0;
    let totalReserved = 0;
    for (const loc of locations) {
      totalQuantity += loc.quantity;
      totalReserved += loc.stockReservations.reduce((s, r) => s + r.quantity, 0);
    }

    return {
      productId,
      locations,
      summary: { totalQuantity, totalReserved, totalAvailable: totalQuantity - totalReserved },
    };
  }

  async reserveStock(data: {
    inventoryLocationId: string;
    quantity: number;
    orderId?: string;
    cartId?: string;
    expiresAt?: string;
  }) {
    const location = await this.prisma.inventoryLocation.findUnique({
      where: { id: data.inventoryLocationId },
      include: {
        stockReservations: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        },
      },
    });
    if (!location) throw new NotFoundException('Inventory location not found');

    const reserved = location.stockReservations.reduce((s, r) => s + r.quantity, 0);
    const available = location.quantity - reserved;
    if (available < data.quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${available}`);
    }

    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const reservation = await this.prisma.stockReservation.create({
      data: {
        inventoryLocationId: location.id,
        orderId: data.orderId,
        cartId: data.cartId,
        quantity: data.quantity,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    await this.prisma.inventoryLocation.update({
      where: { id: location.id },
      data: { reserved: { increment: data.quantity } },
    });

    return reservation;
  }

  async confirmReservation(reservationId: string, orderId: string) {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== 'ACTIVE') throw new BadRequestException('Reservation is not active');

    await this.prisma.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'CONFIRMED', orderId },
    });

    await this.prisma.inventoryLocation.update({
      where: { id: reservation.inventoryLocationId },
      data: {
        quantity: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    });

    return reservation;
  }

  async cancelReservation(reservationId: string) {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== 'ACTIVE') throw new BadRequestException('Cannot cancel');

    await this.prisma.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.inventoryLocation.update({
      where: { id: reservation.inventoryLocationId },
      data: { reserved: { decrement: reservation.quantity } },
    });

    return reservation;
  }

  async getLowStockAlerts(warehouseId?: string) {
    const locations = await this.prisma.inventoryLocation.findMany({
      where: warehouseId ? { warehouseId } : {},
      include: { warehouse: true },
    });
    return locations
      .filter((l) => l.quantity <= l.lowStockThreshold)
      .map((l) => ({
        warehouseId: l.warehouseId,
        warehouse: l.warehouse.name,
        productId: l.productId,
        currentStock: l.quantity,
        threshold: l.lowStockThreshold,
        status: l.quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      }));
  }

  async getInventoryMetrics() {
    const [totalWarehouses, activeWarehouses, totalLocations, totalQuantity] = await Promise.all([
      this.prisma.warehouse.count(),
      this.prisma.warehouse.count({ where: { isActive: true } }),
      this.prisma.inventoryLocation.count(),
      this.prisma.inventoryLocation.aggregate({ _sum: { quantity: true } }),
    ]);

    return {
      totalWarehouses,
      activeWarehouses,
      totalLocations,
      totalQuantity: totalQuantity._sum.quantity || 0,
    };
  }
}

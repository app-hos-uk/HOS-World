import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { CreateStockMovementDto, MovementType } from './dto/create-stock-movement.dto';
import { ReservationStatus, TransferStatus } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new warehouse
   */
  async createWarehouse(createDto: CreateWarehouseDto) {
    // Check if code already exists
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: createDto.code },
    });

    if (existing) {
      throw new BadRequestException('Warehouse code already exists');
    }

    return this.prisma.warehouse.create({
      data: {
        name: createDto.name,
        code: createDto.code.toUpperCase(),
        address: createDto.address,
        city: createDto.city,
        state: createDto.state,
        country: createDto.country,
        postalCode: createDto.postalCode,
        isActive: createDto.isActive ?? true,
      },
    });
  }

  /**
   * Get all warehouses
   */
  async findAllWarehouses(includeInactive = false) {
    return this.prisma.warehouse.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        inventory: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get warehouse by ID
   */
  async findWarehouseById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        inventory: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  /**
   * Create or update inventory location
   */
  async upsertInventoryLocation(createDto: CreateInventoryLocationDto) {
    // Verify warehouse exists
    await this.findWarehouseById(createDto.warehouseId);

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: createDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.inventoryLocation.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: createDto.warehouseId,
          productId: createDto.productId,
        },
      },
      create: {
        warehouseId: createDto.warehouseId,
        productId: createDto.productId,
        quantity: createDto.quantity,
        lowStockThreshold: createDto.lowStockThreshold || 10,
      },
      update: {
        quantity: createDto.quantity,
        lowStockThreshold: createDto.lowStockThreshold,
      },
      include: {
        warehouse: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }

  /**
   * Get inventory for a product across all warehouses
   */
  async getProductInventory(productId: string) {
    const locations = await this.prisma.inventoryLocation.findMany({
      where: { productId },
      include: {
        warehouse: true,
        stockReservations: {
          where: {
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    let totalQuantity = 0;
    let totalReserved = 0;
    let totalAvailable = 0;

    for (const location of locations) {
      totalQuantity += location.quantity;
      const reserved = location.stockReservations.reduce(
        (sum, res) => sum + res.quantity,
        0,
      );
      totalReserved += reserved;
      totalAvailable += location.quantity - reserved;
    }

    return {
      productId,
      locations,
      summary: {
        totalQuantity,
        totalReserved,
        totalAvailable,
      },
    };
  }

  /**
   * Reserve stock for an order or cart
   */
  async reserveStock(reserveDto: ReserveStockDto) {
    const location = await this.prisma.inventoryLocation.findUnique({
      where: {
        id: reserveDto.inventoryLocationId,
      },
      include: {
        stockReservations: {
          where: {
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Inventory location not found');
    }

    // Calculate available stock (quantity - reserved)
    const reserved = location.stockReservations.reduce(
      (sum, res) => sum + res.quantity,
      0,
    );
    const available = location.quantity - reserved;

    if (available < reserveDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${available}, Requested: ${reserveDto.quantity}`,
      );
    }

    // Set expiration (default: 24 hours from now)
    const expiresAt = reserveDto.expiresAt
      ? new Date(reserveDto.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create reservation
    const reservation = await this.prisma.stockReservation.create({
      data: {
        inventoryLocationId: location.id,
        orderId: reserveDto.orderId,
        cartId: reserveDto.cartId,
        quantity: reserveDto.quantity,
        expiresAt,
        status: 'ACTIVE',
      },
      include: {
        inventoryLocation: {
          include: {
            warehouse: true,
            product: true,
          },
        },
      },
    });

    // Update reserved count
    await this.prisma.inventoryLocation.update({
      where: { id: location.id },
      data: {
        reserved: { increment: reserveDto.quantity },
      },
    });

    return reservation;
  }

  /**
   * Confirm reservation (convert to order)
   */
  async confirmReservation(reservationId: string, orderId: string) {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        inventoryLocation: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status !== 'ACTIVE') {
      throw new BadRequestException('Reservation is not active');
    }

    // Update reservation status and link to order
    await this.prisma.stockReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CONFIRMED',
        orderId,
      },
    });

    // Deduct from inventory
    await this.prisma.inventoryLocation.update({
      where: { id: reservation.inventoryLocationId },
      data: {
        quantity: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    });

    return reservation;
  }

  /**
   * Cancel reservation
   */
  async cancelReservation(reservationId: string) {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        inventoryLocation: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status !== 'ACTIVE') {
      throw new BadRequestException('Reservation cannot be cancelled');
    }

    // Update reservation status
    await this.prisma.stockReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CANCELLED',
      },
    });

    // Release reserved stock
    await this.prisma.inventoryLocation.update({
      where: { id: reservation.inventoryLocationId },
      data: {
        reserved: { decrement: reservation.quantity },
      },
    });

    return reservation;
  }

  /**
   * Clean up expired reservations
   */
  async cleanupExpiredReservations() {
    const expired = await this.prisma.stockReservation.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      include: {
        inventoryLocation: true,
      },
    });

    for (const reservation of expired) {
      await this.prisma.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: 'EXPIRED',
        },
      });

      await this.prisma.inventoryLocation.update({
        where: { id: reservation.inventoryLocationId },
        data: {
          reserved: { decrement: reservation.quantity },
        },
      });
    }

    return {
      cleaned: expired.length,
    };
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(warehouseId?: string) {
    const where: any = {
      quantity: {
        lte: this.prisma.inventoryLocation.fields.lowStockThreshold,
      },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const locations = await this.prisma.inventoryLocation.findMany({
      where,
      include: {
        warehouse: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    return locations.map((location) => ({
      warehouse: location.warehouse.name,
      product: location.product.name,
      sku: location.product.sku,
      currentStock: location.quantity,
      threshold: location.lowStockThreshold,
      status: location.quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    }));
  }

  /**
   * Allocate stock for order (auto-select warehouse)
   */
  async allocateStockForOrder(
    orderItems: Array<{ productId: string; quantity: number }>,
  ) {
    const allocations: any[] = [];

    for (const item of orderItems) {
      // Find warehouses with available stock
      const locations = await this.prisma.inventoryLocation.findMany({
        where: {
          productId: item.productId,
          warehouse: { isActive: true },
        },
        include: {
          warehouse: true,
          stockReservations: {
            where: {
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
          },
        },
        orderBy: {
          quantity: 'desc', // Prefer warehouses with more stock
        },
      });

      let remainingQuantity = item.quantity;

      for (const location of locations) {
        if (remainingQuantity <= 0) break;

        const reserved = location.stockReservations.reduce(
          (sum, res) => sum + res.quantity,
          0,
        );
        const available = location.quantity - reserved;

        if (available > 0) {
          const allocateQuantity = Math.min(available, remainingQuantity);
          allocations.push({
            productId: item.productId,
            warehouseId: location.warehouseId,
            warehouseName: location.warehouse.name,
            quantity: allocateQuantity,
            locationId: location.id,
          });
          remainingQuantity -= allocateQuantity;
        }
      }

      if (remainingQuantity > 0) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}. Need ${item.quantity}, only ${item.quantity - remainingQuantity} available.`,
        );
      }
    }

    return allocations;
  }

  /**
   * Transfer stock between warehouses
   */
  async transferStock(createDto: CreateStockTransferDto, requestedBy: string) {
    // Verify warehouses exist and are different
    if (createDto.fromWarehouseId === createDto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    const [fromWarehouse, toWarehouse] = await Promise.all([
      this.findWarehouseById(createDto.fromWarehouseId),
      this.findWarehouseById(createDto.toWarehouseId),
    ]);

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: createDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check source warehouse has enough stock
    const sourceLocation = await this.prisma.inventoryLocation.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: createDto.fromWarehouseId,
          productId: createDto.productId,
        },
      },
    });

    if (!sourceLocation) {
      throw new NotFoundException('Product not found in source warehouse');
    }

    // Check available stock (quantity - reserved)
    const reserved = await this.prisma.stockReservation.count({
      where: {
        inventoryLocationId: sourceLocation.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });

    const available = sourceLocation.quantity - (sourceLocation.reserved || 0);
    if (available < createDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock in source warehouse. Available: ${available}, Requested: ${createDto.quantity}`,
      );
    }

    // Create transfer record
    const transfer = await this.prisma.stockTransfer.create({
      data: {
        fromWarehouseId: createDto.fromWarehouseId,
        toWarehouseId: createDto.toWarehouseId,
        productId: createDto.productId,
        quantity: createDto.quantity,
        status: 'PENDING',
        requestedBy,
        notes: createDto.notes,
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    return transfer;
  }

  /**
   * Complete a stock transfer
   */
  async completeStockTransfer(transferId: string, completedBy: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        product: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Stock transfer not found');
    }

    if (transfer.status !== 'PENDING' && transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(`Transfer cannot be completed. Current status: ${transfer.status}`);
    }

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct from source warehouse
      const sourceLocation = await tx.inventoryLocation.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.fromWarehouseId,
            productId: transfer.productId,
          },
        },
      });

      if (!sourceLocation || sourceLocation.quantity < transfer.quantity) {
        throw new BadRequestException('Insufficient stock in source warehouse');
      }

      // Update source location
      await tx.inventoryLocation.update({
        where: { id: sourceLocation.id },
        data: {
          quantity: { decrement: transfer.quantity },
        },
      });

      // Create or update destination location
      await tx.inventoryLocation.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.toWarehouseId,
            productId: transfer.productId,
          },
        },
        create: {
          warehouseId: transfer.toWarehouseId,
          productId: transfer.productId,
          quantity: transfer.quantity,
          lowStockThreshold: 10,
        },
        update: {
          quantity: { increment: transfer.quantity },
        },
      });

      // Create stock movements for audit trail
      const destinationLocation = await tx.inventoryLocation.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.toWarehouseId,
            productId: transfer.productId,
          },
        },
      });

      await tx.stockMovement.createMany({
        data: [
          {
            inventoryLocationId: sourceLocation.id,
            productId: transfer.productId,
            quantity: -transfer.quantity, // Negative for OUT
            movementType: 'OUT',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            performedBy: completedBy,
            notes: `Transferred to ${transfer.toWarehouse.name}`,
          },
          {
            inventoryLocationId: destinationLocation!.id,
            productId: transfer.productId,
            quantity: transfer.quantity, // Positive for IN
            movementType: 'IN',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            performedBy: completedBy,
            notes: `Received from ${transfer.fromWarehouse.name}`,
          },
        ],
      });

      // Update transfer status
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'COMPLETED',
          completedBy,
          completedAt: new Date(),
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });

      return updatedTransfer;
    });

    return result;
  }

  /**
   * Record stock movement (for manual adjustments, returns, etc.)
   */
  async recordStockMovement(createDto: CreateStockMovementDto, performedBy?: string) {
    // Verify inventory location exists
    const location = await this.prisma.inventoryLocation.findUnique({
      where: { id: createDto.inventoryLocationId },
      include: {
        warehouse: true,
        product: true,
      },
    });

    if (!location) {
      throw new NotFoundException('Inventory location not found');
    }

    if (location.productId !== createDto.productId) {
      throw new BadRequestException('Product ID does not match inventory location');
    }

    // For OUT movements, check available stock
    if (createDto.movementType === 'OUT' && createDto.quantity > 0) {
      const available = location.quantity - (location.reserved || 0);
      if (available < createDto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${available}, Requested: ${createDto.quantity}`,
        );
      }
    }

    // Use transaction to update location and create movement
    const result = await this.prisma.$transaction(async (tx) => {
      // Update inventory location quantity
      const quantityChange =
        createDto.movementType === 'IN' ? createDto.quantity : -createDto.quantity;

      await tx.inventoryLocation.update({
        where: { id: createDto.inventoryLocationId },
        data: {
          quantity: { increment: quantityChange },
        },
      });

      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          inventoryLocationId: createDto.inventoryLocationId,
          productId: createDto.productId,
          quantity: quantityChange, // Store as positive/negative
          movementType: createDto.movementType,
          referenceType: createDto.referenceType,
          referenceId: createDto.referenceId,
          performedBy,
          notes: createDto.notes,
        },
        include: {
          inventoryLocation: {
            include: {
              warehouse: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });

      return movement;
    });

    return result;
  }

  /**
   * Get stock movement history
   */
  async getStockMovements(
    filters: {
      inventoryLocationId?: string;
      productId?: string;
      warehouseId?: string;
      movementType?: string;
      referenceType?: string;
      referenceId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.inventoryLocationId) {
      where.inventoryLocationId = filters.inventoryLocationId;
    }

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.warehouseId) {
      where.inventoryLocation = {
        warehouseId: filters.warehouseId,
      };
    }

    if (filters.movementType) {
      where.movementType = filters.movementType;
    }

    if (filters.referenceType) {
      where.referenceType = filters.referenceType;
    }

    if (filters.referenceId) {
      where.referenceId = filters.referenceId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          inventoryLocation: {
            include: {
              warehouse: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get stock transfers
   */
  async getStockTransfers(
    filters: {
      fromWarehouseId?: string;
      toWarehouseId?: string;
      productId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.fromWarehouseId) {
      where.fromWarehouseId = filters.fromWarehouseId;
    }

    if (filters.toWarehouseId) {
      where.toWarehouseId = filters.toWarehouseId;
    }

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [transfers, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Allocate stock for order with location priority (nearest warehouse)
   */
  async allocateStockForOrderWithLocation(
    orderItems: Array<{ productId: string; quantity: number }>,
    shippingAddress: {
      country: string;
      state?: string;
      city?: string;
      postalCode?: string;
    },
  ) {
    const allocations: any[] = [];

    for (const item of orderItems) {
      // Find warehouses with available stock
      const locations = await this.prisma.inventoryLocation.findMany({
        where: {
          productId: item.productId,
          warehouse: { isActive: true },
        },
        include: {
          warehouse: true,
          stockReservations: {
            where: {
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
          },
        },
      });

      // Calculate distance/priority score (simplified: prioritize by country match, then by stock level)
      const scoredLocations = locations.map((location) => {
        let priority = 0;

        // Country match gets highest priority
        if (location.warehouse.country === shippingAddress.country) {
          priority += 1000;
        }

        // State match
        if (
          shippingAddress.state &&
          location.warehouse.state === shippingAddress.state
        ) {
          priority += 100;
        }

        // City match
        if (
          shippingAddress.city &&
          location.warehouse.city === shippingAddress.city
        ) {
          priority += 10;
        }

        // Prefer warehouses with more stock
        const reserved = location.stockReservations.reduce(
          (sum, res) => sum + res.quantity,
          0,
        );
        const available = location.quantity - reserved;
        priority += Math.min(available, 100); // Cap at 100 to not override location priority

        return {
          location,
          priority,
          available,
        };
      });

      // Sort by priority (highest first)
      scoredLocations.sort((a, b) => b.priority - a.priority);

      let remainingQuantity = item.quantity;

      for (const { location, available } of scoredLocations) {
        if (remainingQuantity <= 0) break;

        if (available > 0) {
          const allocateQuantity = Math.min(available, remainingQuantity);
          allocations.push({
            productId: item.productId,
            warehouseId: location.warehouseId,
            warehouseName: location.warehouse.name,
            warehouseCountry: location.warehouse.country,
            quantity: allocateQuantity,
            locationId: location.id,
          });
          remainingQuantity -= allocateQuantity;
        }
      }

      if (remainingQuantity > 0) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}. Need ${item.quantity}, only ${item.quantity - remainingQuantity} available.`,
        );
      }
    }

    return allocations;
  }
}

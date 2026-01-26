import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface ProductQuantity {
  productId: string;
  quantity: number;
}

interface WarehouseWithDistance {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  distance: number; // in km
  hasFullStock: boolean;
}

interface FulfillmentCenterWithDistance {
  centerId: string;
  centerName: string;
  distance: number; // in km
}

interface RoutingResult {
  warehouseId: string | null;
  fulfillmentCenterId: string | null;
  distance: number | null;
  routingMethod: string;
  message: string;
}

@Injectable()
export class WarehouseRoutingService {
  private readonly logger = new Logger(WarehouseRoutingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Find the nearest warehouse that has sufficient stock for all products
   */
  async findNearestWarehouseWithStock(
    customerLat: number,
    customerLon: number,
    productQuantities: ProductQuantity[],
  ): Promise<WarehouseWithDistance | null> {
    // Get all active warehouses with coordinates
    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        inventory: {
          where: {
            productId: { in: productQuantities.map((p) => p.productId) },
          },
        },
      },
    });

    if (warehouses.length === 0) {
      this.logger.warn('No active warehouses with coordinates found');
      return null;
    }

    // Filter warehouses that have sufficient stock for ALL products
    const eligibleWarehouses = warehouses.filter((warehouse) => {
      return productQuantities.every(({ productId, quantity }) => {
        const inventoryItem = warehouse.inventory.find(
          (inv) => inv.productId === productId,
        );
        const available =
          (inventoryItem?.quantity || 0) - (inventoryItem?.reserved || 0);
        return available >= quantity;
      });
    });

    if (eligibleWarehouses.length === 0) {
      this.logger.warn(
        'No warehouses with sufficient stock found for all products',
      );
      // Return nearest warehouse anyway (for reference)
      const warehousesWithDistance = warehouses.map((warehouse) => ({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        distance: this.calculateDistance(
          customerLat,
          customerLon,
          warehouse.latitude!,
          warehouse.longitude!,
        ),
        hasFullStock: false,
      }));
      warehousesWithDistance.sort((a, b) => a.distance - b.distance);
      return warehousesWithDistance[0];
    }

    // Calculate distances and find nearest eligible warehouse
    const warehousesWithDistance = eligibleWarehouses.map((warehouse) => ({
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      warehouseCode: warehouse.code,
      distance: this.calculateDistance(
        customerLat,
        customerLon,
        warehouse.latitude!,
        warehouse.longitude!,
      ),
      hasFullStock: true,
    }));

    // Sort by distance and return nearest
    warehousesWithDistance.sort((a, b) => a.distance - b.distance);
    
    this.logger.log(
      `Found nearest warehouse: ${warehousesWithDistance[0].warehouseName} at ${warehousesWithDistance[0].distance.toFixed(2)} km`,
    );
    
    return warehousesWithDistance[0];
  }

  /**
   * Find nearest fulfillment center (for shipping/3PL operations)
   */
  async findNearestFulfillmentCenter(
    customerLat: number,
    customerLon: number,
  ): Promise<FulfillmentCenterWithDistance | null> {
    const centers = await this.prisma.fulfillmentCenter.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    if (centers.length === 0) {
      this.logger.warn('No active fulfillment centers with coordinates found');
      return null;
    }

    const centersWithDistance = centers.map((center) => ({
      centerId: center.id,
      centerName: center.name,
      distance: this.calculateDistance(
        customerLat,
        customerLon,
        center.latitude!,
        center.longitude!,
      ),
    }));

    centersWithDistance.sort((a, b) => a.distance - b.distance);
    
    this.logger.log(
      `Found nearest fulfillment center: ${centersWithDistance[0].centerName} at ${centersWithDistance[0].distance.toFixed(2)} km`,
    );
    
    return centersWithDistance[0];
  }

  /**
   * Find optimal fulfillment source for an order
   * Prioritizes warehouses with stock, falls back to fulfillment centers
   */
  async findOptimalFulfillmentSource(
    customerLat: number | null,
    customerLon: number | null,
    productQuantities: ProductQuantity[],
  ): Promise<RoutingResult> {
    // If no coordinates, try zone-based routing
    if (!customerLat || !customerLon) {
      return {
        warehouseId: null,
        fulfillmentCenterId: null,
        distance: null,
        routingMethod: 'MANUAL',
        message: 'Customer coordinates not available - manual routing required',
      };
    }

    // Try to find warehouse with stock first
    const nearestWarehouse = await this.findNearestWarehouseWithStock(
      customerLat,
      customerLon,
      productQuantities,
    );

    if (nearestWarehouse && nearestWarehouse.hasFullStock) {
      return {
        warehouseId: nearestWarehouse.warehouseId,
        fulfillmentCenterId: null,
        distance: nearestWarehouse.distance,
        routingMethod: 'NEAREST_WITH_STOCK',
        message: `Assigned to ${nearestWarehouse.warehouseName} (${nearestWarehouse.distance.toFixed(1)} km)`,
      };
    }

    // Fall back to nearest fulfillment center
    const nearestCenter = await this.findNearestFulfillmentCenter(
      customerLat,
      customerLon,
    );

    if (nearestCenter) {
      return {
        warehouseId: nearestWarehouse?.warehouseId || null,
        fulfillmentCenterId: nearestCenter.centerId,
        distance: nearestCenter.distance,
        routingMethod: 'NEAREST_FC',
        message: `Assigned to FC: ${nearestCenter.centerName} (${nearestCenter.distance.toFixed(1)} km)`,
      };
    }

    // No suitable location found
    return {
      warehouseId: nearestWarehouse?.warehouseId || null,
      fulfillmentCenterId: null,
      distance: nearestWarehouse?.distance || null,
      routingMethod: 'FALLBACK',
      message: 'No optimal fulfillment source found - using fallback',
    };
  }

  /**
   * Get all warehouses with stock for specific products, sorted by distance
   */
  async getWarehousesWithStockByDistance(
    customerLat: number,
    customerLon: number,
    productQuantities: ProductQuantity[],
  ): Promise<WarehouseWithDistance[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        inventory: {
          where: {
            productId: { in: productQuantities.map((p) => p.productId) },
          },
        },
      },
    });

    const warehousesWithDistance = warehouses.map((warehouse) => {
      const hasFullStock = productQuantities.every(({ productId, quantity }) => {
        const inventoryItem = warehouse.inventory.find(
          (inv) => inv.productId === productId,
        );
        const available =
          (inventoryItem?.quantity || 0) - (inventoryItem?.reserved || 0);
        return available >= quantity;
      });

      return {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        distance: this.calculateDistance(
          customerLat,
          customerLon,
          warehouse.latitude!,
          warehouse.longitude!,
        ),
        hasFullStock,
      };
    });

    warehousesWithDistance.sort((a, b) => a.distance - b.distance);
    return warehousesWithDistance;
  }

  /**
   * Estimate delivery time based on distance
   * Simple estimation: ~50km/h average delivery speed + processing time
   */
  estimateDeliveryDays(distanceKm: number): number {
    if (distanceKm <= 50) return 1; // Same day or next day
    if (distanceKm <= 150) return 2; // 2 days
    if (distanceKm <= 300) return 3; // 3 days
    if (distanceKm <= 500) return 4; // 4 days
    return 5; // 5+ days for longer distances
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface CourierProvider {
  name: string;
  calculateRate(weight: number, dimensions: { length: number; width: number; height: number }, from: any, to: any): Promise<number>;
  createLabel(orderId: string, shipment: any): Promise<{ trackingNumber: string; labelUrl: string }>;
  trackShipment(trackingNumber: string): Promise<any>;
  validateAddress(address: any): Promise<boolean>;
}

export interface ShippingRateRequest {
  weight: number; // kg
  dimensions: {
    length: number; // cm
    width: number; // cm
    height: number; // cm
  };
  from: {
    country: string;
    postalCode: string;
    city?: string;
  };
  to: {
    country: string;
    postalCode: string;
    city?: string;
  };
  service?: string; // Optional service type
}

export interface ShippingLabelRequest {
  orderId: string;
  shipment: {
    from: any;
    to: any;
    weight: number;
    dimensions: { length: number; width: number; height: number };
    service: string;
  };
}

export interface TrackingInfo {
  trackingNumber: string;
  status: string;
  currentLocation?: string;
  estimatedDelivery?: Date;
  events: Array<{
    date: Date;
    location: string;
    description: string;
    status: string;
  }>;
}

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);
  private providers: Map<string, CourierProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a courier provider
   */
  registerProvider(name: string, provider: CourierProvider) {
    this.providers.set(name.toLowerCase(), provider);
    this.logger.log(`Registered courier provider: ${name}`);
  }

  /**
   * Get available courier providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Calculate shipping rate using a courier service
   */
  async calculateRate(
    providerName: string,
    request: ShippingRateRequest,
  ): Promise<{
    provider: string;
    service: string;
    rate: number;
    currency: string;
    estimatedDays: number;
  }> {
    const provider = this.providers.get(providerName.toLowerCase());

    if (!provider) {
      throw new BadRequestException(`Courier provider '${providerName}' not found`);
    }

    try {
      const rate = await provider.calculateRate(
        request.weight,
        request.dimensions,
        request.from,
        request.to,
      );

      // Estimate delivery days (default 3-5 days, can be provider-specific)
      const estimatedDays = this.estimateDeliveryDays(providerName, request.from.country, request.to.country);

      return {
        provider: providerName,
        service: request.service || 'STANDARD',
        rate,
        currency: 'GBP',
        estimatedDays,
      };
    } catch (error: any) {
      this.logger.error(`Failed to calculate rate with ${providerName}: ${error.message}`);
      throw new BadRequestException(`Failed to calculate shipping rate: ${error.message}`);
    }
  }

  /**
   * Create shipping label
   */
  async createLabel(providerName: string, request: ShippingLabelRequest): Promise<{
    trackingNumber: string;
    labelUrl: string;
  }> {
    const provider = this.providers.get(providerName.toLowerCase());

    if (!provider) {
      throw new BadRequestException(`Courier provider '${providerName}' not found`);
    }

    try {
      return await provider.createLabel(request.orderId, request.shipment);
    } catch (error: any) {
      this.logger.error(`Failed to create label with ${providerName}: ${error.message}`);
      throw new BadRequestException(`Failed to create shipping label: ${error.message}`);
    }
  }

  /**
   * Track shipment
   */
  async trackShipment(providerName: string, trackingNumber: string): Promise<TrackingInfo> {
    const provider = this.providers.get(providerName.toLowerCase());

    if (!provider) {
      throw new BadRequestException(`Courier provider '${providerName}' not found`);
    }

    try {
      return await provider.trackShipment(trackingNumber);
    } catch (error: any) {
      this.logger.error(`Failed to track shipment with ${providerName}: ${error.message}`);
      throw new BadRequestException(`Failed to track shipment: ${error.message}`);
    }
  }

  /**
   * Validate address using courier service
   */
  async validateAddress(providerName: string, address: any): Promise<boolean> {
    const provider = this.providers.get(providerName.toLowerCase());

    if (!provider) {
      return false;
    }

    try {
      return await provider.validateAddress(address);
    } catch (error: any) {
      this.logger.error(`Failed to validate address with ${providerName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Estimate delivery days (simplified)
   */
  private estimateDeliveryDays(provider: string, fromCountry: string, toCountry: string): number {
    // Domestic shipping
    if (fromCountry === toCountry) {
      return 1; // Next day for domestic
    }

    // International shipping
    // EU countries
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    if (euCountries.includes(toCountry)) {
      return 3; // 3 days for EU
    }

    // Rest of world
    return 7; // 7 days for international
  }
}

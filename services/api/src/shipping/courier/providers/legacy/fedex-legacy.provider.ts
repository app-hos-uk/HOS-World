import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourierProvider, TrackingInfo } from '../../courier.service';

/**
 * Legacy FedEx Provider
 * 
 * This provider uses environment variables for configuration and implements
 * the legacy CourierProvider interface for backward compatibility.
 * 
 * For new integrations, use the new FedExProvider with CourierFactoryService.
 */
@Injectable()
export class FedExLegacyProvider implements CourierProvider {
  readonly name = 'FedEx';
  private readonly logger = new Logger(FedExLegacyProvider.name);

  constructor(private configService: ConfigService) {}

  async calculateRate(
    weight: number,
    dimensions: { length: number; width: number; height: number },
    from: any,
    to: any,
  ): Promise<number> {
    this.logger.debug(`Calculating FedEx rate: ${weight}kg from ${from.postalCode} to ${to.postalCode}`);

    // Base rates for FedEx services
    let baseRate = 8.50; // Base rate in USD

    // Weight-based pricing (FedEx uses dimensional weight)
    const dimWeight = (dimensions.length * dimensions.width * dimensions.height) / 5000;
    const billableWeight = Math.max(weight, dimWeight);

    if (billableWeight <= 1) {
      baseRate = 8.50;
    } else if (billableWeight <= 5) {
      baseRate = 12.50 + (billableWeight - 1) * 1.50;
    } else if (billableWeight <= 10) {
      baseRate = 18.50 + (billableWeight - 5) * 1.25;
    } else if (billableWeight <= 25) {
      baseRate = 24.75 + (billableWeight - 10) * 1.00;
    } else {
      baseRate = 39.75 + (billableWeight - 25) * 0.85;
    }

    // Zone-based multiplier for international
    if (from.country !== to.country) {
      baseRate *= 2.0;
    }

    return Math.round(baseRate * 100) / 100;
  }

  async createLabel(
    orderId: string,
    shipment: any,
  ): Promise<{ trackingNumber: string; labelUrl: string }> {
    this.logger.debug(`Creating FedEx label for order ${orderId}`);

    // Generate tracking number (in production, this would call FedEx API)
    const trackingNumber = `FX${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const labelUrl = `https://labels.fedex.com/${trackingNumber}`;

    return {
      trackingNumber,
      labelUrl,
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    this.logger.debug(`Tracking FedEx shipment: ${trackingNumber}`);

    // Simulated tracking response
    return {
      trackingNumber,
      status: 'IN_TRANSIT',
      currentLocation: 'Memphis Hub',
      estimatedDelivery: new Date(Date.now() + 48 * 60 * 60 * 1000),
      events: [
        {
          date: new Date(),
          location: 'Memphis Hub',
          description: 'Shipment in transit',
          status: 'IN_TRANSIT',
        },
        {
          date: new Date(Date.now() - 12 * 60 * 60 * 1000),
          location: 'Origin Facility',
          description: 'Picked up',
          status: 'PICKED_UP',
        },
      ],
    };
  }

  async validateAddress(address: any): Promise<boolean> {
    this.logger.debug(`Validating FedEx address: ${address.postalCode}`);

    // Basic validation - check required fields
    if (!address.postalCode || !address.city || !address.country) {
      return false;
    }

    // US ZIP code validation
    if (address.country === 'US') {
      const usZipRegex = /^\d{5}(-\d{4})?$/;
      return usZipRegex.test(address.postalCode);
    }

    return true;
  }
}

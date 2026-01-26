import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourierProvider, TrackingInfo } from '../../courier.service';

/**
 * Legacy DHL Provider
 * 
 * This provider uses environment variables for configuration and implements
 * the legacy CourierProvider interface for backward compatibility.
 * 
 * For new integrations, use the new DHLProvider with CourierFactoryService.
 */
@Injectable()
export class DHLLegacyProvider implements CourierProvider {
  readonly name = 'DHL Express';
  private readonly logger = new Logger(DHLLegacyProvider.name);

  constructor(private configService: ConfigService) {}

  async calculateRate(
    weight: number,
    dimensions: { length: number; width: number; height: number },
    from: any,
    to: any,
  ): Promise<number> {
    this.logger.debug(`Calculating DHL rate: ${weight}kg from ${from.postalCode} to ${to.postalCode}`);

    // DHL Express rates (simplified)
    let baseRate = 15.00; // Base rate in GBP

    // Weight-based pricing
    const dimWeight = (dimensions.length * dimensions.width * dimensions.height) / 5000;
    const billableWeight = Math.max(weight, dimWeight);

    if (billableWeight <= 0.5) {
      baseRate = 15.00;
    } else if (billableWeight <= 1) {
      baseRate = 22.00;
    } else if (billableWeight <= 2) {
      baseRate = 28.00;
    } else if (billableWeight <= 5) {
      baseRate = 35.00 + (billableWeight - 2) * 4.50;
    } else if (billableWeight <= 10) {
      baseRate = 48.50 + (billableWeight - 5) * 4.00;
    } else {
      baseRate = 68.50 + (billableWeight - 10) * 3.50;
    }

    // International surcharge based on zone
    if (from.country !== to.country) {
      const europeCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT'];
      if (europeCountries.includes(to.country)) {
        baseRate *= 1.2; // Europe zone
      } else {
        baseRate *= 1.8; // Rest of world
      }
    }

    return Math.round(baseRate * 100) / 100;
  }

  async createLabel(
    orderId: string,
    shipment: any,
  ): Promise<{ trackingNumber: string; labelUrl: string }> {
    this.logger.debug(`Creating DHL label for order ${orderId}`);

    // Generate tracking number (in production, this would call DHL API)
    const trackingNumber = `DHL${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const labelUrl = `https://labels.dhl.com/${trackingNumber}`;

    return {
      trackingNumber,
      labelUrl,
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    this.logger.debug(`Tracking DHL shipment: ${trackingNumber}`);

    // Simulated tracking response
    return {
      trackingNumber,
      status: 'IN_TRANSIT',
      currentLocation: 'Leipzig Hub',
      estimatedDelivery: new Date(Date.now() + 72 * 60 * 60 * 1000),
      events: [
        {
          date: new Date(),
          location: 'Leipzig Hub',
          description: 'Shipment processed at hub',
          status: 'IN_TRANSIT',
        },
        {
          date: new Date(Date.now() - 6 * 60 * 60 * 1000),
          location: 'Origin Service Area',
          description: 'Shipment picked up',
          status: 'PICKED_UP',
        },
      ],
    };
  }

  async validateAddress(address: any): Promise<boolean> {
    this.logger.debug(`Validating DHL address: ${address.postalCode}`);

    // Basic validation
    if (!address.postalCode || !address.city || !address.country) {
      return false;
    }

    // DHL covers most countries, basic format check
    if (address.postalCode.length < 3) {
      return false;
    }

    return true;
  }
}

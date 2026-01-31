import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourierProvider, TrackingInfo } from '../../courier.service';

/**
 * Legacy Royal Mail Provider
 *
 * This provider uses environment variables for configuration and implements
 * the legacy CourierProvider interface for backward compatibility.
 *
 * For new integrations, use the new RoyalMailProvider with CourierFactoryService.
 */
@Injectable()
export class RoyalMailLegacyProvider implements CourierProvider {
  readonly name = 'Royal Mail';
  private readonly logger = new Logger(RoyalMailLegacyProvider.name);

  constructor(private configService: ConfigService) {}

  async calculateRate(
    weight: number,
    dimensions: { length: number; width: number; height: number },
    from: any,
    to: any,
  ): Promise<number> {
    this.logger.debug(
      `Calculating Royal Mail rate: ${weight}kg from ${from.postalCode} to ${to.postalCode}`,
    );

    // Simplified rate calculation based on weight bands
    let baseRate = 3.5; // Base rate in GBP

    // Weight-based pricing
    if (weight > 2) baseRate += (weight - 2) * 0.5;
    if (weight > 10) baseRate += (weight - 10) * 0.75;
    if (weight > 20) baseRate += (weight - 20) * 1.0;

    // Size-based pricing
    const volume = (dimensions.length * dimensions.width * dimensions.height) / 1000;
    if (volume > 1) baseRate += (volume - 1) * 0.3;

    // International vs domestic
    if (from.country !== to.country) {
      baseRate *= 2.5;
    }

    return Math.round(baseRate * 100) / 100;
  }

  async createLabel(
    orderId: string,
    shipment: any,
  ): Promise<{ trackingNumber: string; labelUrl: string }> {
    this.logger.debug(`Creating Royal Mail label for order ${orderId}`);

    // Generate tracking number (in production, this would call Royal Mail API)
    const trackingNumber = `RM${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const labelUrl = `https://labels.royalmail.com/${trackingNumber}`;

    return {
      trackingNumber,
      labelUrl,
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    this.logger.debug(`Tracking Royal Mail shipment: ${trackingNumber}`);

    // Simulated tracking response
    return {
      trackingNumber,
      status: 'IN_TRANSIT',
      currentLocation: 'London Sorting Centre',
      estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
      events: [
        {
          date: new Date(),
          location: 'London Sorting Centre',
          description: 'Item in transit',
          status: 'IN_TRANSIT',
        },
      ],
    };
  }

  async validateAddress(address: any): Promise<boolean> {
    this.logger.debug(`Validating Royal Mail address: ${address.postalCode}`);

    // Basic UK postcode validation
    if (!address.postalCode || address.postalCode.length < 5) {
      return false;
    }

    const ukPostcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
    return ukPostcodeRegex.test(address.postalCode);
  }
}

import { Logger } from '@nestjs/common';
import {
  BaseCourierProvider,
  ICourierProvider,
  RateRequest,
  RateResponse,
  ShipmentRequest,
  ShipmentResponse,
  TrackingResponse,
  TrackingStatus,
  AddressValidationResult,
  Address,
  TestConnectionResult,
} from '../interfaces/courier-provider.interface';

/**
 * Royal Mail API Integration
 *
 * Implements Royal Mail Shipping API v3 and Tracking API
 * Documentation: https://developer.royalmail.net/
 *
 * Required credentials:
 * - clientId: OAuth2 client ID
 * - clientSecret: OAuth2 client secret
 * - accountNumber: Royal Mail account number
 * - postingLocation (optional): Default posting location
 *
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * CourierFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class RoyalMailProvider extends BaseCourierProvider implements ICourierProvider {
  readonly providerId = 'royal_mail';
  readonly providerName = 'Royal Mail';

  private readonly logger = new Logger(RoyalMailProvider.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // Royal Mail service codes
  private static readonly SERVICES = {
    // Domestic UK
    FIRST_CLASS: { name: 'Royal Mail 1st Class', days: 1 },
    SECOND_CLASS: { name: 'Royal Mail 2nd Class', days: 3 },
    SPECIAL_DELIVERY_9: { name: 'Special Delivery Guaranteed by 9am', days: 1 },
    SPECIAL_DELIVERY_1: { name: 'Special Delivery Guaranteed by 1pm', days: 1 },
    TRACKED_24: { name: 'Royal Mail Tracked 24', days: 1 },
    TRACKED_48: { name: 'Royal Mail Tracked 48', days: 2 },
    SIGNED_FOR_1ST: { name: 'Royal Mail Signed For 1st Class', days: 1 },
    SIGNED_FOR_2ND: { name: 'Royal Mail Signed For 2nd Class', days: 3 },
    // International
    INTL_STANDARD: { name: 'International Standard', days: 7 },
    INTL_TRACKED: { name: 'International Tracked', days: 7 },
    INTL_SIGNED: { name: 'International Signed', days: 7 },
    INTL_TRACKED_SIGNED: { name: 'International Tracked & Signed', days: 7 },
  };

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.clientId &&
      this.credentials.clientSecret &&
      this.credentials.accountNumber
    );
  }

  protected getBaseUrl(): string {
    return this.isTestMode
      ? 'https://api.royalmail.net/shipping/v3' // Sandbox
      : 'https://api.royalmail.net/shipping/v3'; // Production (same URL, different credentials)
  }

  private getAuthUrl(): string {
    return 'https://authentication.royalmail.net/oauth/token';
  }

  private getTrackingUrl(): string {
    return 'https://api.royalmail.net/tracking/v1';
  }

  /**
   * Get OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(this.getAuthUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${this.credentials.clientId}:${this.credentials.clientSecret}`,
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'shipping tracking',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Auth failed: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry 5 minutes before actual expiry
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error: any) {
      this.logger.error(`Royal Mail authentication failed: ${error.message}`);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest(url: string, method: string = 'GET', body?: any): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-IBM-Client-Id': this.credentials.clientId,
        'X-IBM-Client-Secret': this.credentials.clientSecret,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Royal Mail API error: ${response.status} - ${error}`);
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          message: 'Missing required credentials (clientId, clientSecret, accountNumber)',
        };
      }

      // Try to get an access token
      await this.getAccessToken();

      return {
        success: true,
        message: `Royal Mail ${this.isTestMode ? 'sandbox' : 'production'} connection successful`,
        details: {
          environment: this.isTestMode ? 'sandbox' : 'production',
          accountNumber: this.credentials.accountNumber,
        },
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  async getRates(request: RateRequest): Promise<RateResponse[]> {
    // Royal Mail doesn't have a rates API - rates are based on weight/size bands
    // We calculate rates based on Royal Mail's published pricing

    const isDomestic = request.from.country === 'GB' && request.to.country === 'GB';
    const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);

    const rates: RateResponse[] = [];

    if (isDomestic) {
      // UK domestic services
      rates.push(
        this.calculateDomesticRate('FIRST_CLASS', totalWeight),
        this.calculateDomesticRate('SECOND_CLASS', totalWeight),
        this.calculateDomesticRate('TRACKED_24', totalWeight),
        this.calculateDomesticRate('TRACKED_48', totalWeight),
      );

      // Add Special Delivery for valuable items
      if (totalWeight <= 2) {
        rates.push(this.calculateDomesticRate('SPECIAL_DELIVERY_1', totalWeight));
      }
    } else {
      // International services
      rates.push(
        this.calculateInternationalRate('INTL_STANDARD', totalWeight, request.to.country),
        this.calculateInternationalRate('INTL_TRACKED', totalWeight, request.to.country),
        this.calculateInternationalRate('INTL_SIGNED', totalWeight, request.to.country),
      );
    }

    return rates.filter((r) => r.rate > 0);
  }

  private calculateDomesticRate(serviceCode: string, weightKg: number): RateResponse {
    const service =
      RoyalMailProvider.SERVICES[serviceCode as keyof typeof RoyalMailProvider.SERVICES];

    // Simplified rate calculation based on weight bands (actual rates vary)
    let rate = 0;
    if (weightKg <= 0.1) {
      rate = serviceCode.includes('SPECIAL') ? 7.45 : serviceCode.includes('FIRST') ? 1.25 : 0.85;
    } else if (weightKg <= 0.25) {
      rate = serviceCode.includes('SPECIAL') ? 7.65 : serviceCode.includes('FIRST') ? 1.75 : 1.25;
    } else if (weightKg <= 0.5) {
      rate = serviceCode.includes('SPECIAL') ? 8.25 : serviceCode.includes('FIRST') ? 2.25 : 1.75;
    } else if (weightKg <= 1) {
      rate = serviceCode.includes('SPECIAL') ? 9.45 : serviceCode.includes('FIRST') ? 3.35 : 2.85;
    } else if (weightKg <= 2) {
      rate = serviceCode.includes('SPECIAL') ? 12.45 : serviceCode.includes('FIRST') ? 5.75 : 4.25;
    } else {
      rate = serviceCode.includes('FIRST') ? 7.95 : 5.95; // Large Letter/Parcel rates
    }

    // Add tracking fee if applicable
    if (serviceCode.includes('TRACKED')) {
      rate += 1.0;
    }

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      serviceCode,
      serviceName: service?.name || serviceCode,
      rate,
      currency: 'GBP',
      estimatedDays: service?.days || 3,
      trackingIncluded: serviceCode.includes('TRACKED') || serviceCode.includes('SPECIAL'),
      signatureRequired: serviceCode.includes('SIGNED') || serviceCode.includes('SPECIAL'),
    };
  }

  private calculateInternationalRate(
    serviceCode: string,
    weightKg: number,
    destCountry: string,
  ): RateResponse {
    const service =
      RoyalMailProvider.SERVICES[serviceCode as keyof typeof RoyalMailProvider.SERVICES];

    // Zone-based international rates (simplified)
    const europeCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT'];
    const isEurope = europeCountries.includes(destCountry);

    let rate = 0;
    if (weightKg <= 0.1) {
      rate = isEurope ? 3.75 : 4.95;
    } else if (weightKg <= 0.25) {
      rate = isEurope ? 5.25 : 7.25;
    } else if (weightKg <= 0.5) {
      rate = isEurope ? 7.45 : 10.95;
    } else if (weightKg <= 1) {
      rate = isEurope ? 11.95 : 16.95;
    } else if (weightKg <= 2) {
      rate = isEurope ? 18.95 : 26.95;
    } else {
      rate = isEurope ? 28.95 : 42.95;
    }

    // Add tracking/signature fees
    if (serviceCode.includes('TRACKED')) {
      rate += 5.25;
    }
    if (serviceCode.includes('SIGNED')) {
      rate += 6.85;
    }

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      serviceCode,
      serviceName: service?.name || serviceCode,
      rate,
      currency: 'GBP',
      estimatedDays: isEurope ? 5 : 10,
      trackingIncluded: serviceCode.includes('TRACKED'),
      signatureRequired: serviceCode.includes('SIGNED'),
    };
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const payload = this.buildShipmentPayload(request);

    try {
      const response = await this.apiRequest(`${this.getBaseUrl()}/shipments`, 'POST', payload);

      // Parse label from response
      const labels = response.labelData
        ? [
            {
              format: 'PDF' as const,
              data: response.labelData,
              packageIndex: 0,
            },
          ]
        : [];

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        shipmentId: response.shipmentId,
        trackingNumber: response.trackingNumber,
        trackingUrl: `https://www.royalmail.com/track-your-item#/tracking-results/${response.trackingNumber}`,
        labels,
        rate: response.totalCharge || 0,
        currency: 'GBP',
        serviceCode: request.serviceCode,
        serviceName:
          RoyalMailProvider.SERVICES[request.serviceCode as keyof typeof RoyalMailProvider.SERVICES]
            ?.name || request.serviceCode,
        estimatedDeliveryDate: response.estimatedDelivery
          ? new Date(response.estimatedDelivery)
          : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Royal Mail create shipment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate and return phone number for Royal Mail API
   * Royal Mail requires valid phone numbers for shipment creation
   */
  private validateAndGetPhone(phone: string | undefined, party: 'sender' | 'recipient'): string {
    if (!phone?.trim()) {
      throw new Error(
        `Phone number is required for ${party}. Royal Mail requires valid contact phone numbers for all shipments.`,
      );
    }

    // Basic phone number validation - allow digits, spaces, hyphens, parentheses, and optional leading +
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!/^\+?[\d\-()]+$/.test(cleanPhone)) {
      throw new Error(
        `Invalid phone number format for ${party}: "${phone}". Please use a valid phone format (e.g., +44 20 1234 5678).`,
      );
    }

    return cleanPhone;
  }

  private buildShipmentPayload(request: ShipmentRequest): any {
    return {
      shipmentType: request.to.country === 'GB' ? 'DOMESTIC' : 'INTERNATIONAL',
      service: {
        serviceCode: request.serviceCode,
        serviceOptions: {
          postingLocation: this.credentials.postingLocation || 'default',
        },
      },
      shippingDate: (request.shipDate || new Date()).toISOString().split('T')[0],
      items: request.packages.map((pkg, index) => ({
        itemId: `${request.orderId}-${index + 1}`,
        weight: {
          unitOfMeasure: 'kg',
          value: pkg.weight.toString(),
        },
        dimensions: {
          unitOfMeasure: 'cm',
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
        },
      })),
      recipientContact: {
        name: request.to.name,
        email: request.to.email,
        telephoneNumber: this.validateAndGetPhone(request.to.phone, 'recipient'),
      },
      recipientAddress: {
        buildingName: request.to.company,
        addressLine1: request.to.street1,
        addressLine2: request.to.street2,
        city: request.to.city,
        county: request.to.state,
        postcode: request.to.postalCode,
        countryCode: request.to.country,
      },
      senderReference: request.reference1,
      departmentReference: request.reference2,
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingResponse> {
    try {
      const response = await this.apiRequest(
        `${this.getTrackingUrl()}/mailPieces/${trackingNumber}/events`,
      );

      const events = (response.events || []).map((event: any) => ({
        timestamp: new Date(event.eventDateTime),
        status: this.mapTrackingStatus(event.eventCode),
        statusDescription: event.eventDescription,
        location: event.locationName,
        city: event.city,
        country: event.countryCode,
      }));

      const latestEvent = events.length > 0 ? events[0] : undefined;

      // Safely determine actual delivery date - only if we have a valid timestamp
      let actualDeliveryDate: Date | undefined;
      if (
        response.signedForByName &&
        latestEvent?.timestamp instanceof Date &&
        !isNaN(latestEvent.timestamp.getTime())
      ) {
        actualDeliveryDate = latestEvent.timestamp;
      }

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        trackingNumber,
        status: latestEvent?.status ?? 'UNKNOWN',
        statusDescription: latestEvent?.statusDescription ?? 'No tracking information available',
        estimatedDeliveryDate: response.estimatedDeliveryDate
          ? new Date(response.estimatedDeliveryDate)
          : undefined,
        actualDeliveryDate,
        signedBy: response.signedForByName,
        events,
      };
    } catch (error: any) {
      this.logger.error(`Royal Mail tracking failed: ${error.message}`);
      throw error;
    }
  }

  private mapTrackingStatus(eventCode: string): TrackingStatus {
    const statusMap: Record<string, TrackingStatus> = {
      EVNAC: 'PRE_TRANSIT', // Accepted
      EVNPD: 'IN_TRANSIT', // Processing at depot
      EVNDS: 'IN_TRANSIT', // Dispatched
      EVNOD: 'OUT_FOR_DELIVERY', // Out for delivery
      EVNDL: 'DELIVERED', // Delivered
      EVNFA: 'FAILED_ATTEMPT', // Failed attempt
      EVNRT: 'RETURN_TO_SENDER', // Return to sender
    };

    return statusMap[eventCode] || 'IN_TRANSIT';
  }

  async cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(`${this.getBaseUrl()}/shipments/${shipmentId}`, 'DELETE');

      return {
        success: true,
        message: 'Shipment cancelled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to cancel shipment: ${error.message}`,
      };
    }
  }

  async validateAddress(address: Address): Promise<AddressValidationResult> {
    // Royal Mail uses PAF (Postcode Address File) for UK address validation
    // For now, we do basic validation

    if (address.country !== 'GB') {
      return {
        isValid: true, // Can't validate non-UK addresses
        normalizedAddress: address,
      };
    }

    // UK postcode validation
    const ukPostcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
    if (!ukPostcodeRegex.test(address.postalCode)) {
      return {
        isValid: false,
        errors: ['Invalid UK postcode format'],
      };
    }

    // Normalize postcode format
    const normalizedPostcode = address.postalCode
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/^(.+?)(\d[A-Z]{2})$/, '$1 $2');

    return {
      isValid: true,
      normalizedAddress: {
        ...address,
        postalCode: normalizedPostcode,
      },
      isResidential: true, // Default to residential for UK
    };
  }

  async getAvailableServices(
    from: Address,
    to: Address,
  ): Promise<Array<{ code: string; name: string; description?: string }>> {
    const isDomestic = from.country === 'GB' && to.country === 'GB';

    if (isDomestic) {
      return [
        { code: 'FIRST_CLASS', name: 'Royal Mail 1st Class', description: 'Next working day aim' },
        { code: 'SECOND_CLASS', name: 'Royal Mail 2nd Class', description: '2-3 working days' },
        {
          code: 'TRACKED_24',
          name: 'Royal Mail Tracked 24',
          description: 'Next day with tracking',
        },
        {
          code: 'TRACKED_48',
          name: 'Royal Mail Tracked 48',
          description: '2-3 days with tracking',
        },
        {
          code: 'SPECIAL_DELIVERY_1',
          name: 'Special Delivery Guaranteed by 1pm',
          description: 'Guaranteed by 1pm next day',
        },
        {
          code: 'SPECIAL_DELIVERY_9',
          name: 'Special Delivery Guaranteed by 9am',
          description: 'Guaranteed by 9am next day',
        },
      ];
    }

    return [
      {
        code: 'INTL_STANDARD',
        name: 'International Standard',
        description: 'Economy international',
      },
      { code: 'INTL_TRACKED', name: 'International Tracked', description: 'Tracked international' },
      { code: 'INTL_SIGNED', name: 'International Signed', description: 'Signature on delivery' },
      {
        code: 'INTL_TRACKED_SIGNED',
        name: 'International Tracked & Signed',
        description: 'Full tracking and signature',
      },
    ];
  }
}

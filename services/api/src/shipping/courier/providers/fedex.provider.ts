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
 * FedEx API Integration
 *
 * Implements FedEx Web Services REST API
 * Documentation: https://developer.fedex.com/
 *
 * Required credentials:
 * - apiKey: FedEx API Key
 * - secretKey: FedEx Secret Key
 * - accountNumber: FedEx account number
 * - meterNumber (optional): FedEx meter number
 *
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * CourierFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class FedExProvider extends BaseCourierProvider implements ICourierProvider {
  readonly providerId = 'fedex';
  readonly providerName = 'FedEx';

  private readonly logger = new Logger(FedExProvider.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // FedEx service types
  private static readonly SERVICES: Record<string, { name: string; days: number }> = {
    FEDEX_GROUND: { name: 'FedEx Ground', days: 5 },
    FEDEX_HOME_DELIVERY: { name: 'FedEx Home Delivery', days: 5 },
    FEDEX_EXPRESS_SAVER: { name: 'FedEx Express Saver', days: 3 },
    FEDEX_2_DAY: { name: 'FedEx 2Day', days: 2 },
    FEDEX_2_DAY_AM: { name: 'FedEx 2Day A.M.', days: 2 },
    STANDARD_OVERNIGHT: { name: 'FedEx Standard Overnight', days: 1 },
    PRIORITY_OVERNIGHT: { name: 'FedEx Priority Overnight', days: 1 },
    FIRST_OVERNIGHT: { name: 'FedEx First Overnight', days: 1 },
    INTERNATIONAL_ECONOMY: { name: 'FedEx International Economy', days: 5 },
    INTERNATIONAL_PRIORITY: { name: 'FedEx International Priority', days: 3 },
    INTERNATIONAL_FIRST: { name: 'FedEx International First', days: 2 },
    EUROPE_FIRST_INTERNATIONAL_PRIORITY: { name: 'FedEx Europe First', days: 1 },
  };

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.apiKey &&
      this.credentials.secretKey &&
      this.credentials.accountNumber
    );
  }

  protected getBaseUrl(): string {
    return this.isTestMode ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
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
      const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.credentials.apiKey,
          client_secret: this.credentials.secretKey,
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
      this.logger.error(`FedEx authentication failed: ${error.message}`);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest(endpoint: string, method: string = 'POST', body?: any): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-locale': 'en_US',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Check response status before parsing JSON to handle non-JSON error responses
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.errors?.[0]?.message || errorData.message || errorMessage;
      } catch {
        // Response body is not JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200); // Truncate long error messages
          }
        } catch {
          // Ignore text parsing errors
        }
      }
      this.logger.error(`FedEx API error: ${response.status} - ${errorMessage}`);
      throw new Error(`API error: ${errorMessage}`);
    }

    return response.json();
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          message: 'Missing required credentials (apiKey, secretKey, accountNumber)',
        };
      }

      // Try to get an access token
      await this.getAccessToken();

      return {
        success: true,
        message: `FedEx ${this.isTestMode ? 'sandbox' : 'production'} connection successful`,
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
    const payload = {
      accountNumber: {
        value: this.credentials.accountNumber,
      },
      requestedShipment: {
        shipper: this.formatAddress(request.from, 'shipper'),
        recipient: this.formatAddress(request.to, 'recipient'),
        shipDateStamp: (request.shipDate || new Date()).toISOString().split('T')[0],
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        rateRequestType: ['LIST', 'ACCOUNT'],
        requestedPackageLineItems: request.packages.map((pkg, index) => ({
          groupPackageCount: 1,
          weight: {
            units: 'KG',
            value: pkg.weight,
          },
          dimensions: {
            length: Math.ceil(pkg.length),
            width: Math.ceil(pkg.width),
            height: Math.ceil(pkg.height),
            units: 'CM',
          },
        })),
      },
    };

    try {
      const response = await this.apiRequest('/rate/v1/rates/quotes', 'POST', payload);

      const rates: RateResponse[] = [];

      for (const rateReply of response.output?.rateReplyDetails || []) {
        const serviceType = rateReply.serviceType;
        const serviceInfo = FedExProvider.SERVICES[serviceType];

        if (!serviceInfo) continue;

        const ratedShipment = rateReply.ratedShipmentDetails?.[0];
        const totalNetCharge = ratedShipment?.totalNetCharge || ratedShipment?.totalNetFedExCharge;

        if (!totalNetCharge) continue;

        rates.push({
          providerId: this.providerId,
          providerName: this.providerName,
          serviceCode: serviceType,
          serviceName: serviceInfo.name,
          rate: parseFloat(totalNetCharge),
          currency: ratedShipment?.currency || 'USD',
          estimatedDays: serviceInfo.days,
          estimatedDeliveryDate: rateReply.commit?.dateDetail?.dayFormat
            ? new Date(rateReply.commit.dateDetail.dayFormat)
            : undefined,
          guaranteedDelivery: rateReply.commit?.commitGuarantee || false,
          trackingIncluded: true,
        });
      }

      return rates.sort((a, b) => a.rate - b.rate);
    } catch (error: any) {
      this.logger.error(`FedEx get rates failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate and return phone number for FedEx API
   * FedEx requires valid phone numbers for shipment creation
   */
  private validateAndGetPhone(phone: string | undefined, party: 'shipper' | 'recipient'): string {
    if (!phone?.trim()) {
      throw new Error(
        `Phone number is required for ${party}. FedEx requires valid contact phone numbers for all shipments.`,
      );
    }

    // Basic phone number validation - allow digits, spaces, hyphens, parentheses, and optional leading +
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!/^\+?[\d\-()]+$/.test(cleanPhone)) {
      throw new Error(
        `Invalid phone number format for ${party}: "${phone}". Please use a valid phone format (e.g., +1 555-123-4567).`,
      );
    }

    return cleanPhone;
  }

  private formatAddress(address: Address, party: 'shipper' | 'recipient'): any {
    return {
      address: {
        streetLines: [address.street1, address.street2].filter(Boolean),
        city: address.city,
        stateOrProvinceCode: address.state,
        postalCode: address.postalCode,
        countryCode: address.country,
        residential: address.isResidential,
      },
      contact: {
        personName: address.name,
        phoneNumber: this.validateAndGetPhone(address.phone, party),
        emailAddress: address.email,
        companyName: address.company,
      },
    };
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const payload = {
      labelResponseOptions: 'URL_ONLY',
      requestedShipment: {
        shipper: this.formatAddress(request.from, 'shipper'),
        recipients: [this.formatAddress(request.to, 'recipient')],
        shipDatestamp: (request.shipDate || new Date()).toISOString().split('T')[0],
        serviceType: request.serviceCode,
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        blockInsightVisibility: false,
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: {
            responsibleParty: {
              accountNumber: {
                value: this.credentials.accountNumber,
              },
            },
          },
        },
        labelSpecification: {
          imageType: request.labelFormat === 'PNG' ? 'PNG' : 'PDF',
          labelStockType: 'PAPER_7X4.75',
        },
        requestedPackageLineItems: request.packages.map((pkg, index) => ({
          weight: {
            units: 'KG',
            value: pkg.weight,
          },
          dimensions: {
            length: Math.ceil(pkg.length),
            width: Math.ceil(pkg.width),
            height: Math.ceil(pkg.height),
            units: 'CM',
          },
        })),
        shipmentSpecialServices: {
          specialServiceTypes: request.signatureRequired ? ['SIGNATURE_OPTION'] : [],
          signatureOptionType: request.signatureRequired ? 'DIRECT' : undefined,
        },
      },
      accountNumber: {
        value: this.credentials.accountNumber,
      },
    };

    // Add customs info for international shipments
    if (request.customsInfo) {
      (payload.requestedShipment as any).customsClearanceDetail = {
        dutiesPayment: {
          paymentType: 'SENDER',
        },
        commodities: request.customsInfo.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          quantityUnits: 'PCS',
          weight: {
            units: 'KG',
            value: item.weight,
          },
          customsValue: {
            amount: item.value,
            currency: item.currency,
          },
          countryOfManufacture: item.countryOfOrigin,
          harmonizedCode: item.hsCode,
        })),
        commercialInvoice: {
          shipmentPurpose: request.customsInfo.contentsType === 'DOCUMENTS' ? 'NOT_SOLD' : 'SOLD',
        },
      };
    }

    try {
      const response = await this.apiRequest('/ship/v1/shipments', 'POST', payload);

      const shipmentResponse = response.output?.transactionShipments?.[0];
      if (!shipmentResponse) {
        throw new Error('No shipment response received');
      }

      const masterTrackingId = shipmentResponse.masterTrackingNumber;
      const pieceResponses = shipmentResponse.pieceResponses || [];

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        shipmentId: shipmentResponse.shipmentId || masterTrackingId,
        trackingNumber: masterTrackingId,
        trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${masterTrackingId}`,
        labels: pieceResponses.map((piece: any, index: number) => ({
          format: (request.labelFormat || 'PDF') as 'PDF' | 'PNG' | 'ZPL',
          data: '', // Label data would be here if using LABEL response option
          url: piece.packageDocuments?.[0]?.url,
          packageIndex: index,
        })),
        rate:
          shipmentResponse.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.[0]
            ?.totalNetCharge || 0,
        currency: 'USD',
        serviceCode: request.serviceCode,
        serviceName: FedExProvider.SERVICES[request.serviceCode]?.name || request.serviceCode,
        estimatedDeliveryDate: shipmentResponse.completedShipmentDetail?.deliveryDate
          ? new Date(shipmentResponse.completedShipmentDetail.deliveryDate)
          : undefined,
      };
    } catch (error: any) {
      this.logger.error(`FedEx create shipment failed: ${error.message}`);
      throw error;
    }
  }

  async trackShipment(trackingNumber: string): Promise<TrackingResponse> {
    const payload = {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: trackingNumber,
          },
        },
      ],
    };

    try {
      const response = await this.apiRequest('/track/v1/trackingnumbers', 'POST', payload);

      const trackResult = response.output?.completeTrackResults?.[0]?.trackResults?.[0];
      if (!trackResult) {
        throw new Error('No tracking information found');
      }

      const latestStatus = trackResult.latestStatusDetail;
      const scanEvents = trackResult.scanEvents || [];

      const events = scanEvents.map((event: any) => ({
        timestamp: new Date(event.date),
        status: this.mapTrackingStatus(event.derivedStatus || event.eventType),
        statusDescription: event.eventDescription,
        location: event.scanLocation?.city,
        city: event.scanLocation?.city,
        state: event.scanLocation?.stateOrProvinceCode,
        country: event.scanLocation?.countryCode,
        postalCode: event.scanLocation?.postalCode,
      }));

      // Cache the actual delivery entry to avoid double find
      const actualDeliveryEntry = trackResult.dateAndTimes?.find(
        (d: any) => d.type === 'ACTUAL_DELIVERY',
      );
      const actualDeliveryDateTime = actualDeliveryEntry?.dateTime;

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        trackingNumber,
        status: this.mapTrackingStatus(latestStatus?.statusByLocale || latestStatus?.code),
        statusDescription: latestStatus?.description || 'In transit',
        estimatedDeliveryDate: trackResult.estimatedDeliveryTimeWindow?.window?.begins
          ? new Date(trackResult.estimatedDeliveryTimeWindow.window.begins)
          : undefined,
        actualDeliveryDate: actualDeliveryDateTime ? new Date(actualDeliveryDateTime) : undefined,
        signedBy: trackResult.deliveryDetails?.receivedByName,
        events,
      };
    } catch (error: any) {
      this.logger.error(`FedEx tracking failed: ${error.message}`);
      throw error;
    }
  }

  private mapTrackingStatus(status: string): TrackingStatus {
    const normalizedStatus = (status || '').toUpperCase();

    if (normalizedStatus.includes('DELIVERED')) return 'DELIVERED';
    if (normalizedStatus.includes('OUT FOR DELIVERY') || normalizedStatus.includes('ON VEHICLE'))
      return 'OUT_FOR_DELIVERY';
    if (normalizedStatus.includes('EXCEPTION') || normalizedStatus.includes('DELAY'))
      return 'EXCEPTION';
    if (normalizedStatus.includes('ATTEMPT')) return 'FAILED_ATTEMPT';
    if (normalizedStatus.includes('RETURN') || normalizedStatus.includes('RTS'))
      return 'RETURN_TO_SENDER';
    if (normalizedStatus.includes('CANCEL')) return 'CANCELLED';
    if (normalizedStatus.includes('PICKED UP') || normalizedStatus.includes('INITIATED'))
      return 'PRE_TRANSIT';
    if (
      normalizedStatus.includes('IN TRANSIT') ||
      normalizedStatus.includes('DEPARTED') ||
      normalizedStatus.includes('ARRIVED')
    )
      return 'IN_TRANSIT';

    return 'IN_TRANSIT';
  }

  async cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }> {
    const payload = {
      accountNumber: {
        value: this.credentials.accountNumber,
      },
      trackingNumber: shipmentId,
    };

    try {
      await this.apiRequest('/ship/v1/shipments/cancel', 'PUT', payload);

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
    const payload = {
      addressesToValidate: [
        {
          address: {
            streetLines: [address.street1, address.street2].filter(Boolean),
            city: address.city,
            stateOrProvinceCode: address.state,
            postalCode: address.postalCode,
            countryCode: address.country,
          },
        },
      ],
    };

    try {
      const response = await this.apiRequest('/address/v1/addresses/resolve', 'POST', payload);

      const result = response.output?.resolvedAddresses?.[0];
      if (!result) {
        return {
          isValid: false,
          errors: ['Unable to validate address'],
        };
      }

      const classification = result.classification;
      const resolvedAddress = result.streetLinesToken?.[0];

      return {
        isValid: classification !== 'UNKNOWN',
        normalizedAddress: resolvedAddress
          ? {
              ...address,
              street1: resolvedAddress.value || address.street1,
              city: result.city || address.city,
              state: result.stateOrProvinceCode || address.state,
              postalCode: result.postalCode || address.postalCode,
            }
          : address,
        isResidential: classification === 'RESIDENTIAL',
      };
    } catch (error: any) {
      this.logger.warn(`FedEx address validation failed: ${error.message}`);
      return {
        isValid: true, // Default to valid if validation fails
        normalizedAddress: address,
      };
    }
  }

  async getAvailableServices(
    from: Address,
    to: Address,
  ): Promise<Array<{ code: string; name: string; description?: string }>> {
    const isDomestic = from.country === to.country && from.country === 'US';

    if (isDomestic) {
      return [
        { code: 'FEDEX_GROUND', name: 'FedEx Ground', description: '1-5 business days' },
        {
          code: 'FEDEX_HOME_DELIVERY',
          name: 'FedEx Home Delivery',
          description: '1-5 business days (residential)',
        },
        {
          code: 'FEDEX_EXPRESS_SAVER',
          name: 'FedEx Express Saver',
          description: '3 business days',
        },
        { code: 'FEDEX_2_DAY', name: 'FedEx 2Day', description: '2 business days' },
        {
          code: 'STANDARD_OVERNIGHT',
          name: 'FedEx Standard Overnight',
          description: 'Next business day by 3pm',
        },
        {
          code: 'PRIORITY_OVERNIGHT',
          name: 'FedEx Priority Overnight',
          description: 'Next business day by 10:30am',
        },
        {
          code: 'FIRST_OVERNIGHT',
          name: 'FedEx First Overnight',
          description: 'Next business day by 8am',
        },
      ];
    }

    return [
      {
        code: 'INTERNATIONAL_ECONOMY',
        name: 'FedEx International Economy',
        description: '5 business days',
      },
      {
        code: 'INTERNATIONAL_PRIORITY',
        name: 'FedEx International Priority',
        description: '1-3 business days',
      },
      {
        code: 'INTERNATIONAL_FIRST',
        name: 'FedEx International First',
        description: 'Next business day',
      },
    ];
  }
}

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
  PickupRequest,
  PickupResponse,
} from '../interfaces/courier-provider.interface';

/**
 * DHL Express API Integration
 * 
 * Implements DHL Express MyDHL API
 * Documentation: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 * 
 * Required credentials:
 * - apiKey: DHL API Key
 * - accountNumber: DHL account number
 * - siteId (optional): DHL site ID for legacy XML API
 * - password (optional): DHL password for legacy XML API
 * 
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * CourierFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class DHLProvider extends BaseCourierProvider implements ICourierProvider {
  readonly providerId = 'dhl';
  readonly providerName = 'DHL Express';
  
  private readonly logger = new Logger(DHLProvider.name);

  // DHL Express service codes
  private static readonly SERVICES: Record<string, { name: string; days: number }> = {
    'P': { name: 'DHL Express Worldwide', days: 3 },
    'U': { name: 'DHL Express Worldwide (ECX)', days: 3 },
    'K': { name: 'DHL Express 9:00', days: 1 },
    'E': { name: 'DHL Express 10:30', days: 1 },
    'N': { name: 'DHL Express 12:00', days: 1 },
    'Y': { name: 'DHL Express 12:00 (DOX)', days: 1 },
    'T': { name: 'DHL Express 12:00 (DOC)', days: 1 },
    'D': { name: 'DHL Express Worldwide (DOC)', days: 3 },
    'X': { name: 'DHL Express Envelope', days: 3 },
    'W': { name: 'DHL Economy Select', days: 5 },
    'H': { name: 'DHL Economy Select (DOC)', days: 5 },
    'C': { name: 'DHL Medical Express', days: 1 },
    'B': { name: 'DHL Medical Express (DOC)', days: 1 },
  };

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.apiKey &&
      this.credentials.accountNumber
    );
  }

  protected getBaseUrl(): string {
    return this.isTestMode
      ? 'https://express.api.dhl.com/mydhlapi/test'
      : 'https://express.api.dhl.com/mydhlapi';
  }

  private getTrackingUrl(): string {
    return 'https://api-eu.dhl.com/track/shipments';
  }

  /**
   * Make authenticated API request
   * 
   * Authentication modes:
   * 1. Modern MyDHL API: Uses DHL-API-Key header only (preferred)
   * 2. Legacy XML API: Uses Basic Auth with siteId:password
   * 
   * We use DHL-API-Key for the modern REST API. Basic Auth is only added
   * when legacy credentials (siteId + password) are explicitly provided.
   */
  private async apiRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any,
  ): Promise<any> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    // Build headers - modern API uses DHL-API-Key header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'DHL-API-Key': this.credentials.apiKey,
    };

    // Only add Basic Auth if legacy credentials (siteId + password) are explicitly provided
    // Do NOT mix accountNumber/apiKey as Basic Auth - that's invalid
    if (this.credentials.siteId && this.credentials.password) {
      headers['Authorization'] = `Basic ${Buffer.from(
        `${this.credentials.siteId}:${this.credentials.password}`
      ).toString('base64')}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Check response status before parsing JSON to handle non-JSON error responses
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
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
      this.logger.error(`DHL API error: ${response.status} - ${errorMessage}`);
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
          message: 'Missing required credentials (apiKey, accountNumber)',
        };
      }

      // Try to get rates for a test shipment to verify credentials
      const testRateRequest: RateRequest = {
        from: {
          name: 'Test Sender',
          street1: '123 Test Street',
          city: 'London',
          postalCode: 'EC1A 1BB',
          country: 'GB',
        },
        to: {
          name: 'Test Recipient',
          street1: '456 Test Avenue',
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
        packages: [{ length: 20, width: 15, height: 10, weight: 1 }],
      };

      await this.apiRequest('/rates', 'POST', this.buildRatePayload(testRateRequest));

      return {
        success: true,
        message: `DHL Express ${this.isTestMode ? 'test' : 'production'} connection successful`,
        details: {
          environment: this.isTestMode ? 'test' : 'production',
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
    try {
      const payload = this.buildRatePayload(request);
      const response = await this.apiRequest('/rates', 'POST', payload);

      const rates: RateResponse[] = [];

      for (const product of response.products || []) {
        const serviceCode = product.productCode;
        const serviceInfo = DHLProvider.SERVICES[serviceCode];

        if (!serviceInfo) continue;

        const totalPrice = product.totalPrice?.[0];
        if (!totalPrice) continue;

        rates.push({
          providerId: this.providerId,
          providerName: this.providerName,
          serviceCode,
          serviceName: product.productName || serviceInfo.name,
          rate: parseFloat(totalPrice.price),
          currency: totalPrice.priceCurrency,
          estimatedDays: product.deliveryCapabilities?.estimatedDeliveryDateAndTime 
            ? this.calculateDays(new Date(), new Date(product.deliveryCapabilities.estimatedDeliveryDateAndTime))
            : serviceInfo.days,
          estimatedDeliveryDate: product.deliveryCapabilities?.estimatedDeliveryDateAndTime 
            ? new Date(product.deliveryCapabilities.estimatedDeliveryDateAndTime) 
            : undefined,
          trackingIncluded: true,
        });
      }

      return rates.sort((a, b) => a.rate - b.rate);
    } catch (error: any) {
      this.logger.error(`DHL get rates failed: ${error.message}`);
      throw error;
    }
  }

  private buildRatePayload(request: RateRequest): any {
    const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
    
    return {
      customerDetails: {
        shipperDetails: {
          postalCode: request.from.postalCode,
          cityName: request.from.city,
          countryCode: request.from.country,
        },
        receiverDetails: {
          postalCode: request.to.postalCode,
          cityName: request.to.city,
          countryCode: request.to.country,
        },
      },
      accounts: [
        {
          typeCode: 'shipper',
          number: this.credentials.accountNumber,
        },
      ],
      plannedShippingDateAndTime: (request.shipDate || new Date()).toISOString(),
      unitOfMeasurement: 'metric',
      isCustomsDeclarable: request.from.country !== request.to.country,
      monetaryAmount: [],
      requestAllValueAddedServices: false,
      returnStandardProductsOnly: false,
      nextBusinessDay: true,
      productTypeCode: 'all',
      packages: request.packages.map((pkg, index) => ({
        weight: pkg.weight,
        dimensions: {
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
        },
      })),
    };
  }

  private calculateDays(from: Date, to: Date): number {
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate and return phone number for DHL API
   * DHL requires valid phone numbers for shipment creation
   */
  private validateAndGetPhone(phone: string | undefined, party: 'shipper' | 'receiver'): string {
    if (!phone?.trim()) {
      throw new Error(
        `Phone number is required for ${party}. DHL Express requires valid contact phone numbers for all shipments.`
      );
    }

    // Basic phone number validation - should start with + for international format
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!/^\+?[\d\-()]+$/.test(cleanPhone)) {
      throw new Error(
        `Invalid phone number format for ${party}: "${phone}". Please use international format (e.g., +44 20 1234 5678).`
      );
    }

    return cleanPhone;
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const payload = this.buildShipmentPayload(request);
    
    try {
      const response = await this.apiRequest('/shipments', 'POST', payload);

      const shipmentId = response.shipmentTrackingNumber;
      const packages = response.packages || [];

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        shipmentId,
        trackingNumber: shipmentId,
        trackingUrl: `https://www.dhl.com/en/express/tracking.html?AWB=${shipmentId}`,
        labels: packages.map((pkg: any, index: number) => ({
          format: 'PDF' as const,
          data: pkg.documents?.[0]?.content || '',
          url: pkg.documents?.[0]?.url,
          packageIndex: index,
        })),
        rate: response.shipmentCharges?.[0]?.price || 0,
        currency: response.shipmentCharges?.[0]?.priceCurrency || 'GBP',
        serviceCode: request.serviceCode,
        serviceName: DHLProvider.SERVICES[request.serviceCode]?.name || request.serviceCode,
        estimatedDeliveryDate: response.estimatedDeliveryDate?.estimatedDeliveryDate 
          ? new Date(response.estimatedDeliveryDate.estimatedDeliveryDate) 
          : undefined,
      };
    } catch (error: any) {
      this.logger.error(`DHL create shipment failed: ${error.message}`);
      throw error;
    }
  }

  private buildShipmentPayload(request: ShipmentRequest): any {
    const isInternational = request.from.country !== request.to.country;

    const payload: any = {
      plannedShippingDateAndTime: (request.shipDate || new Date()).toISOString(),
      pickup: {
        isRequested: false,
      },
      productCode: request.serviceCode,
      accounts: [
        {
          typeCode: 'shipper',
          number: this.credentials.accountNumber,
        },
      ],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: request.from.postalCode,
            cityName: request.from.city,
            countryCode: request.from.country,
            addressLine1: request.from.street1,
            addressLine2: request.from.street2,
          },
          contactInformation: {
            phone: this.validateAndGetPhone(request.from.phone, 'shipper'),
            companyName: request.from.company || request.from.name,
            fullName: request.from.name,
            email: request.from.email,
          },
        },
        receiverDetails: {
          postalAddress: {
            postalCode: request.to.postalCode,
            cityName: request.to.city,
            countryCode: request.to.country,
            addressLine1: request.to.street1,
            addressLine2: request.to.street2,
          },
          contactInformation: {
            phone: this.validateAndGetPhone(request.to.phone, 'receiver'),
            companyName: request.to.company || request.to.name,
            fullName: request.to.name,
            email: request.to.email,
          },
        },
      },
      content: {
        packages: request.packages.map((pkg, index) => ({
          weight: pkg.weight,
          dimensions: {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
          },
          customerReferences: [
            { value: request.reference1 || request.orderId },
          ],
        })),
        isCustomsDeclarable: isInternational,
        declaredValue: request.insurance?.amount || 0,
        declaredValueCurrency: request.insurance?.currency || 'GBP',
        description: 'Merchandise',
        incoterm: 'DAP',
        unitOfMeasurement: 'metric',
      },
      outputImageProperties: {
        printerDPI: 300,
        encodingFormat: request.labelFormat === 'PNG' ? 'png' : 'pdf',
        imageOptions: [
          {
            typeCode: 'label',
            templateName: 'ECOM26_84_001',
          },
        ],
      },
      customerReferences: [
        { value: request.orderId, typeCode: 'CU' },
      ],
    };

    // Add customs declaration for international shipments
    if (isInternational && request.customsInfo) {
      payload.content.exportDeclaration = {
        lineItems: request.customsInfo.items.map((item, index) => ({
          number: index + 1,
          description: item.description,
          price: item.value,
          priceCurrency: item.currency,
          quantity: {
            value: item.quantity,
            unitOfMeasurement: 'PCS',
          },
          weight: {
            netValue: item.weight,
            grossValue: item.weight * 1.1,
          },
          commodityCodes: item.hsCode ? [{ typeCode: 'outbound', value: item.hsCode }] : [],
          manufacturerCountry: item.countryOfOrigin,
        })),
        invoice: {
          number: request.orderId,
          date: new Date().toISOString().split('T')[0],
        },
        exportReason: request.customsInfo.contentsType === 'DOCUMENTS' ? 'documents' : 'commercial',
      };
    }

    return payload;
  }

  async trackShipment(trackingNumber: string): Promise<TrackingResponse> {
    try {
      // Use DHL Tracking API
      const response = await fetch(`${this.getTrackingUrl()}?trackingNumber=${trackingNumber}`, {
        headers: {
          'DHL-API-Key': this.credentials.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Tracking failed: ${response.status}`);
      }

      const data = await response.json();
      const shipment = data.shipments?.[0];

      if (!shipment) {
        throw new Error('No tracking information found');
      }

      const events = (shipment.events || []).map((event: any) => ({
        timestamp: new Date(event.timestamp),
        status: this.mapTrackingStatus(event.statusCode),
        statusDescription: event.description,
        location: event.location?.address?.addressLocality,
        city: event.location?.address?.addressLocality,
        country: event.location?.address?.countryCode,
        postalCode: event.location?.address?.postalCode,
      }));

      const status = shipment.status;

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        trackingNumber,
        status: this.mapTrackingStatus(status?.statusCode),
        statusDescription: status?.description || 'In transit',
        estimatedDeliveryDate: shipment.estimatedTimeOfDelivery 
          ? new Date(shipment.estimatedTimeOfDelivery) 
          : undefined,
        actualDeliveryDate: status?.statusCode === 'delivered' 
          ? new Date(events[0]?.timestamp) 
          : undefined,
        signedBy: shipment.details?.proofOfDelivery?.signedBy,
        events,
      };
    } catch (error: any) {
      this.logger.error(`DHL tracking failed: ${error.message}`);
      throw error;
    }
  }

  private mapTrackingStatus(statusCode: string): TrackingStatus {
    const normalizedStatus = (statusCode || '').toLowerCase();
    
    if (normalizedStatus.includes('delivered')) return 'DELIVERED';
    if (normalizedStatus.includes('out-for-delivery') || normalizedStatus.includes('with delivery courier')) return 'OUT_FOR_DELIVERY';
    if (normalizedStatus.includes('exception') || normalizedStatus.includes('clearance')) return 'EXCEPTION';
    if (normalizedStatus.includes('failure') || normalizedStatus.includes('unsuccessful')) return 'FAILED_ATTEMPT';
    if (normalizedStatus.includes('return')) return 'RETURN_TO_SENDER';
    if (normalizedStatus.includes('transit') || normalizedStatus.includes('processed') || normalizedStatus.includes('arrived') || normalizedStatus.includes('departed')) return 'IN_TRANSIT';
    if (normalizedStatus.includes('picked') || normalizedStatus.includes('shipment information')) return 'PRE_TRANSIT';
    
    return 'IN_TRANSIT';
  }

  async cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(`/shipments/${shipmentId}`, 'DELETE');

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
    // DHL address validation via the address endpoint
    // Note: GET requests cannot have request bodies, so we pass parameters as query string
    try {
      const queryParams = new URLSearchParams({
        type: 'delivery',
        countryCode: address.country,
        postalCode: address.postalCode || '',
        cityName: address.city,
      });
      const response = await this.apiRequest(`/address-validate?${queryParams.toString()}`, 'GET');

      const isValid = response.warnings?.length === 0;

      return {
        isValid,
        normalizedAddress: address,
        suggestions: response.suggestions?.map((s: any) => ({
          ...address,
          city: s.cityName || address.city,
          postalCode: s.postalCode || address.postalCode,
        })),
        errors: response.warnings?.map((w: any) => w.message),
      };
    } catch (error: any) {
      this.logger.warn(`DHL address validation failed: ${error.message}`);
      return {
        isValid: true, // Default to valid if validation fails
        normalizedAddress: address,
      };
    }
  }

  async schedulePickup(request: PickupRequest): Promise<PickupResponse> {
    const payload = {
      plannedPickupDateAndTime: `${request.pickupDate.toISOString().split('T')[0]}T${request.readyTime}:00`,
      closeTime: request.closeTime,
      location: 'reception',
      locationType: 'business',
      accounts: [
        {
          typeCode: 'shipper',
          number: this.credentials.accountNumber,
        },
      ],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: request.from.postalCode,
            cityName: request.from.city,
            countryCode: request.from.country,
            addressLine1: request.from.street1,
          },
          contactInformation: {
            phone: this.validateAndGetPhone(request.from.phone, 'shipper'),
            companyName: request.from.company || request.from.name,
            fullName: request.from.name,
            email: request.from.email,
          },
        },
      },
      shipmentDetails: [
        {
          productCode: 'P',
          accounts: [
            {
              typeCode: 'shipper',
              number: this.credentials.accountNumber,
            },
          ],
          isCustomsDeclarable: false,
          unitOfMeasurement: 'metric',
          packages: [
            {
              weight: request.totalWeight,
            },
          ],
        },
      ],
      specialInstructions: [{ value: request.specialInstructions }],
    };

    try {
      const response = await this.apiRequest('/pickups', 'POST', payload);

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        confirmationNumber: response.dispatchConfirmationNumber,
        pickupDate: request.pickupDate,
        readyTime: request.readyTime,
        closeTime: request.closeTime,
        cancellable: true,
      };
    } catch (error: any) {
      this.logger.error(`DHL schedule pickup failed: ${error.message}`);
      throw error;
    }
  }

  async cancelPickup(confirmationNumber: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(`/pickups/${confirmationNumber}`, 'DELETE');

      return {
        success: true,
        message: 'Pickup cancelled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to cancel pickup: ${error.message}`,
      };
    }
  }

  async getAvailableServices(from: Address, to: Address): Promise<Array<{ code: string; name: string; description?: string }>> {
    return [
      { code: 'P', name: 'DHL Express Worldwide', description: '1-3 business days' },
      { code: 'K', name: 'DHL Express 9:00', description: 'Next business day by 9am' },
      { code: 'E', name: 'DHL Express 10:30', description: 'Next business day by 10:30am' },
      { code: 'N', name: 'DHL Express 12:00', description: 'Next business day by noon' },
      { code: 'W', name: 'DHL Economy Select', description: '3-5 business days' },
      { code: 'X', name: 'DHL Express Envelope', description: 'For documents only' },
    ];
  }
}

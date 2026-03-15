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
 * USPS API Integration
 *
 * Implements USPS Web Tools / USPS API v3 (REST)
 * Documentation: https://developer.usps.com/
 *
 * Required credentials:
 * - clientId: USPS API OAuth2 Client ID
 * - clientSecret: USPS API OAuth2 Client Secret
 * - accountNumber: USPS Mailer ID / CRID (optional for basic rate queries)
 *
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * CourierFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class USPSProvider extends BaseCourierProvider implements ICourierProvider {
  readonly providerId = 'usps';
  readonly providerName = 'USPS';

  private readonly logger = new Logger(USPSProvider.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private static readonly SERVICES: Record<string, { name: string; days: number }> = {
    USPS_GROUND_ADVANTAGE: { name: 'USPS Ground Advantage', days: 5 },
    PRIORITY_MAIL: { name: 'USPS Priority Mail', days: 3 },
    PRIORITY_MAIL_EXPRESS: { name: 'USPS Priority Mail Express', days: 2 },
    FIRST_CLASS_MAIL: { name: 'USPS First-Class Mail', days: 5 },
    MEDIA_MAIL: { name: 'USPS Media Mail', days: 8 },
    PRIORITY_MAIL_INTERNATIONAL: { name: 'USPS Priority Mail International', days: 10 },
    PRIORITY_MAIL_EXPRESS_INTERNATIONAL: {
      name: 'USPS Priority Mail Express International',
      days: 5,
    },
    FIRST_CLASS_MAIL_INTERNATIONAL: { name: 'USPS First-Class Mail International', days: 14 },
  };

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!(this.credentials.clientId && this.credentials.clientSecret);
  }

  protected getBaseUrl(): string {
    return this.isTestMode ? 'https://api-cat.usps.com' : 'https://api.usps.com';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/oauth2/v3/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          scope: 'prices addresses tracking labels',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Auth failed: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);

      return this.accessToken!;
    } catch (error: any) {
      this.logger.error(`USPS authentication failed: ${error.message}`);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private async apiRequest(endpoint: string, method: string = 'POST', body?: any): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText.substring(0, 200);
        } catch {
          // ignore
        }
      }
      this.logger.error(`USPS API error: ${response.status} - ${errorMessage}`);
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
          message: 'Missing required credentials (clientId, clientSecret)',
        };
      }

      await this.getAccessToken();

      return {
        success: true,
        message: `USPS ${this.isTestMode ? 'sandbox' : 'production'} connection successful`,
        details: {
          environment: this.isTestMode ? 'sandbox' : 'production',
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
    const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
    const weightOz = Math.ceil(this.convertWeight(totalWeight, 'lb') * 16);
    const isDomestic = request.to.country === 'US';

    const payload: any = {
      originZIPCode: request.from.postalCode?.replace(/[^0-9]/g, '').substring(0, 5),
      destinationZIPCode: request.to.postalCode?.replace(/[^0-9]/g, '').substring(0, 5),
      weight: weightOz / 16,
      length: Math.ceil(this.convertDimensions(request.packages[0]?.length || 10, 'in')),
      width: Math.ceil(this.convertDimensions(request.packages[0]?.width || 10, 'in')),
      height: Math.ceil(this.convertDimensions(request.packages[0]?.height || 10, 'in')),
      mailClass: 'ALL',
      processingCategory: 'MACHINABLE',
      rateIndicator: 'DR',
      destinationEntryFacilityType: 'NONE',
      priceType: 'RETAIL',
    };

    if (!isDomestic) {
      payload.destinationCountryCode = request.to.country;
    }

    try {
      const endpoint = isDomestic
        ? '/prices/v3/base-rates/search'
        : '/prices/v3/base-rates-international/search';

      const response = await this.apiRequest(endpoint, 'POST', payload);
      const rates: RateResponse[] = [];

      const rateEntries = response.rates || response.rateOptions || [];
      for (const entry of rateEntries) {
        const serviceCode = entry.mailClass || entry.serviceCode || '';
        const serviceInfo = USPSProvider.SERVICES[serviceCode];

        const totalPrice = parseFloat(entry.price || entry.totalBasePrice || '0');
        if (totalPrice <= 0) continue;

        rates.push({
          providerId: this.providerId,
          providerName: this.providerName,
          serviceCode,
          serviceName: serviceInfo?.name || entry.description || serviceCode,
          rate: totalPrice,
          currency: 'USD',
          estimatedDays: serviceInfo?.days || parseInt(entry.deliveryDays || '5', 10),
          trackingIncluded: serviceCode !== 'FIRST_CLASS_MAIL',
          metadata: {
            zone: entry.zone,
            weight: entry.weight,
          },
        });
      }

      return rates.sort((a, b) => a.rate - b.rate);
    } catch (error: any) {
      this.logger.error(`USPS get rates failed: ${error.message}`);
      throw error;
    }
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);

    const payload: any = {
      imageInfo: {
        imageType: request.labelFormat === 'PNG' ? 'PNG' : 'PDF',
        labelType: '4X6LABEL',
      },
      toAddress: {
        firstName: request.to.name?.split(' ')[0] || '',
        lastName: request.to.name?.split(' ').slice(1).join(' ') || '',
        streetAddress: request.to.street1,
        secondaryAddress: request.to.street2,
        city: request.to.city,
        state: request.to.state,
        ZIPCode: request.to.postalCode?.replace(/[^0-9]/g, '').substring(0, 5),
        ZIPPlus4: request.to.postalCode?.replace(/[^0-9]/g, '').substring(5, 9) || undefined,
        phone: request.to.phone,
        email: request.to.email,
      },
      fromAddress: {
        firstName: request.from.name?.split(' ')[0] || '',
        lastName: request.from.name?.split(' ').slice(1).join(' ') || '',
        streetAddress: request.from.street1,
        secondaryAddress: request.from.street2,
        city: request.from.city,
        state: request.from.state,
        ZIPCode: request.from.postalCode?.replace(/[^0-9]/g, '').substring(0, 5),
        ZIPPlus4: request.from.postalCode?.replace(/[^0-9]/g, '').substring(5, 9) || undefined,
        firm: request.from.company,
        phone: request.from.phone,
        email: request.from.email,
      },
      packageDescription: {
        weight: Math.ceil(this.convertWeight(totalWeight, 'lb') * 16),
        length: Math.ceil(this.convertDimensions(request.packages[0]?.length || 10, 'in')),
        width: Math.ceil(this.convertDimensions(request.packages[0]?.width || 10, 'in')),
        height: Math.ceil(this.convertDimensions(request.packages[0]?.height || 10, 'in')),
        mailClass: request.serviceCode,
        processingCategory: 'MACHINABLE',
        rateIndicator: 'DR',
        destinationEntryFacilityType: 'NONE',
      },
    };

    if (request.customsInfo) {
      payload.customsForm = {
        contentType: request.customsInfo.contentsType,
        contentItems: request.customsInfo.items.map((item) => ({
          itemDescription: item.description,
          itemQuantity: item.quantity,
          itemValue: item.value,
          itemWeight: Math.ceil(this.convertWeight(item.weight, 'lb') * 16),
          HSTariffNumber: item.hsCode,
          countryOfOrigin: item.countryOfOrigin,
        })),
      };
    }

    try {
      const response = await this.apiRequest('/labels/v3/label', 'POST', payload);

      const trackingNumber =
        response.trackingNumber || response.labelMetadata?.trackingNumber || '';
      const serviceInfo = USPSProvider.SERVICES[request.serviceCode];

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        shipmentId: trackingNumber,
        trackingNumber,
        trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
        labels: [
          {
            format: (request.labelFormat || 'PDF') as 'PDF' | 'PNG' | 'ZPL',
            data: response.labelImage || '',
            url: response.labelUrl,
            packageIndex: 0,
          },
        ],
        rate: parseFloat(response.postage?.totalPrice || response.totalPrice || '0'),
        currency: 'USD',
        serviceCode: request.serviceCode,
        serviceName: serviceInfo?.name || request.serviceCode,
        estimatedDeliveryDate: response.deliveryDate ? new Date(response.deliveryDate) : undefined,
      };
    } catch (error: any) {
      this.logger.error(`USPS create shipment failed: ${error.message}`);
      throw error;
    }
  }

  async trackShipment(trackingNumber: string): Promise<TrackingResponse> {
    try {
      const response = await this.apiRequest(
        `/tracking/v3/tracking/${encodeURIComponent(trackingNumber)}?expand=DETAIL`,
        'GET',
      );

      const trackingData = response.trackingNumber ? response : response.trackResponse;
      const scanEvents = trackingData?.trackingEvents || [];

      const events = scanEvents.map((event: any) => ({
        timestamp: new Date(`${event.eventDate} ${event.eventTime || '00:00'}`),
        status: this.mapTrackingStatus(event.eventType || event.eventCode || ''),
        statusDescription: event.event || event.eventDescription || '',
        location: event.eventCity,
        city: event.eventCity,
        state: event.eventState,
        country: event.eventCountry || 'US',
        postalCode: event.eventZIPCode,
      }));

      const latestEvent = scanEvents[0];

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        trackingNumber,
        status: latestEvent
          ? this.mapTrackingStatus(latestEvent.eventType || latestEvent.eventCode || '')
          : 'UNKNOWN',
        statusDescription:
          latestEvent?.event || latestEvent?.eventDescription || 'No information available',
        estimatedDeliveryDate: trackingData?.expectedDeliveryDate
          ? new Date(trackingData.expectedDeliveryDate)
          : undefined,
        actualDeliveryDate: trackingData?.actualDeliveryDate
          ? new Date(trackingData.actualDeliveryDate)
          : undefined,
        signedBy: trackingData?.signedForByName,
        events,
      };
    } catch (error: any) {
      this.logger.error(`USPS tracking failed: ${error.message}`);
      throw error;
    }
  }

  private mapTrackingStatus(status: string): TrackingStatus {
    const s = (status || '').toUpperCase();

    if (s.includes('DELIVERED')) return 'DELIVERED';
    if (s.includes('OUT FOR DELIVERY') || s.includes('OUT_FOR_DELIVERY')) return 'OUT_FOR_DELIVERY';
    if (s.includes('NOTICE LEFT') || s.includes('DELIVERY ATTEMPT') || s.includes('NO ACCESS'))
      return 'FAILED_ATTEMPT';
    if (s.includes('RETURN') || s.includes('UNDELIVERABLE')) return 'RETURN_TO_SENDER';
    if (s.includes('DEAD') || s.includes('REFUSED')) return 'EXCEPTION';
    if (s.includes('ACCEPTED') || s.includes('PICKED UP') || s.includes('PRE-SHIPMENT'))
      return 'PRE_TRANSIT';
    if (
      s.includes('IN TRANSIT') ||
      s.includes('ARRIVED') ||
      s.includes('DEPARTED') ||
      s.includes('PROCESSED') ||
      s.includes('ORIGIN') ||
      s.includes('ENROUTE')
    )
      return 'IN_TRANSIT';

    return 'IN_TRANSIT';
  }

  async cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(`/labels/v3/label/${encodeURIComponent(shipmentId)}`, 'DELETE');

      return {
        success: true,
        message: 'USPS label/shipment cancelled successfully',
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
      streetAddress: address.street1,
      secondaryAddress: address.street2,
      city: address.city,
      state: address.state,
      ZIPCode: address.postalCode?.replace(/[^0-9]/g, '').substring(0, 5),
    };

    try {
      const response = await this.apiRequest('/addresses/v3/address', 'POST', payload);

      const result = response.address;
      if (!result) {
        return { isValid: false, errors: ['Address could not be validated'] };
      }

      return {
        isValid:
          !response.addressAdditionalInfo?.DPVConfirmation ||
          response.addressAdditionalInfo.DPVConfirmation === 'Y',
        normalizedAddress: {
          ...address,
          street1: result.streetAddress || address.street1,
          street2: result.secondaryAddress || address.street2,
          city: result.city || address.city,
          state: result.state || address.state,
          postalCode: result.ZIPCode
            ? `${result.ZIPCode}${result.ZIPPlus4 ? `-${result.ZIPPlus4}` : ''}`
            : address.postalCode,
        },
        isResidential: response.addressAdditionalInfo?.business === 'N',
      };
    } catch (error: any) {
      this.logger.warn(`USPS address validation failed: ${error.message}`);
      return {
        isValid: true,
        normalizedAddress: address,
      };
    }
  }

  async getAvailableServices(
    from: Address,
    to: Address,
  ): Promise<Array<{ code: string; name: string; description?: string }>> {
    const isDomestic = from.country === 'US' && to.country === 'US';

    if (isDomestic) {
      return [
        {
          code: 'USPS_GROUND_ADVANTAGE',
          name: 'USPS Ground Advantage',
          description: '2-5 business days',
        },
        { code: 'PRIORITY_MAIL', name: 'USPS Priority Mail', description: '1-3 business days' },
        {
          code: 'PRIORITY_MAIL_EXPRESS',
          name: 'USPS Priority Mail Express',
          description: '1-2 business days, guaranteed',
        },
        {
          code: 'FIRST_CLASS_MAIL',
          name: 'USPS First-Class Mail',
          description: '1-5 business days (under 13oz)',
        },
        {
          code: 'MEDIA_MAIL',
          name: 'USPS Media Mail',
          description: '2-8 business days (books/media only)',
        },
      ];
    }

    return [
      {
        code: 'PRIORITY_MAIL_INTERNATIONAL',
        name: 'USPS Priority Mail International',
        description: '6-10 business days',
      },
      {
        code: 'PRIORITY_MAIL_EXPRESS_INTERNATIONAL',
        name: 'USPS Priority Mail Express International',
        description: '3-5 business days',
      },
      {
        code: 'FIRST_CLASS_MAIL_INTERNATIONAL',
        name: 'USPS First-Class Mail International',
        description: '7-21 business days',
      },
    ];
  }
}

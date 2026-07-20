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
  TrackingEvent,
  AddressValidationResult,
  Address,
  TestConnectionResult,
} from '../interfaces/courier-provider.interface';

interface ShippoAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

interface ShippoParcel {
  length: string;
  width: string;
  height: string;
  distance_unit: 'cm' | 'in';
  weight: string;
  mass_unit: 'kg' | 'lb';
}

/**
 * Shippo multi-carrier shipping integration.
 *
 * Credentials:
 * - apiToken (required): Shippo API token (shippo_test_* or shippo_live_*)
 * - fromAddress (optional): default warehouse/origin address object
 *
 * Docs: https://docs.goshippo.com/
 */
export class ShippoProvider extends BaseCourierProvider implements ICourierProvider {
  readonly providerId = 'shippo';
  readonly providerName = 'Shippo';

  private readonly logger = new Logger(ShippoProvider.name);

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!this.credentials.apiToken?.trim();
  }

  protected getBaseUrl(): string {
    return 'https://api.goshippo.com';
  }

  private getAuthHeader(): string {
    return `ShippoToken ${this.credentials.apiToken}`;
  }

  private async apiRequest(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>,
  ): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method,
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message =
        data?.detail ||
        data?.message ||
        (Array.isArray(data?.messages) ? data.messages.map((m: any) => m.text).join('; ') : null) ||
        text ||
        `Shippo API error (${response.status})`;
      throw new Error(message);
    }

    return data;
  }

  private toShippoAddress(address: Address): ShippoAddress {
    return {
      name: address.name,
      company: address.company,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zip: address.postalCode,
      country: address.country,
      phone: address.phone,
      email: address.email,
    };
  }

  private toShippoParcels(packages: RateRequest['packages']): ShippoParcel[] {
    return packages.map((pkg) => ({
      length: String(Math.max(1, Math.ceil(pkg.length))),
      width: String(Math.max(1, Math.ceil(pkg.width))),
      height: String(Math.max(1, Math.ceil(pkg.height))),
      distance_unit: 'cm',
      weight: String(Math.max(0.01, pkg.weight)),
      mass_unit: 'kg',
    }));
  }

  private async createShippoShipment(request: RateRequest): Promise<any> {
    return this.apiRequest('/shipments/', 'POST', {
      address_from: this.toShippoAddress(request.from),
      address_to: this.toShippoAddress(request.to),
      parcels: this.toShippoParcels(request.packages),
      async: false,
    });
  }

  private mapRates(shipment: any): RateResponse[] {
    const rates = Array.isArray(shipment?.rates) ? shipment.rates : [];

    return rates
      .filter((rate: any) => rate?.amount && rate?.object_id)
      .map((rate: any) => ({
        providerId: this.providerId,
        providerName: this.providerName,
        serviceCode: rate.object_id,
        serviceName: `${rate.provider || 'Carrier'} ${rate.servicelevel?.name || rate.servicelevel?.token || ''}`.trim(),
        rate: parseFloat(rate.amount),
        currency: rate.currency || 'USD',
        estimatedDays: Number(rate.estimated_days) || 5,
        estimatedDeliveryDate: rate.estimated_days
          ? new Date(Date.now() + Number(rate.estimated_days) * 86400000)
          : undefined,
        trackingIncluded: true,
        metadata: {
          shippoRateId: rate.object_id,
          shippoShipmentId: shipment.object_id,
          carrier: rate.provider,
          serviceToken: rate.servicelevel?.token,
          serviceName: rate.servicelevel?.name,
        },
      }))
      .sort((a, b) => a.rate - b.rate);
  }

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    if (!this.isConfigured()) {
      return { success: false, message: 'Missing Shippo API token' };
    }

    try {
      await this.apiRequest('/carrier_accounts/');
      return {
        success: true,
        message: `Shippo ${this.isTestMode ? 'test' : 'live'} connection verified`,
        duration: Date.now() - start,
        details: {
          environment: this.credentials.apiToken?.startsWith('shippo_live_') ? 'live' : 'test',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Shippo connection failed',
        duration: Date.now() - start,
      };
    }
  }

  async getRates(request: RateRequest): Promise<RateResponse[]> {
    const shipment = await this.createShippoShipment(request);
    return this.mapRates(shipment);
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const rateRequest: RateRequest = {
      from: request.from,
      to: request.to,
      packages: request.packages,
      shipDate: request.shipDate,
      service: request.serviceCode,
    };

    const shipment = await this.createShippoShipment(rateRequest);
    const rates = Array.isArray(shipment?.rates) ? shipment.rates : [];

    const selectedRate =
      rates.find((rate: any) => rate.object_id === request.serviceCode) ||
      rates.find((rate: any) => rate.servicelevel?.token === request.serviceCode) ||
      rates[0];

    if (!selectedRate?.object_id) {
      throw new Error('No Shippo rates available for this shipment');
    }

    const labelFormat =
      request.labelFormat === 'PNG' ? 'PNG' : request.labelFormat === 'ZPL' ? 'ZPLII' : 'PDF_4x6';

    const transaction = await this.apiRequest('/transactions/', 'POST', {
      rate: selectedRate.object_id,
      label_file_type: labelFormat,
      async: false,
      metadata: request.reference1 || request.orderId,
    });

    if (transaction?.status === 'ERROR') {
      const messages = Array.isArray(transaction.messages)
        ? transaction.messages.map((m: any) => m.text).join('; ')
        : 'Label purchase failed';
      throw new Error(messages);
    }

    const trackingNumber = transaction.tracking_number || transaction.trackingNumber;
    if (!trackingNumber) {
      throw new Error('Shippo did not return a tracking number');
    }

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      shipmentId: transaction.object_id,
      trackingNumber,
      trackingUrl: transaction.tracking_url_provider || transaction.tracking_url,
      labels: [
        {
          format: request.labelFormat || 'PDF',
          data: '',
          url: transaction.label_url,
          packageIndex: 0,
        },
      ],
      rate: parseFloat(selectedRate.amount),
      currency: selectedRate.currency || 'USD',
      serviceCode: selectedRate.object_id,
      serviceName: `${selectedRate.provider || 'Carrier'} ${selectedRate.servicelevel?.name || ''}`.trim(),
      estimatedDeliveryDate: selectedRate.estimated_days
        ? new Date(Date.now() + Number(selectedRate.estimated_days) * 86400000)
        : undefined,
      metadata: {
        shippoTransactionId: transaction.object_id,
        shippoShipmentId: shipment.object_id,
        shippoRateId: selectedRate.object_id,
        carrier: selectedRate.provider || transaction.carrier,
        commercialInvoiceUrl: transaction.commercial_invoice_url,
      },
    };
  }

  private mapTrackingStatus(status?: string): TrackingStatus {
    switch ((status || '').toUpperCase()) {
      case 'PRE_TRANSIT':
        return 'PRE_TRANSIT';
      case 'TRANSIT':
        return 'IN_TRANSIT';
      case 'DELIVERED':
        return 'DELIVERED';
      case 'RETURNED':
        return 'RETURN_TO_SENDER';
      case 'FAILURE':
        return 'EXCEPTION';
      default:
        return 'UNKNOWN';
    }
  }

  async trackShipment(trackingNumber: string, carrier?: string): Promise<TrackingResponse> {
    const carrierParam = carrier || 'shippo';
    const track = await this.apiRequest(
      `/tracks/${encodeURIComponent(carrierParam)}/${encodeURIComponent(trackingNumber)}/`,
    );

    const events: TrackingEvent[] = (track.tracking_history || []).map((event: any) => ({
      timestamp: new Date(event.status_date || event.object_created),
      status: this.mapTrackingStatus(event.status),
      statusDescription: event.status_details || event.status || 'Update',
      location: event.location?.city
        ? [event.location.city, event.location.state, event.location.country].filter(Boolean).join(', ')
        : undefined,
      city: event.location?.city,
      state: event.location?.state,
      country: event.location?.country,
      postalCode: event.location?.zip,
    }));

    const currentStatus = this.mapTrackingStatus(track.tracking_status?.status);

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      trackingNumber,
      status: currentStatus,
      statusDescription: track.tracking_status?.status_details || currentStatus,
      estimatedDeliveryDate: track.eta ? new Date(track.eta) : undefined,
      actualDeliveryDate:
        currentStatus === 'DELIVERED' && track.tracking_status?.status_date
          ? new Date(track.tracking_status.status_date)
          : undefined,
      events,
      metadata: {
        carrier: track.carrier || carrierParam,
        serviceToken: track.servicelevel?.token,
      },
    };
  }

  async cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }> {
    try {
      const refund = await this.apiRequest('/refunds/', 'POST', {
        transaction: shipmentId,
      });
      const status = refund?.status || refund?.object_status;
      if (status === 'SUCCESS' || status === 'PENDING') {
        return { success: true, message: 'Refund requested successfully' };
      }
      return { success: false, message: refund?.status || 'Refund failed' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Unable to cancel shipment' };
    }
  }

  async validateAddress(address: Address): Promise<AddressValidationResult> {
    try {
      const result = await this.apiRequest('/addresses/', 'POST', {
        ...this.toShippoAddress(address),
        validate: true,
      });

      const validation = result.validation_results || {};
      const isValid = validation.is_valid !== false;

      return {
        isValid,
        normalizedAddress: isValid
          ? {
              name: result.name || address.name,
              company: result.company || address.company,
              street1: result.street1 || address.street1,
              street2: result.street2 || address.street2,
              city: result.city || address.city,
              state: result.state || address.state,
              postalCode: result.zip || address.postalCode,
              country: result.country || address.country,
              phone: result.phone || address.phone,
              email: result.email || address.email,
              isResidential: validation.is_residential ?? address.isResidential,
            }
          : undefined,
        errors: Array.isArray(validation.messages)
          ? validation.messages.map((m: any) => m.text || m.code)
          : isValid
            ? undefined
            : ['Address validation failed'],
        isResidential: validation.is_residential,
      };
    } catch (error: any) {
      return {
        isValid: false,
        errors: [error.message || 'Address validation failed'],
      };
    }
  }
}

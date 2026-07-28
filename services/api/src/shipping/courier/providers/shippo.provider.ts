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
    // Shippo environment is token-driven; align in-memory flag with the token when possible.
    const tokenMode = ShippoProvider.detectTokenMode(credentials?.apiToken);
    super(credentials, tokenMode === 'unknown' ? isTestMode : tokenMode === 'test');
  }

  private static detectTokenMode(token?: string): 'live' | 'test' | 'unknown' {
    const value = String(token || '').trim();
    if (value.startsWith('shippo_live_')) return 'live';
    if (value.startsWith('shippo_test_')) return 'test';
    return 'unknown';
  }

  private getTokenMode(): 'live' | 'test' | 'unknown' {
    return ShippoProvider.detectTokenMode(this.credentials?.apiToken);
  }

  isConfigured(): boolean {
    const token = String(this.credentials?.apiToken || '').trim();
    if (!token) return false;
    // Reject masked admin-UI values accidentally persisted earlier
    if (token === '****' || /^\*{4,}[^*]+$/.test(token)) return false;
    return token.startsWith('shippo_test_') || token.startsWith('shippo_live_');
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
      throw new Error(this.formatShippoError(data, text, response.status));
    }

    return data;
  }

  private formatShippoError(data: any, text: string, status: number): string {
    if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    if (Array.isArray(data?.messages) && data.messages.length) {
      const joined = data.messages
        .map((m: any) => (typeof m === 'string' ? m : m?.text))
        .filter(Boolean)
        .join('; ');
      if (joined) return joined;
    }
    if (data && typeof data === 'object') {
      const fieldErrors = Object.entries(data)
        .filter(([key]) => !['detail', 'message', 'messages'].includes(key))
        .map(([key, value]) => {
          const rendered = Array.isArray(value)
            ? value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ')
            : typeof value === 'string'
              ? value
              : JSON.stringify(value);
          return `${key}: ${rendered}`;
        })
        .filter((part) => part.length < 300)
        .slice(0, 8)
        .join('; ');
      if (fieldErrors) return fieldErrors;
    }
    if (text?.trim()) return text.trim().slice(0, 500);
    return `Shippo API error (${status})`;
  }

  /**
   * Fix common bad inputs like postalCode="NY 10036" (state mashed into ZIP).
   * USPS/Shippo require zip like 10036 or 10036-1234 only.
   */
  private normalizePostalAndState(
    postalCode?: string,
    state?: string,
    country?: string,
  ): { zip: string; state?: string } {
    const rawZip = String(postalCode || '').trim();
    let nextState = state?.trim() || undefined;
    const isUs = ['US', 'USA', 'UNITED STATES'].includes(String(country || '').trim().toUpperCase());

    // "NY 10036" / "NY10036" / "ny-10036"
    const stateZip = rawZip.match(/^([A-Za-z]{2})[\s,.-]*(\d{5}(?:[-\s]?\d{4})?)$/);
    if (stateZip) {
      if (!nextState) nextState = stateZip[1].toUpperCase();
      return { zip: stateZip[2].replace(/\s+/g, '-'), state: nextState };
    }

    // Pull a ZIP out of mixed strings ("New York NY 10036")
    const zipOnly = rawZip.match(/\b(\d{5}(?:[-\s]?\d{4})?)\b/);
    if (zipOnly) {
      return { zip: zipOnly[1].replace(/\s+/g, '-'), state: nextState };
    }

    if (isUs && rawZip && !/^\d{5}(-\d{4})?$/.test(rawZip)) {
      this.logger.warn(
        `Suspicious US postal code "${rawZip}" — carriers may return 0 rates. Expected 5-digit ZIP.`,
      );
    }

    return { zip: rawZip, state: nextState };
  }

  private toShippoAddress(address: Address): ShippoAddress {
    const country = String(address.country || '')
      .trim()
      .toUpperCase();
    // Shippo expects ISO 2-letter country codes
    const normalizedCountry =
      country === 'USA' || country === 'UNITED STATES'
        ? 'US'
        : country === 'UK' || country === 'GBR'
          ? 'GB'
          : country;

    const { zip, state } = this.normalizePostalAndState(
      address.postalCode,
      address.state,
      normalizedCountry,
    );

    return {
      name: address.name || 'Recipient',
      company: address.company,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state,
      zip,
      country: normalizedCountry,
      phone: address.phone,
      email: address.email,
    };
  }

  private safePositive(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  private toShippoParcels(packages: RateRequest['packages']): ShippoParcel[] {
    const list = Array.isArray(packages) && packages.length > 0 ? packages : [{ length: 30, width: 20, height: 10, weight: 1 }];
    return list.map((pkg) => ({
      length: String(Math.max(1, Math.ceil(this.safePositive(pkg.length, 30)))),
      width: String(Math.max(1, Math.ceil(this.safePositive(pkg.width, 20)))),
      height: String(Math.max(1, Math.ceil(this.safePositive(pkg.height, 10)))),
      distance_unit: 'cm',
      weight: String(Math.max(0.01, this.safePositive(pkg.weight, 1))),
      mass_unit: 'kg',
    }));
  }

  private assertAddress(label: string, address: Address): void {
    const missing: string[] = [];
    if (!address?.street1?.trim()) missing.push('street');
    if (!address?.city?.trim()) missing.push('city');
    if (!address?.postalCode?.trim()) missing.push('postal code');
    if (!address?.country?.trim()) missing.push('country');
    if (missing.length) {
      throw new Error(`Shippo ${label} address is incomplete (missing ${missing.join(', ')})`);
    }
  }

  private async createShippoShipment(request: RateRequest): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error(
        'Shippo is not configured with a valid API token (expected shippo_live_… or shippo_test_…). Re-save the token in Admin → Integrations → Shipping.',
      );
    }
    this.assertAddress('origin', request.from);
    this.assertAddress('destination', request.to);

    return this.apiRequest('/shipments/', 'POST', {
      address_from: this.toShippoAddress(request.from),
      address_to: this.toShippoAddress(request.to),
      parcels: this.toShippoParcels(request.packages),
      async: false,
    });
  }

  private mapRates(shipment: any): RateResponse[] {
    const rates = Array.isArray(shipment?.rates) ? shipment.rates : [];
    const tokenMode = this.getTokenMode();

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
          shippoTest: rate.test === true,
          tokenEnvironment: tokenMode,
        },
      }))
      .sort((a, b) => a.rate - b.rate);
  }

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    if (!this.isConfigured()) {
      return { success: false, message: 'Missing Shippo API token' };
    }

    const tokenMode = this.getTokenMode();
    try {
      const accounts = await this.apiRequest('/carrier_accounts/');
      const accountCount = Array.isArray(accounts?.results)
        ? accounts.results.length
        : Array.isArray(accounts)
          ? accounts.length
          : 0;

      if (tokenMode === 'test') {
        return {
          success: true,
          message:
            'Shippo test token verified. Rates from this token are sandbox/mock and will not match live pricing.',
          duration: Date.now() - start,
          details: {
            environment: 'test',
            carrierAccounts: accountCount,
            hint: 'Replace apiToken with a shippo_live_ key for real carrier rates.',
          },
        };
      }

      if (tokenMode === 'unknown') {
        return {
          success: true,
          message:
            'Shippo connection verified, but token prefix is unrecognized. Use shippo_live_ for live rates.',
          duration: Date.now() - start,
          details: { environment: 'unknown', carrierAccounts: accountCount },
        };
      }

      return {
        success: true,
        message: `Shippo live connection verified (${accountCount} carrier account${accountCount === 1 ? '' : 's'})`,
        duration: Date.now() - start,
        details: { environment: 'live', carrierAccounts: accountCount },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Shippo connection failed',
        duration: Date.now() - start,
        details: { environment: tokenMode },
      };
    }
  }

  async getRates(request: RateRequest): Promise<RateResponse[]> {
    const tokenMode = this.getTokenMode();
    if (tokenMode === 'test') {
      this.logger.warn(
        'Requesting Shippo rates with a shippo_test_ token — response will be sandbox/mock rates, not live carrier pricing.',
      );
    }

    const shipment = await this.createShippoShipment(request);
    const mapped = this.mapRates(shipment);

    if (mapped.length === 0) {
      const messages = Array.isArray(shipment?.messages)
        ? shipment.messages.map((m: any) => m.text || m).filter(Boolean).join('; ')
        : '';
      this.logger.warn(
        `Shippo returned 0 rates (token=${tokenMode}). ${messages || 'No carrier messages returned.'}`,
      );

      const zipHint =
        /originZIPCode|postal|zip/i.test(messages) || /[A-Z]{2}\s+\d{5}/.test(messages)
          ? ' Origin/destination ZIP must be digits only (e.g. 10036), not "NY 10036".'
          : '';
      const tokenHint =
        tokenMode === 'test'
          ? ' A shippo_test_ token is configured — use shippo_live_ for production carrier rates.'
          : '';
      const detail = messages ? ` Details: ${messages.slice(0, 350)}` : '';
      throw new Error(
        `Shippo returned no rates for this shipment.${zipHint}${tokenHint}${detail}`.trim(),
      );
    }

    const testCount = mapped.filter((r) => r.metadata?.shippoTest === true).length;
    this.logger.log(
      `Shippo returned ${mapped.length} rates (token=${tokenMode}, testFlag=${testCount}/${mapped.length})`,
    );

    return mapped;
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

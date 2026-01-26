import { Logger } from '@nestjs/common';
import {
  BaseTaxProvider,
  ITaxProvider,
  TaxCalculationRequest,
  TaxCalculationResponse,
  TaxLineItemResult,
  TaxJurisdictionDetail,
  TaxSummary,
  TaxAddress,
  AddressValidationResult,
  ExemptionCertificate,
  TestConnectionResult,
  TaxLineItem,
} from '../interfaces/tax-provider.interface';

/**
 * Avalara AvaTax API Integration
 * 
 * Implements Avalara AvaTax REST API v2
 * Documentation: https://developer.avalara.com/api-reference/avatax/rest/v2/
 * 
 * Required credentials:
 * - accountId: Avalara account ID
 * - licenseKey: Avalara license key
 * - companyCode: Company code in AvaTax
 * 
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * TaxFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class AvalaraProvider extends BaseTaxProvider implements ITaxProvider {
  readonly providerId = 'avalara';
  readonly providerName = 'Avalara AvaTax';
  
  private readonly logger = new Logger(AvalaraProvider.name);

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.accountId &&
      this.credentials.licenseKey &&
      this.credentials.companyCode
    );
  }

  protected getBaseUrl(): string {
    return this.isTestMode
      ? 'https://sandbox-rest.avatax.com/api/v2'
      : 'https://rest.avatax.com/api/v2';
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any,
  ): Promise<any> {
    const auth = Buffer.from(
      `${this.credentials.accountId}:${this.credentials.licenseKey}`
    ).toString('base64');

    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Avalara-Client': 'HOS-Marketplace;1.0;REST;v2',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.error?.message || 'Unknown error';
      this.logger.error(`Avalara API error: ${response.status} - ${errorMessage}`);
      throw new Error(`API error: ${errorMessage}`);
    }

    return responseData;
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          message: 'Missing required credentials (accountId, licenseKey, companyCode)',
        };
      }

      // Ping the API to test connection
      const response = await this.apiRequest('/utilities/ping');

      if (response.authenticated === true) {
        return {
          success: true,
          message: `Avalara ${this.isTestMode ? 'sandbox' : 'production'} connection successful`,
          details: {
            environment: this.isTestMode ? 'sandbox' : 'production',
            version: response.version,
            authenticatedAs: response.authenticatedUserName,
          },
          duration: Date.now() - startTime,
        };
      }

      return {
        success: false,
        message: 'Authentication failed',
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

  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse> {
    const payload = this.buildTransactionPayload(request);

    try {
      const response = await this.apiRequest(
        `/transactions/create`,
        'POST',
        payload,
      );

      return this.parseTransactionResponse(response);
    } catch (error: any) {
      this.logger.error(`Avalara tax calculation failed: ${error.message}`);
      throw error;
    }
  }

  private buildTransactionPayload(request: TaxCalculationRequest): any {
    return {
      type: this.mapTransactionType(request.transactionType),
      companyCode: this.credentials.companyCode,
      code: request.transactionId,
      date: this.formatDate(request.transactionDate),
      customerCode: request.customerCode || 'GUEST',
      currencyCode: request.currencyCode,
      commit: request.isCommit || false,
      addresses: {
        shipFrom: this.formatAddress(request.fromAddress, 'shipFrom'),
        shipTo: this.formatAddress(request.toAddress, 'shipTo'),
      },
      lines: request.lineItems.map((item, index) => ({
        number: (index + 1).toString(),
        itemCode: item.productId || item.sku || item.id,
        description: item.description,
        quantity: item.quantity,
        amount: item.amount,
        taxCode: item.taxCode || 'P0000000', // General merchandise
        discounted: item.discountAmount ? true : false,
        taxIncluded: item.isTaxIncluded || false,
        ref1: item.id,
      })),
      exemptionNo: request.exemptionNumber,
      discount: request.discount ? {
        type: request.discount.type === 'PERCENTAGE' ? 'Percentage' : 'Amount',
        amount: request.discount.amount,
      } : undefined,
    };
  }

  private mapTransactionType(type: string): string {
    switch (type) {
      case 'SALE': return 'SalesInvoice';
      case 'RETURN': return 'ReturnInvoice';
      case 'ESTIMATE': return 'SalesOrder';
      default: return 'SalesOrder';
    }
  }

  private formatAddress(address: TaxAddress, type: string): any {
    return {
      locationCode: type,
      line1: address.street1,
      line2: address.street2,
      city: address.city,
      region: address.state,
      postalCode: address.postalCode,
      country: address.country,
    };
  }

  private parseTransactionResponse(response: any): TaxCalculationResponse {
    const lines: TaxLineItemResult[] = (response.lines || []).map((line: any) => ({
      lineItemId: line.ref1 || line.lineNumber,
      taxableAmount: line.taxableAmount,
      taxAmount: line.tax,
      taxRate: line.taxableAmount > 0 ? line.tax / line.taxableAmount : 0,
      exemptAmount: line.exemptAmount,
      details: (line.details || []).map((detail: any) => ({
        jurisdictionType: this.mapJurisdictionType(detail.jurisdictionType),
        jurisdictionName: detail.jurisName,
        jurisdictionCode: detail.jurisCode,
        taxType: detail.taxType,
        taxableAmount: detail.taxableAmount,
        taxAmount: detail.tax,
        taxRate: detail.rate,
      })),
    }));

    const summary: TaxSummary[] = (response.summary || []).map((s: any) => ({
      taxType: s.taxType,
      jurisdictionName: s.jurisName,
      taxableAmount: s.taxable,
      taxAmount: s.tax,
      taxRate: s.rate,
    }));

    return {
      transactionId: response.code,
      documentCode: response.id?.toString(),
      status: this.mapStatus(response.status),
      transactionDate: new Date(response.date),
      totalAmount: response.totalAmount,
      totalTaxableAmount: response.totalTaxable,
      totalTaxAmount: response.totalTax,
      totalExemptAmount: response.totalExempt,
      currencyCode: response.currencyCode,
      lineItems: lines,
      summary,
      metadata: {
        avalaraDocumentId: response.id,
        locked: response.locked,
        region: response.region,
        country: response.country,
      },
    };
  }

  private mapJurisdictionType(type: string): 'COUNTRY' | 'STATE' | 'COUNTY' | 'CITY' | 'DISTRICT' {
    switch (type?.toUpperCase()) {
      case 'COUNTRY': return 'COUNTRY';
      case 'STATE': return 'STATE';
      case 'COUNTY': return 'COUNTY';
      case 'CITY': return 'CITY';
      case 'SPECIAL': return 'DISTRICT';
      default: return 'STATE';
    }
  }

  private mapStatus(status: string): 'TEMPORARY' | 'SAVED' | 'COMMITTED' | 'CANCELLED' {
    switch (status?.toLowerCase()) {
      case 'temporary': return 'TEMPORARY';
      case 'saved': return 'SAVED';
      case 'committed': return 'COMMITTED';
      case 'cancelled': return 'CANCELLED';
      case 'adjusted': return 'COMMITTED';
      case 'posted': return 'COMMITTED';
      default: return 'SAVED';
    }
  }

  async commitTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(
        `/companies/${this.credentials.companyCode}/transactions/${transactionId}/commit`,
        'POST',
        { commit: true },
      );

      return {
        success: true,
        message: 'Transaction committed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to commit transaction: ${error.message}`,
      };
    }
  }

  async voidTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(
        `/companies/${this.credentials.companyCode}/transactions/${transactionId}/void`,
        'POST',
        { code: 'DocVoided' },
      );

      return {
        success: true,
        message: 'Transaction voided successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to void transaction: ${error.message}`,
      };
    }
  }

  async refundTransaction(
    originalTransactionId: string,
    refundTransactionId: string,
    items: TaxLineItem[],
  ): Promise<TaxCalculationResponse> {
    // Create a return transaction referencing the original
    const payload = {
      refundTransactionCode: originalTransactionId,
      refundDate: this.formatDate(new Date()),
      refundType: 'Partial',
      refundLines: items.map((item, index) => ({
        lineNumber: (index + 1).toString(),
        quantity: item.quantity,
        amount: item.amount,
      })),
    };

    try {
      const response = await this.apiRequest(
        `/companies/${this.credentials.companyCode}/transactions/${originalTransactionId}/refund`,
        'POST',
        payload,
      );

      return this.parseTransactionResponse(response);
    } catch (error: any) {
      this.logger.error(`Avalara refund failed: ${error.message}`);
      throw error;
    }
  }

  async validateAddress(address: TaxAddress): Promise<AddressValidationResult> {
    try {
      const response = await this.apiRequest(
        `/addresses/resolve`,
        'POST',
        {
          line1: address.street1,
          line2: address.street2,
          city: address.city,
          region: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
      );

      const validatedAddress = response.validatedAddresses?.[0];
      
      return {
        isValid: response.coordinates !== null,
        normalizedAddress: validatedAddress ? {
          street1: validatedAddress.line1,
          street2: validatedAddress.line2,
          city: validatedAddress.city,
          state: validatedAddress.region,
          postalCode: validatedAddress.postalCode,
          country: validatedAddress.country,
        } : address,
        taxJurisdictions: response.taxAuthorities?.map((auth: any) => ({
          code: auth.jurisdictionCode,
          name: auth.jurisdictionName,
          type: auth.jurisdictionType,
        })),
        messages: response.messages?.map((m: any) => m.summary),
      };
    } catch (error: any) {
      this.logger.warn(`Avalara address validation failed: ${error.message}`);
      return {
        isValid: true,
        normalizedAddress: address,
        messages: [error.message],
      };
    }
  }

  async getExemptionCertificates(customerId: string): Promise<ExemptionCertificate[]> {
    try {
      const response = await this.apiRequest(
        `/companies/${this.credentials.companyCode}/customers/${customerId}/certificates`,
      );

      return (response.value || []).map((cert: any) => ({
        id: cert.id.toString(),
        customerId,
        customerName: cert.customerName,
        certificateNumber: cert.exemptionNumber,
        exemptionReason: cert.exemptReasonId,
        region: cert.region,
        country: cert.country,
        validFrom: new Date(cert.effectiveDate),
        validTo: cert.expirationDate ? new Date(cert.expirationDate) : undefined,
        status: cert.status === 'Active' ? 'ACTIVE' : 'EXPIRED',
        documentUrl: cert.pdfUrl,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to get exemption certificates: ${error.message}`);
      return [];
    }
  }

  async getTaxCodes(): Promise<Array<{ code: string; description: string }>> {
    try {
      const response = await this.apiRequest('/definitions/taxcodes?$top=100');

      return (response.value || []).map((tc: any) => ({
        code: tc.taxCode,
        description: tc.description,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to get tax codes: ${error.message}`);
      return [];
    }
  }

  async getNexusLocations(): Promise<Array<{ country: string; region: string; hasNexus: boolean }>> {
    try {
      const response = await this.apiRequest(
        `/companies/${this.credentials.companyCode}/nexus`,
      );

      return (response.value || []).map((nexus: any) => ({
        country: nexus.country,
        region: nexus.region,
        hasNexus: nexus.hasLocalNexus || nexus.hasPhysicalNexus,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to get nexus locations: ${error.message}`);
      return [];
    }
  }
}

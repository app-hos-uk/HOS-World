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
  TestConnectionResult,
  TaxLineItem,
} from '../interfaces/tax-provider.interface';

/**
 * TaxJar API Integration
 *
 * Implements TaxJar REST API
 * Documentation: https://developers.taxjar.com/api/reference/
 *
 * Required credentials:
 * - apiToken: TaxJar API token
 *
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * TaxFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class TaxJarProvider extends BaseTaxProvider implements ITaxProvider {
  readonly providerId = 'taxjar';
  readonly providerName = 'TaxJar';

  private readonly logger = new Logger(TaxJarProvider.name);

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
  }

  isConfigured(): boolean {
    return !!this.credentials.apiToken;
  }

  protected getBaseUrl(): string {
    return this.isTestMode ? 'https://api.sandbox.taxjar.com/v2' : 'https://api.taxjar.com/v2';
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.credentials.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.error || responseData.detail || 'Unknown error';
      this.logger.error(`TaxJar API error: ${response.status} - ${errorMessage}`);
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
          message: 'Missing required credentials (apiToken)',
        };
      }

      // Get categories to test connection
      const response = await this.apiRequest('/categories');

      if (response.categories) {
        return {
          success: true,
          message: `TaxJar ${this.isTestMode ? 'sandbox' : 'production'} connection successful`,
          details: {
            environment: this.isTestMode ? 'sandbox' : 'production',
            categoriesAvailable: response.categories.length,
          },
          duration: Date.now() - startTime,
        };
      }

      return {
        success: false,
        message: 'Unexpected response from TaxJar',
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
    const payload = this.buildTaxPayload(request);

    try {
      const response = await this.apiRequest('/taxes', 'POST', payload);

      return this.parseTaxResponse(request, response.tax);
    } catch (error: any) {
      this.logger.error(`TaxJar tax calculation failed: ${error.message}`);
      throw error;
    }
  }

  private buildTaxPayload(request: TaxCalculationRequest): any {
    const totalAmount = request.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const totalShipping = request.shippingAmount || 0;

    return {
      from_country: request.fromAddress.country,
      from_zip: request.fromAddress.postalCode,
      from_state: request.fromAddress.state,
      from_city: request.fromAddress.city,
      from_street: request.fromAddress.street1,
      to_country: request.toAddress.country,
      to_zip: request.toAddress.postalCode,
      to_state: request.toAddress.state,
      to_city: request.toAddress.city,
      to_street: request.toAddress.street1,
      amount: totalAmount,
      shipping: totalShipping,
      exemption_type: request.exemptionNumber ? 'wholesale' : undefined,
      line_items: request.lineItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product_tax_code: item.taxCode,
        unit_price: item.unitPrice,
        discount: item.discountAmount || 0,
      })),
    };
  }

  private parseTaxResponse(request: TaxCalculationRequest, response: any): TaxCalculationResponse {
    const jurisdictions = response.breakdown?.jurisdictions || {};

    // Parse line items
    const lineItems: TaxLineItemResult[] = (response.breakdown?.line_items || []).map(
      (line: any) => ({
        lineItemId: line.id,
        taxableAmount: line.taxable_amount,
        taxAmount: line.tax_collectable,
        taxRate: line.combined_tax_rate || 0,
        exemptAmount: 0,
        details: this.extractJurisdictionDetails(line),
      }),
    );

    // If no line item breakdown, create from request
    if (lineItems.length === 0) {
      request.lineItems.forEach((item) => {
        lineItems.push({
          lineItemId: item.id,
          taxableAmount: item.amount,
          taxAmount: this.roundTax(item.amount * (response.rate || 0)),
          taxRate: response.rate || 0,
          exemptAmount: 0,
          details: [],
        });
      });
    }

    // Build summary
    const summary: TaxSummary[] = [];

    if (response.breakdown) {
      if (response.breakdown.state_tax_collectable > 0) {
        summary.push({
          taxType: 'STATE_TAX',
          jurisdictionName: response.breakdown.state || request.toAddress.state || '',
          taxableAmount: response.breakdown.state_taxable_amount || response.taxable_amount,
          taxAmount: response.breakdown.state_tax_collectable,
          taxRate: response.breakdown.state_tax_rate || 0,
        });
      }
      if (response.breakdown.county_tax_collectable > 0) {
        summary.push({
          taxType: 'COUNTY_TAX',
          jurisdictionName: response.breakdown.county || '',
          taxableAmount: response.breakdown.county_taxable_amount || response.taxable_amount,
          taxAmount: response.breakdown.county_tax_collectable,
          taxRate: response.breakdown.county_tax_rate || 0,
        });
      }
      if (response.breakdown.city_tax_collectable > 0) {
        summary.push({
          taxType: 'CITY_TAX',
          jurisdictionName: response.breakdown.city || request.toAddress.city,
          taxableAmount: response.breakdown.city_taxable_amount || response.taxable_amount,
          taxAmount: response.breakdown.city_tax_collectable,
          taxRate: response.breakdown.city_tax_rate || 0,
        });
      }
      if (response.breakdown.special_tax_rate > 0) {
        summary.push({
          taxType: 'SPECIAL_TAX',
          jurisdictionName: 'Special Districts',
          taxableAmount: response.breakdown.special_taxable_amount || response.taxable_amount,
          taxAmount: response.breakdown.special_district_tax_collectable || 0,
          taxRate: response.breakdown.special_tax_rate || 0,
        });
      }
    }

    const totalAmount =
      request.lineItems.reduce((sum, item) => sum + item.amount, 0) +
      (request.shippingAmount || 0) +
      (response.amount_to_collect || 0);

    return {
      transactionId: request.transactionId,
      documentCode: undefined, // TaxJar uses transaction_id from /transactions
      status: 'TEMPORARY', // Calculations are temporary until committed via /transactions
      transactionDate: request.transactionDate,
      totalAmount,
      totalTaxableAmount: response.taxable_amount || 0,
      totalTaxAmount: response.amount_to_collect || 0,
      totalExemptAmount: response.exempt_amount || 0,
      currencyCode: request.currencyCode,
      lineItems,
      summary,
      metadata: {
        rate: response.rate,
        hasNexus: response.has_nexus,
        freightTaxable: response.freight_taxable,
      },
    };
  }

  private extractJurisdictionDetails(line: any): TaxJurisdictionDetail[] {
    const details: TaxJurisdictionDetail[] = [];

    if (line.state_taxable_amount > 0) {
      details.push({
        jurisdictionType: 'STATE',
        jurisdictionName: line.state || '',
        taxType: 'SALES_TAX',
        taxableAmount: line.state_taxable_amount,
        taxAmount: line.state_sales_tax_rate * line.state_taxable_amount,
        taxRate: line.state_sales_tax_rate || 0,
      });
    }

    if (line.county_taxable_amount > 0) {
      details.push({
        jurisdictionType: 'COUNTY',
        jurisdictionName: line.county || '',
        taxType: 'SALES_TAX',
        taxableAmount: line.county_taxable_amount,
        taxAmount: line.county_tax_rate * line.county_taxable_amount,
        taxRate: line.county_tax_rate || 0,
      });
    }

    if (line.city_taxable_amount > 0) {
      details.push({
        jurisdictionType: 'CITY',
        jurisdictionName: line.city || '',
        taxType: 'SALES_TAX',
        taxableAmount: line.city_taxable_amount,
        taxAmount: line.city_tax_rate * line.city_taxable_amount,
        taxRate: line.city_tax_rate || 0,
      });
    }

    return details;
  }

  async commitTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    // TaxJar commits transactions by creating them via /transactions endpoint
    // The calculation from /taxes is not stored - you need to create a transaction
    return {
      success: true,
      message:
        'TaxJar transactions are committed via createOrder. Use refundTransaction for returns.',
    };
  }

  async voidTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.apiRequest(`/transactions/orders/${transactionId}`, 'DELETE');

      return {
        success: true,
        message: 'Transaction deleted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to delete transaction: ${error.message}`,
      };
    }
  }

  async refundTransaction(
    originalTransactionId: string,
    refundTransactionId: string,
    items: TaxLineItem[],
  ): Promise<TaxCalculationResponse> {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
      transaction_id: refundTransactionId,
      transaction_reference_id: originalTransactionId,
      transaction_date: this.formatDate(new Date()),
      amount: -Math.abs(totalAmount),
      shipping: 0,
      sales_tax: 0, // Will be calculated
      line_items: items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product_tax_code: item.taxCode,
        unit_price: -Math.abs(item.unitPrice),
        discount: item.discountAmount || 0,
      })),
    };

    try {
      const response = await this.apiRequest('/transactions/refunds', 'POST', payload);

      return {
        transactionId: refundTransactionId,
        documentCode: response.refund?.transaction_id,
        status: 'COMMITTED',
        transactionDate: new Date(),
        totalAmount: response.refund?.amount || 0,
        totalTaxableAmount: response.refund?.amount || 0,
        totalTaxAmount: response.refund?.sales_tax || 0,
        totalExemptAmount: 0,
        currencyCode: 'USD',
        lineItems: [],
        summary: [],
      };
    } catch (error: any) {
      this.logger.error(`TaxJar refund failed: ${error.message}`);
      throw error;
    }
  }

  async validateAddress(address: TaxAddress): Promise<AddressValidationResult> {
    // TaxJar provides address validation via their /addresses/validate endpoint
    try {
      const response = await this.apiRequest('/addresses/validate', 'POST', {
        country: address.country,
        state: address.state,
        zip: address.postalCode,
        city: address.city,
        street: address.street1,
      });

      const validatedAddress = response.addresses?.[0];

      return {
        isValid: !!validatedAddress,
        normalizedAddress: validatedAddress
          ? {
              street1: validatedAddress.street || address.street1,
              street2: address.street2,
              city: validatedAddress.city || address.city,
              state: validatedAddress.state || address.state,
              postalCode: validatedAddress.zip || address.postalCode,
              country: validatedAddress.country || address.country,
            }
          : address,
      };
    } catch (error: any) {
      this.logger.warn(`TaxJar address validation failed: ${error.message}`);
      return {
        isValid: true,
        normalizedAddress: address,
        messages: [error.message],
      };
    }
  }

  async getTaxCodes(): Promise<Array<{ code: string; description: string }>> {
    try {
      const response = await this.apiRequest('/categories');

      return (response.categories || []).map((cat: any) => ({
        code: cat.product_tax_code,
        description: `${cat.name}: ${cat.description}`,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to get tax categories: ${error.message}`);
      return [];
    }
  }

  async getNexusLocations(): Promise<
    Array<{ country: string; region: string; hasNexus: boolean }>
  > {
    try {
      const response = await this.apiRequest('/nexus/regions');

      return (response.regions || []).map((region: any) => ({
        country: region.country_code,
        region: region.region_code,
        hasNexus: true,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to get nexus regions: ${error.message}`);
      return [];
    }
  }

  /**
   * Create an order transaction in TaxJar for reporting
   * This should be called after a successful order to record the transaction
   */
  async createOrderTransaction(
    request: TaxCalculationRequest,
    taxAmount: number,
  ): Promise<{ success: boolean; transactionId: string }> {
    const totalAmount = request.lineItems.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
      transaction_id: request.transactionId,
      transaction_date: this.formatDate(request.transactionDate),
      from_country: request.fromAddress.country,
      from_zip: request.fromAddress.postalCode,
      from_state: request.fromAddress.state,
      from_city: request.fromAddress.city,
      from_street: request.fromAddress.street1,
      to_country: request.toAddress.country,
      to_zip: request.toAddress.postalCode,
      to_state: request.toAddress.state,
      to_city: request.toAddress.city,
      to_street: request.toAddress.street1,
      amount: totalAmount,
      shipping: request.shippingAmount || 0,
      sales_tax: taxAmount,
      line_items: request.lineItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product_identifier: item.productId || item.sku,
        description: item.description,
        product_tax_code: item.taxCode,
        unit_price: item.unitPrice,
        discount: item.discountAmount || 0,
        sales_tax: this.roundTax(item.amount * (taxAmount / totalAmount)),
      })),
    };

    try {
      const response = await this.apiRequest('/transactions/orders', 'POST', payload);

      return {
        success: true,
        transactionId: response.order?.transaction_id || request.transactionId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create TaxJar order: ${error.message}`);
      return {
        success: false,
        transactionId: request.transactionId,
      };
    }
  }
}

import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
  BaseTaxProvider,
  ITaxProvider,
  TaxCalculationRequest,
  TaxCalculationResponse,
  TaxLineItem,
  TaxLineItemResult,
  TaxJurisdictionDetail,
  TaxSummary,
  TaxAddress,
  AddressValidationResult,
  TestConnectionResult,
} from '../interfaces/tax-provider.interface';

/**
 * Stripe Tax Integration
 *
 * Uses Stripe Tax API for automatic tax calculation.
 * Supports US sales tax, EU VAT, and other jurisdictions.
 *
 * Required credentials:
 * - apiKey: Stripe API secret key (same as payment key)
 *
 * NOTE: This class is NOT a NestJS provider. It is instantiated manually by
 * TaxFactoryService with credentials loaded from the IntegrationConfig table.
 */
export class StripeTaxProvider extends BaseTaxProvider implements ITaxProvider {
  readonly providerId = 'stripe_tax';
  readonly providerName = 'Stripe Tax';

  private readonly logger = new Logger(StripeTaxProvider.name);
  private stripe: Stripe;

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    super(credentials, isTestMode);
    this.stripe = new Stripe(credentials.apiKey, {
      apiVersion: '2023-10-16',
    });
  }

  isConfigured(): boolean {
    return !!this.credentials.apiKey;
  }

  protected getBaseUrl(): string {
    return 'https://api.stripe.com';
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const settings = await this.stripe.tax.settings.retrieve();
      return {
        success: true,
        message: `Stripe Tax connected. Status: ${settings.status}`,
        details: {
          status: settings.status,
          headOffice: settings.head_office,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Stripe Tax connection failed: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse> {
    try {
      const lineItems: Stripe.Tax.CalculationCreateParams.LineItem[] = request.lineItems.map(
        (item) => ({
          amount: Math.round(item.amount * 100),
          reference: item.id,
          tax_code: item.taxCode || 'txcd_99999999',
          quantity: item.quantity,
        }),
      );

      if (request.shippingAmount && request.shippingAmount > 0) {
        lineItems.push({
          amount: Math.round(request.shippingAmount * 100),
          reference: 'shipping',
          tax_code: request.shippingTaxCode || 'txcd_92010001',
          quantity: 1,
        });
      }

      const calculation = await this.stripe.tax.calculations.create({
        currency: request.currencyCode.toLowerCase(),
        customer_details: {
          address: {
            line1: request.toAddress.street1,
            line2: request.toAddress.street2 || undefined,
            city: request.toAddress.city,
            state: request.toAddress.state || undefined,
            postal_code: request.toAddress.postalCode,
            country: request.toAddress.country,
          },
          address_source: 'shipping',
        },
        line_items: lineItems,
        shipping_cost: { amount: 0 },
      });

      const resultLineItems: TaxLineItemResult[] = [];
      const calcLineItems = calculation.line_items?.data || [];

      for (const li of calcLineItems) {
        const details: TaxJurisdictionDetail[] = [];
        const breakdown = (li as any).tax_breakdown || [];
        for (const bd of breakdown) {
          details.push({
            jurisdictionType: this.mapJurisdictionType(bd.jurisdiction?.level || 'state'),
            jurisdictionName: bd.jurisdiction?.display_name || bd.jurisdiction?.state || '',
            jurisdictionCode: bd.jurisdiction?.state || undefined,
            taxType: bd.tax_rate_details?.tax_type || 'sales_tax',
            taxableAmount: (bd.taxable_amount || 0) / 100,
            taxAmount: (bd.amount || 0) / 100,
            taxRate: bd.tax_rate_details?.percentage_decimal
              ? parseFloat(bd.tax_rate_details.percentage_decimal) / 100
              : 0,
          });
        }

        resultLineItems.push({
          lineItemId: li.reference || '',
          taxableAmount: (li.amount || 0) / 100,
          taxAmount: (li.amount_tax || 0) / 100,
          taxRate: li.amount > 0 ? (li.amount_tax || 0) / li.amount : 0,
          details,
        });
      }

      const summaryMap = new Map<string, TaxSummary>();
      for (const li of resultLineItems) {
        for (const detail of li.details) {
          const key = `${detail.jurisdictionType}-${detail.jurisdictionName}`;
          const existing = summaryMap.get(key);
          if (existing) {
            existing.taxableAmount += detail.taxableAmount;
            existing.taxAmount += detail.taxAmount;
          } else {
            summaryMap.set(key, {
              taxType: detail.taxType,
              jurisdictionName: detail.jurisdictionName,
              taxableAmount: detail.taxableAmount,
              taxAmount: detail.taxAmount,
              taxRate: detail.taxRate,
            });
          }
        }
      }

      return {
        transactionId: request.transactionId,
        documentCode: calculation.id,
        status: 'TEMPORARY',
        transactionDate: request.transactionDate,
        totalAmount: (calculation.amount_total || 0) / 100,
        totalTaxableAmount: resultLineItems.reduce((sum, li) => sum + li.taxableAmount, 0),
        totalTaxAmount: (calculation.tax_amount_exclusive || 0) / 100,
        totalExemptAmount: 0,
        currencyCode: request.currencyCode,
        lineItems: resultLineItems,
        summary: Array.from(summaryMap.values()),
        metadata: {
          stripeCalculationId: calculation.id,
          taxDate: calculation.tax_date,
          expiresAt: calculation.expires_at,
        },
      };
    } catch (error: any) {
      this.logger.error('Stripe Tax calculation failed:', error);
      throw error;
    }
  }

  async commitTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.stripe.tax.transactions.createFromCalculation({
        calculation: transactionId,
        reference: transactionId,
      });
      this.logger.log(`Stripe Tax transaction committed: ${transactionId}`);
      return { success: true, message: 'Transaction committed' };
    } catch (error: any) {
      this.logger.error(`Failed to commit Stripe Tax transaction ${transactionId}:`, error);
      return { success: false, message: error.message };
    }
  }

  async voidTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    this.logger.warn(
      `Stripe Tax does not support voiding transactions directly. Transaction: ${transactionId}`,
    );
    return { success: true, message: 'Void not required for Stripe Tax' };
  }

  async refundTransaction(
    originalTransactionId: string,
    refundTransactionId: string,
    items: TaxLineItem[],
  ): Promise<TaxCalculationResponse> {
    this.logger.log(
      `Stripe Tax refund for transaction ${originalTransactionId}. Refund is handled automatically through Stripe Refunds.`,
    );
    return {
      transactionId: refundTransactionId,
      status: 'COMMITTED',
      transactionDate: new Date(),
      totalAmount: 0,
      totalTaxableAmount: 0,
      totalTaxAmount: 0,
      totalExemptAmount: 0,
      currencyCode: 'USD',
      lineItems: [],
      summary: [],
    };
  }

  async validateAddress(address: TaxAddress): Promise<AddressValidationResult> {
    return {
      isValid: true,
      normalizedAddress: address,
      messages: [
        'Address validation not available via Stripe Tax. Use Stripe Address Element on frontend.',
      ],
    };
  }

  async getTaxCodes(): Promise<Array<{ code: string; description: string }>> {
    try {
      const taxCodes = await this.stripe.taxCodes.list({ limit: 100 });
      return taxCodes.data.map((tc) => ({
        code: tc.id,
        description: tc.description,
      }));
    } catch (error: any) {
      this.logger.error('Failed to fetch Stripe Tax codes:', error);
      return [];
    }
  }

  async getNexusLocations(): Promise<
    Array<{ country: string; region: string; hasNexus: boolean }>
  > {
    try {
      const settings = await this.stripe.tax.settings.retrieve();
      return [
        {
          country: (settings.head_office as any)?.address?.country || 'US',
          region: (settings.head_office as any)?.address?.state || '',
          hasNexus: true,
        },
      ];
    } catch (error: any) {
      this.logger.error('Failed to fetch nexus locations:', error);
      return [];
    }
  }

  private mapJurisdictionType(level: string): 'COUNTRY' | 'STATE' | 'COUNTY' | 'CITY' | 'DISTRICT' {
    const mapping: Record<string, 'COUNTRY' | 'STATE' | 'COUNTY' | 'CITY' | 'DISTRICT'> = {
      country: 'COUNTRY',
      state: 'STATE',
      county: 'COUNTY',
      city: 'CITY',
      district: 'DISTRICT',
    };
    return mapping[level.toLowerCase()] || 'STATE';
  }
}

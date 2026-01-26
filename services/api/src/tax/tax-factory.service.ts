import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import {
  ITaxProvider,
  TaxCalculationRequest,
  TaxCalculationResponse,
  TaxAddress,
  AddressValidationResult,
  TaxLineItem,
} from './interfaces/tax-provider.interface';
import { AvalaraProvider } from './providers/avalara.provider';
import { TaxJarProvider } from './providers/taxjar.provider';

/**
 * TaxFactory - Dynamically loads and manages tax service providers
 * 
 * Responsibilities:
 * - Load provider configurations from IntegrationConfig
 * - Instantiate and cache provider instances
 * - Provide unified interface for tax operations
 * - Fallback to manual tax calculation when no provider is configured
 */
@Injectable()
export class TaxFactoryService implements OnModuleInit {
  private readonly logger = new Logger(TaxFactoryService.name);
  private providers: Map<string, ITaxProvider> = new Map();
  private providerConfigs: Map<string, { isActive: boolean; isTestMode: boolean; priority: number }> = new Map();
  private activeProvider: ITaxProvider | null = null;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async onModuleInit() {
    await this.loadProviders();
  }

  /**
   * Load all configured tax providers from database
   */
  async loadProviders(): Promise<void> {
    try {
      const integrations = await this.prisma.integrationConfig.findMany({
        where: {
          category: 'TAX',
        },
        orderBy: { priority: 'desc' },
      });

      this.providers.clear();
      this.providerConfigs.clear();
      this.activeProvider = null;

      for (const integration of integrations) {
        try {
          const credentials = this.decryptCredentials(integration.credentials);
          const provider = this.createProvider(
            integration.provider,
            credentials,
            integration.isTestMode,
          );

          if (provider && provider.isConfigured()) {
            this.providers.set(integration.provider, provider);
            this.providerConfigs.set(integration.provider, {
              isActive: integration.isActive,
              isTestMode: integration.isTestMode,
              priority: integration.priority,
            });

            // Set the first active provider as the default
            if (integration.isActive && !this.activeProvider) {
              this.activeProvider = provider;
            }

            this.logger.log(`Loaded tax provider: ${integration.provider} (${integration.isTestMode ? 'test' : 'production'})`);
          }
        } catch (error: any) {
          this.logger.error(`Failed to load tax provider ${integration.provider}: ${error.message}`);
        }
      }

      this.logger.log(`Loaded ${this.providers.size} tax providers, active: ${this.activeProvider?.providerId || 'none'}`);
    } catch (error: any) {
      this.logger.error(`Failed to load tax providers: ${error.message}`);
    }
  }

  /**
   * Create a provider instance based on provider type
   */
  private createProvider(
    providerType: string,
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): ITaxProvider | null {
    switch (providerType) {
      case 'avalara':
        return new AvalaraProvider(credentials, isTestMode);
      case 'taxjar':
        return new TaxJarProvider(credentials, isTestMode);
      default:
        this.logger.warn(`Unknown tax provider type: ${providerType}`);
        return null;
    }
  }

  private decryptCredentials(encryptedCredentials: string): Record<string, any> {
    try {
      return this.encryptionService.decryptJson(encryptedCredentials);
    } catch (error) {
      this.logger.error('Failed to decrypt credentials');
      return {};
    }
  }

  /**
   * Get the active tax provider
   */
  getActiveProvider(): ITaxProvider | null {
    return this.activeProvider;
  }

  /**
   * Get a specific provider by name
   */
  getProvider(providerName: string): ITaxProvider | null {
    const provider = this.providers.get(providerName);
    const config = this.providerConfigs.get(providerName);

    if (!provider || !config?.isActive) {
      return null;
    }

    return provider;
  }

  /**
   * Check if an external tax provider is configured and active
   */
  hasActiveProvider(): boolean {
    return this.activeProvider !== null;
  }

  /**
   * Get list of configured provider names
   */
  getConfiguredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Calculate tax using the active provider
   * Falls back to manual calculation if no provider is configured
   */
  async calculateTax(
    request: TaxCalculationRequest,
    fallbackCalculation?: () => Promise<TaxCalculationResponse>,
  ): Promise<TaxCalculationResponse> {
    // If we have an active provider, use it
    if (this.activeProvider) {
      try {
        const result = await this.activeProvider.calculateTax(request);
        
        // Log the API call
        await this.logApiCall(
          this.activeProvider.providerId,
          'CALCULATE_TAX',
          request.transactionId,
          { success: true, totalTax: result.totalTaxAmount },
        );

        return result;
      } catch (error: any) {
        this.logger.error(`Tax calculation failed with ${this.activeProvider.providerId}: ${error.message}`);
        
        await this.logApiCall(
          this.activeProvider.providerId,
          'CALCULATE_TAX',
          request.transactionId,
          { success: false, error: error.message },
        );

        // If fallback is provided, use it
        if (fallbackCalculation) {
          this.logger.log('Falling back to manual tax calculation');
          return fallbackCalculation();
        }

        throw error;
      }
    }

    // No active provider - use fallback or return zero tax
    if (fallbackCalculation) {
      return fallbackCalculation();
    }

    // Return zero tax if no provider and no fallback
    return {
      transactionId: request.transactionId,
      status: 'TEMPORARY',
      transactionDate: request.transactionDate,
      totalAmount: request.lineItems.reduce((sum, item) => sum + item.amount, 0),
      totalTaxableAmount: 0,
      totalTaxAmount: 0,
      totalExemptAmount: 0,
      currencyCode: request.currencyCode,
      lineItems: [],
      summary: [],
    };
  }

  /**
   * Commit a tax transaction (finalize for reporting)
   */
  async commitTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    if (!this.activeProvider) {
      return { success: true, message: 'No external tax provider configured' };
    }

    try {
      const result = await this.activeProvider.commitTransaction(transactionId);
      
      await this.logApiCall(
        this.activeProvider.providerId,
        'COMMIT_TRANSACTION',
        transactionId,
        { success: result.success },
      );

      return result;
    } catch (error: any) {
      await this.logApiCall(
        this.activeProvider.providerId,
        'COMMIT_TRANSACTION',
        transactionId,
        { success: false, error: error.message },
      );

      return { success: false, message: error.message };
    }
  }

  /**
   * Void a tax transaction
   */
  async voidTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    if (!this.activeProvider) {
      return { success: true, message: 'No external tax provider configured' };
    }

    try {
      const result = await this.activeProvider.voidTransaction(transactionId);
      
      await this.logApiCall(
        this.activeProvider.providerId,
        'VOID_TRANSACTION',
        transactionId,
        { success: result.success },
      );

      return result;
    } catch (error: any) {
      await this.logApiCall(
        this.activeProvider.providerId,
        'VOID_TRANSACTION',
        transactionId,
        { success: false, error: error.message },
      );

      return { success: false, message: error.message };
    }
  }

  /**
   * Process a refund
   */
  async refundTransaction(
    originalTransactionId: string,
    refundTransactionId: string,
    items: TaxLineItem[],
  ): Promise<TaxCalculationResponse | null> {
    if (!this.activeProvider) {
      return null;
    }

    try {
      const result = await this.activeProvider.refundTransaction(
        originalTransactionId,
        refundTransactionId,
        items,
      );

      await this.logApiCall(
        this.activeProvider.providerId,
        'REFUND_TRANSACTION',
        refundTransactionId,
        { success: true, originalTransactionId },
      );

      return result;
    } catch (error: any) {
      await this.logApiCall(
        this.activeProvider.providerId,
        'REFUND_TRANSACTION',
        refundTransactionId,
        { success: false, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Validate an address for tax purposes
   */
  async validateAddress(address: TaxAddress): Promise<AddressValidationResult> {
    if (!this.activeProvider) {
      return { isValid: true, normalizedAddress: address };
    }

    try {
      return await this.activeProvider.validateAddress(address);
    } catch (error: any) {
      this.logger.warn(`Address validation failed: ${error.message}`);
      return { isValid: true, normalizedAddress: address };
    }
  }

  /**
   * Get available tax codes from the active provider
   */
  async getTaxCodes(): Promise<Array<{ code: string; description: string }>> {
    if (!this.activeProvider?.getTaxCodes) {
      return [];
    }

    try {
      return await this.activeProvider.getTaxCodes();
    } catch (error: any) {
      this.logger.warn(`Failed to get tax codes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get nexus locations from the active provider
   */
  async getNexusLocations(): Promise<Array<{ country: string; region: string; hasNexus: boolean }>> {
    if (!this.activeProvider?.getNexusLocations) {
      return [];
    }

    try {
      return await this.activeProvider.getNexusLocations();
    } catch (error: any) {
      this.logger.warn(`Failed to get nexus locations: ${error.message}`);
      return [];
    }
  }

  /**
   * Refresh provider configurations from database
   */
  async refreshProviders(): Promise<void> {
    await this.loadProviders();
  }

  /**
   * Log an API call for auditing
   */
  private async logApiCall(
    provider: string,
    action: string,
    reference?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const integration = await this.prisma.integrationConfig.findUnique({
        where: {
          category_provider: { category: 'TAX', provider },
        },
      });

      if (integration) {
        await this.prisma.integrationLog.create({
          data: {
            integrationId: integration.id,
            action,
            provider,
            metadata: { reference, ...metadata },
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to log API call', error);
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<{
    activeProvider: string | null;
    isTestMode: boolean;
    totalCalculations: number;
    lastUsed?: Date;
  }> {
    const activeName = this.activeProvider?.providerId || null;
    const config = activeName ? this.providerConfigs.get(activeName) : null;

    let totalCalculations = 0;
    let lastUsed: Date | undefined;

    if (activeName) {
      totalCalculations = await this.prisma.integrationLog.count({
        where: {
          provider: activeName,
          action: 'CALCULATE_TAX',
        },
      });

      const lastLog = await this.prisma.integrationLog.findFirst({
        where: {
          provider: activeName,
          action: 'CALCULATE_TAX',
        },
        orderBy: { createdAt: 'desc' },
      });

      lastUsed = lastLog?.createdAt;
    }

    return {
      activeProvider: activeName,
      isTestMode: config?.isTestMode || true,
      totalCalculations,
      lastUsed,
    };
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import {
  ICourierProvider,
  RateRequest,
  RateResponse,
  ShipmentRequest,
  ShipmentResponse,
  TrackingResponse,
  AddressValidationResult,
  Address,
} from './interfaces/courier-provider.interface';
import { RoyalMailProvider } from './providers/royal-mail.provider';
import { FedExProvider } from './providers/fedex.provider';
import { DHLProvider } from './providers/dhl.provider';

/**
 * CourierFactory - Dynamically loads and manages courier providers
 *
 * Responsibilities:
 * - Load provider configurations from IntegrationConfig
 * - Instantiate and cache provider instances
 * - Provide unified interface for shipping operations
 * - Support multiple carriers for rate comparison
 */
@Injectable()
export class CourierFactoryService implements OnModuleInit {
  private readonly logger = new Logger(CourierFactoryService.name);
  private providers: Map<string, ICourierProvider> = new Map();
  private providerConfigs: Map<
    string,
    { isActive: boolean; isTestMode: boolean; priority: number }
  > = new Map();

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async onModuleInit() {
    await this.loadProviders();
  }

  /**
   * Load all configured shipping providers from database
   */
  async loadProviders(): Promise<void> {
    try {
      const integrations = await this.prisma.integrationConfig.findMany({
        where: {
          category: 'SHIPPING',
        },
        orderBy: { priority: 'desc' },
      });

      this.providers.clear();
      this.providerConfigs.clear();

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
            this.logger.log(
              `Loaded shipping provider: ${integration.provider} (${integration.isTestMode ? 'test' : 'production'})`,
            );
          }
        } catch (error: any) {
          this.logger.error(`Failed to load provider ${integration.provider}: ${error.message}`);
        }
      }

      this.logger.log(`Loaded ${this.providers.size} shipping providers`);
    } catch (error: any) {
      this.logger.error(`Failed to load shipping providers: ${error.message}`);
    }
  }

  /**
   * Create a provider instance based on provider type
   */
  private createProvider(
    providerType: string,
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): ICourierProvider | null {
    switch (providerType) {
      case 'royal_mail':
        return new RoyalMailProvider(credentials, isTestMode);
      case 'fedex':
        return new FedExProvider(credentials, isTestMode);
      case 'dhl':
        return new DHLProvider(credentials, isTestMode);
      default:
        this.logger.warn(`Unknown provider type: ${providerType}`);
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
   * Get a specific provider
   */
  getProvider(providerName: string): ICourierProvider | null {
    const provider = this.providers.get(providerName);
    const config = this.providerConfigs.get(providerName);

    if (!provider || !config?.isActive) {
      return null;
    }

    return provider;
  }

  /**
   * Get all active providers
   */
  getActiveProviders(): ICourierProvider[] {
    const activeProviders: ICourierProvider[] = [];

    for (const [name, provider] of this.providers) {
      const config = this.providerConfigs.get(name);
      if (config?.isActive) {
        activeProviders.push(provider);
      }
    }

    // Sort by priority
    return activeProviders.sort((a, b) => {
      const priorityA = this.providerConfigs.get(a.providerId)?.priority || 0;
      const priorityB = this.providerConfigs.get(b.providerId)?.priority || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Get list of available provider names
   */
  getAvailableProviderNames(): string[] {
    return Array.from(this.providers.keys()).filter((name) => {
      const config = this.providerConfigs.get(name);
      return config?.isActive;
    });
  }

  /**
   * Get the default (highest priority) provider
   */
  getDefaultProvider(): ICourierProvider | null {
    const activeProviders = this.getActiveProviders();
    return activeProviders.length > 0 ? activeProviders[0] : null;
  }

  /**
   * Get rates from all active providers
   */
  async getAllRates(request: RateRequest): Promise<RateResponse[]> {
    const activeProviders = this.getActiveProviders();
    const allRates: RateResponse[] = [];

    await Promise.all(
      activeProviders.map(async (provider) => {
        try {
          const rates = await provider.getRates(request);
          allRates.push(...rates);
        } catch (error: any) {
          this.logger.warn(`Failed to get rates from ${provider.providerId}: ${error.message}`);
        }
      }),
    );

    // Sort by rate (lowest first)
    return allRates.sort((a, b) => a.rate - b.rate);
  }

  /**
   * Get rates from a specific provider
   */
  async getRates(providerName: string, request: RateRequest): Promise<RateResponse[]> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found or not active`);
    }

    return provider.getRates(request);
  }

  /**
   * Create a shipment with a specific provider
   */
  async createShipment(providerName: string, request: ShipmentRequest): Promise<ShipmentResponse> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found or not active`);
    }

    // Log the shipment creation
    await this.logApiCall(providerName, 'CREATE_SHIPMENT', request.orderId);

    try {
      const response = await provider.createShipment(request);
      await this.logApiCall(providerName, 'CREATE_SHIPMENT_SUCCESS', request.orderId, {
        trackingNumber: response.trackingNumber,
      });
      return response;
    } catch (error: any) {
      await this.logApiCall(providerName, 'CREATE_SHIPMENT_FAILED', request.orderId, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Track a shipment - auto-detects provider if not specified
   */
  async trackShipment(trackingNumber: string, providerName?: string): Promise<TrackingResponse> {
    if (providerName) {
      const provider = this.getProvider(providerName);
      if (!provider) {
        throw new Error(`Provider ${providerName} not found or not active`);
      }
      return provider.trackShipment(trackingNumber);
    }

    // Try all active providers until one succeeds
    const activeProviders = this.getActiveProviders();
    const errors: string[] = [];

    for (const provider of activeProviders) {
      try {
        const response = await provider.trackShipment(trackingNumber);
        if (response.status !== 'UNKNOWN') {
          return response;
        }
      } catch (error: any) {
        errors.push(`${provider.providerId}: ${error.message}`);
      }
    }

    throw new Error(`Unable to track shipment. Tried providers: ${errors.join(', ')}`);
  }

  /**
   * Cancel a shipment
   */
  async cancelShipment(
    providerName: string,
    shipmentId: string,
  ): Promise<{ success: boolean; message: string }> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found or not active`);
    }

    return provider.cancelShipment(shipmentId);
  }

  /**
   * Validate an address using a specific provider
   */
  async validateAddress(address: Address, providerName?: string): Promise<AddressValidationResult> {
    // If provider specified, use it
    if (providerName) {
      const provider = this.getProvider(providerName);
      if (!provider) {
        throw new Error(`Provider ${providerName} not found or not active`);
      }
      return provider.validateAddress(address);
    }

    // Otherwise use the default provider
    const defaultProvider = this.getDefaultProvider();
    if (!defaultProvider) {
      // No provider available, return basic validation
      return {
        isValid: true,
        normalizedAddress: address,
      };
    }

    return defaultProvider.validateAddress(address);
  }

  /**
   * Find the cheapest shipping option across all carriers
   */
  async findCheapestRate(request: RateRequest): Promise<RateResponse | null> {
    const allRates = await this.getAllRates(request);
    return allRates.length > 0 ? allRates[0] : null;
  }

  /**
   * Find the fastest shipping option across all carriers
   */
  async findFastestRate(request: RateRequest): Promise<RateResponse | null> {
    const allRates = await this.getAllRates(request);
    if (allRates.length === 0) return null;

    return allRates.reduce((fastest, current) => {
      return current.estimatedDays < fastest.estimatedDays ? current : fastest;
    });
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
          category_provider: { category: 'SHIPPING', provider },
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
  async getProviderStats(): Promise<
    Array<{
      provider: string;
      isActive: boolean;
      isTestMode: boolean;
      totalShipments: number;
      lastUsed?: Date;
    }>
  > {
    const stats: Array<{
      provider: string;
      isActive: boolean;
      isTestMode: boolean;
      totalShipments: number;
      lastUsed?: Date;
    }> = [];

    for (const [name, provider] of this.providers) {
      const config = this.providerConfigs.get(name);

      // Count shipments from logs
      const shipmentCount = await this.prisma.integrationLog.count({
        where: {
          provider: name,
          action: 'CREATE_SHIPMENT_SUCCESS',
        },
      });

      const lastLog = await this.prisma.integrationLog.findFirst({
        where: {
          provider: name,
          action: 'CREATE_SHIPMENT_SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
      });

      stats.push({
        provider: name,
        isActive: config?.isActive || false,
        isTestMode: config?.isTestMode || true,
        totalShipments: shipmentCount,
        lastUsed: lastLog?.createdAt,
      });
    }

    return stats;
  }
}

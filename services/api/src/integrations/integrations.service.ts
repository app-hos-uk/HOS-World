import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from './encryption.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationCategory,
  IntegrationResponseDto,
  TestConnectionResultDto,
} from './dto/create-integration.dto';

/**
 * Provider metadata definitions
 */
interface ProviderMetadata {
  displayName: string;
  description: string;
  requiredCredentials: string[];
  optionalCredentials: string[];
  documentationUrl?: string;
  testEndpoint?: string;
}

const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  // Shipping
  royal_mail: {
    displayName: 'Royal Mail',
    description: 'UK domestic and international postal service',
    requiredCredentials: ['clientId', 'clientSecret', 'accountNumber'],
    optionalCredentials: ['postingLocation'],
    documentationUrl: 'https://developer.royalmail.net/',
  },
  fedex: {
    displayName: 'FedEx',
    description: 'Global courier delivery services',
    requiredCredentials: ['apiKey', 'secretKey', 'accountNumber'],
    optionalCredentials: ['meterNumber'],
    documentationUrl: 'https://developer.fedex.com/',
  },
  dhl: {
    displayName: 'DHL Express',
    description: 'International express shipping',
    requiredCredentials: ['apiKey', 'accountNumber'],
    optionalCredentials: ['siteId', 'password'],
    documentationUrl: 'https://developer.dhl.com/',
  },
  // Tax
  avalara: {
    displayName: 'Avalara AvaTax',
    description: 'Enterprise tax calculation and compliance',
    requiredCredentials: ['accountId', 'licenseKey', 'companyCode'],
    optionalCredentials: [],
    documentationUrl: 'https://developer.avalara.com/',
  },
  taxjar: {
    displayName: 'TaxJar',
    description: 'Sales tax calculation and reporting',
    requiredCredentials: ['apiToken'],
    optionalCredentials: [],
    documentationUrl: 'https://developers.taxjar.com/',
  },
  // Payment
  stripe: {
    displayName: 'Stripe',
    description: 'Online payment processing',
    requiredCredentials: ['publishableKey', 'secretKey'],
    optionalCredentials: ['webhookSecret'],
    documentationUrl: 'https://stripe.com/docs/api',
  },
  // Email
  sendgrid: {
    displayName: 'SendGrid',
    description: 'Email delivery service',
    requiredCredentials: ['apiKey'],
    optionalCredentials: ['fromEmail', 'fromName'],
    documentationUrl: 'https://docs.sendgrid.com/',
  },
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a new integration configuration
   */
  async create(createDto: CreateIntegrationDto): Promise<IntegrationResponseDto> {
    // Check if integration already exists
    const existing = await this.prisma.integrationConfig.findUnique({
      where: {
        category_provider: {
          category: createDto.category,
          provider: createDto.provider,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Integration for ${createDto.provider} in ${createDto.category} already exists`,
      );
    }

    // Validate required credentials
    this.validateCredentials(createDto.provider, createDto.credentials);

    // Encrypt credentials
    const encryptedCredentials = this.encryptionService.encryptJson(createDto.credentials);

    // Generate webhook URL and secret
    const webhookSecret = this.encryptionService.generateWebhookSecret();
    const webhookUrl = `/api/webhooks/integrations/${createDto.category.toLowerCase()}/${createDto.provider}`;

    const integration = await this.prisma.integrationConfig.create({
      data: {
        category: createDto.category,
        provider: createDto.provider,
        displayName: createDto.displayName,
        description: createDto.description,
        isActive: createDto.isActive ?? false,
        isTestMode: createDto.isTestMode ?? true,
        credentials: encryptedCredentials,
        settings: createDto.settings || {},
        webhookUrl,
        webhookSecret,
        testStatus: 'NEVER_TESTED',
        priority: createDto.priority ?? 0,
      },
    });

    // Log the creation
    await this.logAction(integration.id, 'CONFIG_CHANGE', createDto.provider, {
      action: 'CREATED',
      displayName: createDto.displayName,
    });

    return this.toResponseDto(integration);
  }

  /**
   * Get all integrations
   */
  async findAll(category?: string): Promise<IntegrationResponseDto[]> {
    const where = category ? { category } : {};
    
    const integrations = await this.prisma.integrationConfig.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { priority: 'desc' },
        { displayName: 'asc' },
      ],
    });

    return integrations.map((i) => this.toResponseDto(i));
  }

  /**
   * Get integration by ID
   */
  async findById(id: string): Promise<IntegrationResponseDto> {
    const integration = await this.prisma.integrationConfig.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return this.toResponseDto(integration);
  }

  /**
   * Get integration by category and provider
   */
  async findByProvider(
    category: string,
    provider: string,
  ): Promise<IntegrationResponseDto | null> {
    const integration = await this.prisma.integrationConfig.findUnique({
      where: {
        category_provider: { category, provider },
      },
    });

    if (!integration) {
      return null;
    }

    return this.toResponseDto(integration);
  }

  /**
   * Get active integration for a category (returns highest priority)
   */
  async getActiveIntegration(category: string): Promise<IntegrationResponseDto | null> {
    const integration = await this.prisma.integrationConfig.findFirst({
      where: {
        category,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    if (!integration) {
      return null;
    }

    return this.toResponseDto(integration);
  }

  /**
   * Update an integration configuration
   */
  async update(id: string, updateDto: UpdateIntegrationDto): Promise<IntegrationResponseDto> {
    const existing = await this.prisma.integrationConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Integration not found');
    }

    const updateData: Record<string, any> = {};

    if (updateDto.displayName !== undefined) {
      updateData.displayName = updateDto.displayName;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }
    if (updateDto.isActive !== undefined) {
      updateData.isActive = updateDto.isActive;
    }
    if (updateDto.isTestMode !== undefined) {
      updateData.isTestMode = updateDto.isTestMode;
    }
    if (updateDto.settings !== undefined) {
      updateData.settings = updateDto.settings;
    }
    if (updateDto.priority !== undefined) {
      updateData.priority = updateDto.priority;
    }

    // Handle credentials update (merge with existing)
    if (updateDto.credentials) {
      const existingCredentials = this.decryptCredentials(existing.credentials);
      const mergedCredentials = { ...existingCredentials, ...updateDto.credentials };
      updateData.credentials = this.encryptionService.encryptJson(mergedCredentials);
    }

    const updated = await this.prisma.integrationConfig.update({
      where: { id },
      data: updateData,
    });

    // Log the update
    await this.logAction(id, 'CONFIG_CHANGE', existing.provider, {
      action: 'UPDATED',
      fields: Object.keys(updateData),
    });

    return this.toResponseDto(updated);
  }

  /**
   * Delete an integration
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.integrationConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Integration not found');
    }

    await this.prisma.integrationConfig.delete({
      where: { id },
    });

    this.logger.log(`Deleted integration ${existing.provider} (${existing.category})`);
  }

  /**
   * Test integration connection
   */
  async testConnection(
    id: string,
    testCredentials?: Record<string, any>,
  ): Promise<TestConnectionResultDto> {
    const integration = await this.prisma.integrationConfig.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const startTime = Date.now();
    let result: TestConnectionResultDto;

    try {
      // Get credentials (use test credentials if provided, otherwise use stored)
      const credentials = testCredentials || this.decryptCredentials(integration.credentials);

      // Perform provider-specific test
      result = await this.performProviderTest(
        integration.category,
        integration.provider,
        credentials,
        integration.isTestMode,
      );

      // Update test status
      await this.prisma.integrationConfig.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          testStatus: result.success ? 'SUCCESS' : 'FAILED',
          testMessage: result.message,
        },
      });

      // Log the test
      await this.logAction(id, 'TEST_CONNECTION', integration.provider, {
        success: result.success,
        duration: Date.now() - startTime,
      });

      result.duration = Date.now() - startTime;
      return result;
    } catch (error: any) {
      result = {
        success: false,
        message: `Connection test failed: ${error.message}`,
        duration: Date.now() - startTime,
      };

      await this.prisma.integrationConfig.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          testStatus: 'FAILED',
          testMessage: error.message,
        },
      });

      await this.logAction(id, 'TEST_CONNECTION', integration.provider, {
        success: false,
        error: error.message,
        duration: result.duration,
      });

      return result;
    }
  }

  /**
   * Get integration logs
   */
  async getLogs(
    integrationId: string,
    options: { limit?: number; offset?: number; action?: string } = {},
  ) {
    const { limit = 50, offset = 0, action } = options;

    const where: any = { integrationId };
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata(provider: string): ProviderMetadata | null {
    return PROVIDER_METADATA[provider] || null;
  }

  /**
   * Get all available providers for a category
   */
  getAvailableProviders(category: string): Array<{ provider: string; metadata: ProviderMetadata }> {
    const categoryProviders: Record<string, string[]> = {
      [IntegrationCategory.SHIPPING]: ['royal_mail', 'fedex', 'dhl'],
      [IntegrationCategory.TAX]: ['avalara', 'taxjar'],
      [IntegrationCategory.PAYMENT]: ['stripe'],
      [IntegrationCategory.EMAIL]: ['sendgrid'],
    };

    const providers = categoryProviders[category] || [];
    return providers
      .filter((p) => PROVIDER_METADATA[p])
      .map((provider) => ({
        provider,
        metadata: PROVIDER_METADATA[provider],
      }));
  }

  /**
   * Get decrypted credentials (for internal use by other services)
   */
  getDecryptedCredentials(integrationId: string): Promise<Record<string, any>>;
  getDecryptedCredentials(category: string, provider: string): Promise<Record<string, any>>;
  async getDecryptedCredentials(
    idOrCategory: string,
    provider?: string,
  ): Promise<Record<string, any>> {
    let integration;

    if (provider) {
      integration = await this.prisma.integrationConfig.findUnique({
        where: {
          category_provider: { category: idOrCategory, provider },
        },
      });
    } else {
      integration = await this.prisma.integrationConfig.findUnique({
        where: { id: idOrCategory },
      });
    }

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    if (!integration.isActive) {
      throw new BadRequestException('Integration is not active');
    }

    return this.decryptCredentials(integration.credentials);
  }

  // Private helper methods

  private decryptCredentials(encryptedCredentials: string): Record<string, any> {
    try {
      return this.encryptionService.decryptJson(encryptedCredentials);
    } catch (error) {
      this.logger.error('Failed to decrypt credentials');
      return {};
    }
  }

  private validateCredentials(provider: string, credentials: Record<string, any>): void {
    const metadata = PROVIDER_METADATA[provider];
    if (!metadata) {
      return; // Unknown provider, skip validation
    }

    const missing = metadata.requiredCredentials.filter(
      (field) => !credentials[field] || credentials[field].trim() === '',
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required credentials for ${provider}: ${missing.join(', ')}`,
      );
    }
  }

  private toResponseDto(integration: any): IntegrationResponseDto {
    const decryptedCredentials = this.decryptCredentials(integration.credentials);
    const maskedCredentials = this.encryptionService.maskCredentials(decryptedCredentials);

    return {
      id: integration.id,
      category: integration.category as IntegrationCategory,
      provider: integration.provider,
      displayName: integration.displayName,
      description: integration.description,
      isActive: integration.isActive,
      isTestMode: integration.isTestMode,
      credentials: maskedCredentials,
      settings: integration.settings,
      webhookUrl: integration.webhookUrl,
      lastTestedAt: integration.lastTestedAt,
      testStatus: integration.testStatus,
      testMessage: integration.testMessage,
      priority: integration.priority,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  private async logAction(
    integrationId: string,
    action: string,
    provider: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.integrationLog.create({
        data: {
          integrationId,
          action,
          provider,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log integration action', error);
    }
  }

  private async performProviderTest(
    category: string,
    provider: string,
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // Provider-specific test implementations
    // These will be replaced with actual API calls in later phases
    
    switch (provider) {
      case 'royal_mail':
        return this.testRoyalMailConnection(credentials, isTestMode);
      case 'fedex':
        return this.testFedExConnection(credentials, isTestMode);
      case 'dhl':
        return this.testDHLConnection(credentials, isTestMode);
      case 'avalara':
        return this.testAvalaraConnection(credentials, isTestMode);
      case 'taxjar':
        return this.testTaxJarConnection(credentials, isTestMode);
      case 'stripe':
        return this.testStripeConnection(credentials, isTestMode);
      case 'sendgrid':
        return this.testSendGridConnection(credentials, isTestMode);
      default:
        return {
          success: true,
          message: 'Connection test not implemented for this provider',
        };
    }
  }

  // Placeholder test methods - will be implemented with real API calls later
  
  private async testRoyalMailConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real Royal Mail API test
    if (!credentials.clientId || !credentials.clientSecret) {
      return { success: false, message: 'Missing client ID or client secret' };
    }
    return {
      success: true,
      message: `Royal Mail ${isTestMode ? 'sandbox' : 'production'} connection verified (placeholder)`,
      details: { environment: isTestMode ? 'sandbox' : 'production' },
    };
  }

  private async testFedExConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real FedEx API test
    if (!credentials.apiKey || !credentials.secretKey) {
      return { success: false, message: 'Missing API key or secret key' };
    }
    return {
      success: true,
      message: `FedEx ${isTestMode ? 'sandbox' : 'production'} connection verified (placeholder)`,
      details: { environment: isTestMode ? 'sandbox' : 'production' },
    };
  }

  private async testDHLConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real DHL API test
    if (!credentials.apiKey) {
      return { success: false, message: 'Missing API key' };
    }
    return {
      success: true,
      message: `DHL ${isTestMode ? 'sandbox' : 'production'} connection verified (placeholder)`,
      details: { environment: isTestMode ? 'sandbox' : 'production' },
    };
  }

  private async testAvalaraConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real Avalara API test
    if (!credentials.accountId || !credentials.licenseKey) {
      return { success: false, message: 'Missing account ID or license key' };
    }
    return {
      success: true,
      message: `Avalara ${isTestMode ? 'sandbox' : 'production'} connection verified (placeholder)`,
      details: { environment: isTestMode ? 'sandbox' : 'production' },
    };
  }

  private async testTaxJarConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real TaxJar API test
    if (!credentials.apiToken) {
      return { success: false, message: 'Missing API token' };
    }
    return {
      success: true,
      message: `TaxJar ${isTestMode ? 'sandbox' : 'production'} connection verified (placeholder)`,
      details: { environment: isTestMode ? 'sandbox' : 'production' },
    };
  }

  private async testStripeConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real Stripe API test
    if (!credentials.secretKey) {
      return { success: false, message: 'Missing secret key' };
    }
    const isTestKey = credentials.secretKey.startsWith('sk_test_');
    if (isTestMode && !isTestKey) {
      return { success: false, message: 'Test mode requires a test secret key (sk_test_...)' };
    }
    return {
      success: true,
      message: `Stripe ${isTestMode ? 'test' : 'live'} connection verified (placeholder)`,
      details: { environment: isTestMode ? 'test' : 'live' },
    };
  }

  private async testSendGridConnection(
    credentials: Record<string, any>,
    isTestMode: boolean,
  ): Promise<TestConnectionResultDto> {
    // TODO: Implement real SendGrid API test
    if (!credentials.apiKey) {
      return { success: false, message: 'Missing API key' };
    }
    return {
      success: true,
      message: 'SendGrid connection verified (placeholder)',
    };
  }
}

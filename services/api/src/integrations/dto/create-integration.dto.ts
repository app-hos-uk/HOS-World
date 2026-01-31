import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsEnum,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Integration categories
 */
export enum IntegrationCategory {
  PAYMENT = 'PAYMENT',
  SHIPPING = 'SHIPPING',
  TAX = 'TAX',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  STORAGE = 'STORAGE',
  SEARCH = 'SEARCH',
  ANALYTICS = 'ANALYTICS',
  MAPS = 'MAPS',
  OAUTH = 'OAUTH',
}

/**
 * Known integration providers
 */
export enum IntegrationProvider {
  // Payment
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  KLARNA = 'klarna',

  // Shipping
  ROYAL_MAIL = 'royal_mail',
  FEDEX = 'fedex',
  DHL = 'dhl',
  UPS = 'ups',

  // Tax
  AVALARA = 'avalara',
  TAXJAR = 'taxjar',

  // Email
  SENDGRID = 'sendgrid',
  MAILGUN = 'mailgun',
  SES = 'ses',

  // SMS
  TWILIO = 'twilio',
  VONAGE = 'vonage',

  // Storage
  S3 = 's3',
  CLOUDINARY = 'cloudinary',

  // Search
  ELASTICSEARCH = 'elasticsearch',
  ALGOLIA = 'algolia',

  // Analytics
  GOOGLE_ANALYTICS = 'google_analytics',
  SEGMENT = 'segment',

  // Maps
  GOOGLE_MAPS = 'google_maps',
  MAPBOX = 'mapbox',

  // OAuth
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

/**
 * DTO for creating a new integration configuration
 */
export class CreateIntegrationDto {
  @ApiProperty({
    enum: IntegrationCategory,
    description: 'Category of the integration',
    example: IntegrationCategory.SHIPPING,
  })
  @IsEnum(IntegrationCategory)
  category: IntegrationCategory;

  @ApiProperty({
    description: 'Provider identifier (e.g., fedex, avalara)',
    example: 'fedex',
  })
  @IsString()
  provider: string;

  @ApiProperty({
    description: 'Display name for this integration',
    example: 'FedEx Express',
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    description: 'Description of this integration',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the integration is active',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to use test/sandbox mode',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;

  @ApiProperty({
    description: 'API credentials (will be encrypted)',
    example: { apiKey: 'xxx', secretKey: 'yyy' },
  })
  @IsObject()
  credentials: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Additional non-sensitive settings',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Priority for ordering (higher = preferred)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

/**
 * DTO for updating an integration configuration
 */
export class UpdateIntegrationDto {
  @ApiPropertyOptional({
    description: 'Display name for this integration',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Description of this integration',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the integration is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to use test/sandbox mode',
  })
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;

  @ApiPropertyOptional({
    description: 'API credentials (will be encrypted). Only provided fields are updated.',
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Additional non-sensitive settings',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Priority for ordering (higher = preferred)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

/**
 * DTO for testing an integration connection
 */
export class TestIntegrationDto {
  @ApiPropertyOptional({
    description: 'Optional credentials to test (if not using stored credentials)',
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;
}

/**
 * Response DTO for integration (with masked credentials)
 */
export class IntegrationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: IntegrationCategory })
  category: IntegrationCategory;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isTestMode: boolean;

  @ApiProperty({ description: 'Masked credentials (secrets hidden)' })
  credentials: Record<string, any>;

  @ApiPropertyOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional()
  webhookUrl?: string;

  @ApiPropertyOptional()
  lastTestedAt?: Date;

  @ApiPropertyOptional()
  testStatus?: string;

  @ApiPropertyOptional()
  testMessage?: string;

  @ApiProperty()
  priority: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Response DTO for test connection result
 */
export class TestConnectionResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  details?: Record<string, any>;

  @ApiPropertyOptional()
  duration?: number;
}

import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

interface EnvSchema {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  PORT?: number;
  REDIS_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  MEILISEARCH_HOST?: string;
  MEILISEARCH_API_KEY?: string;
  SMTP_HOST?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  STORAGE_PROVIDER?: 'local' | 's3' | 'minio' | 'cloudinary';
  FRONTEND_URL?: string;
  SENTRY_DSN?: string;
  API_KEYS?: string;
}

const required: (keyof EnvSchema)[] = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const urlFields: (keyof EnvSchema)[] = ['DATABASE_URL', 'REDIS_URL', 'MEILISEARCH_HOST', 'FRONTEND_URL'];

export function validateEnvironmentVariables(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of required) {
    if (!config[key]) {
      errors.push(`${key} is required`);
    }
  }

  if (config.JWT_SECRET && String(config.JWT_SECRET).length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters');
  }
  if (config.JWT_REFRESH_SECRET && String(config.JWT_REFRESH_SECRET).length < 32) {
    warnings.push('JWT_REFRESH_SECRET should be at least 32 characters');
  }

  if (config.PORT) {
    const port = Number(config.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }
  }

  for (const field of urlFields) {
    if (config[field] && typeof config[field] === 'string') {
      const value = config[field] as string;
      if (field === 'DATABASE_URL' && !value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
        errors.push(`${field} must be a valid PostgreSQL URL`);
      }
      if (field === 'REDIS_URL' && !value.startsWith('redis://') && !value.startsWith('rediss://')) {
        warnings.push(`${field} should be a valid Redis URL`);
      }
    }
  }

  if (config.STORAGE_PROVIDER && !['local', 's3', 'minio', 'cloudinary'].includes(String(config.STORAGE_PROVIDER))) {
    errors.push('STORAGE_PROVIDER must be one of: local, s3, minio, cloudinary');
  }

  if (config.STRIPE_SECRET_KEY && !config.STRIPE_WEBHOOK_SECRET) {
    warnings.push('STRIPE_WEBHOOK_SECRET should be set when using Stripe');
  }

  if (config.SMTP_HOST && (!config.SMTP_USER || !config.SMTP_PASS)) {
    warnings.push('SMTP_USER and SMTP_PASS should be set when SMTP_HOST is configured');
  }

  for (const warning of warnings) {
    logger.warn(`⚠️  ${warning}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  return config;
}

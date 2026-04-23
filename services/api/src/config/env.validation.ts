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
  LOYALTY_ENABLED?: string;
  LOYALTY_DEFAULT_EARN_RATE?: string;
  LOYALTY_DEFAULT_REDEEM_VALUE?: string;
  LOYALTY_MIN_REDEMPTION_POINTS?: string;
  LOYALTY_CARD_PREFIX?: string;
  LOYALTY_POINTS_EXPIRY_MONTHS?: string;
  LOYALTY_REDEMPTION_AT_CHECKOUT?: string;
  LOYALTY_REFERRAL_REFERRER_BONUS?: string;
  LOYALTY_REFERRAL_REFEREE_BONUS?: string;
  HOS_SELLER_ID?: string;
  POS_ENABLED?: string;
  POS_WEBHOOK_BASE_URL?: string;
  LIGHTSPEED_CLIENT_ID?: string;
  LIGHTSPEED_CLIENT_SECRET?: string;
  POS_NIGHTLY_RECON_CRON?: string;
  POS_SALES_POLL_CRON?: string;
  POS_INVENTORY_DISCREPANCY_THRESHOLD?: string;
  POS_SYNC_BATCH_SIZE?: string;
  QUIZ_MAX_PER_WEEK?: string;
  QUIZ_PASS_THRESHOLD?: string;
  FANDOM_PROFILE_RECOMPUTE_CRON?: string;
  JOURNEY_STEP_CRON?: string;
  ABANDONED_CART_CRON?: string;
  ABANDONED_CART_THRESHOLD_MINUTES?: string;
  INACTIVITY_SCAN_CRON?: string;
  INACTIVITY_DAYS_THRESHOLD?: string;
  POINTS_EXPIRY_WARNING_CRON?: string;
  TWILIO_SMS_NUMBER?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  EVENT_REMINDER_CRON?: string;
  EVENT_RECONCILE_CRON?: string;
  EVENT_DEFAULT_POINTS?: string;
  EVENT_MAX_GUEST_COUNT?: string;
  SEGMENT_REFRESH_CRON?: string;
  SEGMENT_EVAL_BATCH_SIZE?: string;
  SEGMENT_PREVIEW_LIMIT?: string;
  SEGMENT_BROADCAST_MAX?: string;
  AMBASSADOR_MIN_TIER_LEVEL?: string;
  AMBASSADOR_UGC_MAX_PER_WEEK?: string;
  AMBASSADOR_UGC_POINTS_PHOTO?: string;
  AMBASSADOR_UGC_POINTS_VIDEO?: string;
  AMBASSADOR_UGC_POINTS_REVIEW?: string;
  AMBASSADOR_UGC_POINTS_STORY?: string;
  AMBASSADOR_UGC_POINTS_UNBOXING?: string;
  AMBASSADOR_UGC_POINTS_SOCIAL_POST?: string;
  AMBASSADOR_UGC_FEATURED_BONUS?: string;
  AMBASSADOR_AUTO_CONVERT_COMMISSION?: string;
  AMBASSADOR_ENROLL_BONUS_POINTS?: string;
  AMBASSADOR_TIER_REVIEW_CRON?: string;
  BRAND_CAMPAIGN_ACTIVATE_CRON?: string;
  BRAND_CAMPAIGN_EXPIRE_CRON?: string;
  BRAND_CAMPAIGN_STACKING?: string;
  BRAND_CAMPAIGN_DEFAULT_MAX_PER_USER?: string;
  LOYALTY_ANALYTICS_SNAPSHOT_CRON?: string;
  LOYALTY_CLV_RECOMPUTE_CRON?: string;
  LOYALTY_CLV_BATCH_SIZE?: string;
  CAMPAIGN_ATTRIBUTION_CRON?: string;
  CC_EXPIRY_HOURS?: string;
  CC_BONUS_POINTS?: string;
  CC_REMINDER_HOURS_BEFORE?: string;
  PRODUCT_CAMPAIGN_ACTIVATE_CRON?: string;
  PRODUCT_CAMPAIGN_EXPIRE_CRON?: string;
  CC_EXPIRY_CRON?: string;
  CC_REMINDER_CRON?: string;
  GLOBAL_SUPPORTED_CURRENCIES?: string;
}

const required: (keyof EnvSchema)[] = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const urlFields: (keyof EnvSchema)[] = [
  'DATABASE_URL',
  'REDIS_URL',
  'MEILISEARCH_HOST',
  'FRONTEND_URL',
];

export function validateEnvironmentVariables(
  config: Record<string, unknown>,
): Record<string, unknown> {
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
      if (
        field === 'DATABASE_URL' &&
        !value.startsWith('postgresql://') &&
        !value.startsWith('postgres://')
      ) {
        errors.push(`${field} must be a valid PostgreSQL URL`);
      }
      if (
        field === 'REDIS_URL' &&
        !value.startsWith('redis://') &&
        !value.startsWith('rediss://')
      ) {
        warnings.push(`${field} should be a valid Redis URL`);
      }
    }
  }

  if (
    config.STORAGE_PROVIDER &&
    !['local', 's3', 'minio', 'cloudinary'].includes(String(config.STORAGE_PROVIDER))
  ) {
    errors.push('STORAGE_PROVIDER must be one of: local, s3, minio, cloudinary');
  }

  if (config.STRIPE_SECRET_KEY && !config.STRIPE_WEBHOOK_SECRET) {
    warnings.push('STRIPE_WEBHOOK_SECRET should be set when using Stripe');
  }

  if (config.SMTP_HOST && (!config.SMTP_USER || !config.SMTP_PASS)) {
    warnings.push('SMTP_USER and SMTP_PASS should be set when SMTP_HOST is configured');
  }

  if (config.LOYALTY_ENABLED === 'true') {
    if (!config.HOS_SELLER_ID) {
      warnings.push('HOS_SELLER_ID should be set when loyalty is enabled');
    }
    if (!config.LOYALTY_DEFAULT_EARN_RATE) {
      warnings.push('LOYALTY_DEFAULT_EARN_RATE not set — defaulting to 1 pt/currency unit');
    }
  }

  if (config.POS_ENABLED === 'true') {
    if (!config.LIGHTSPEED_CLIENT_ID && !config.LIGHTSPEED_CLIENT_SECRET) {
      warnings.push(
        'Lightspeed OAuth: set LIGHTSPEED_CLIENT_ID and LIGHTSPEED_CLIENT_SECRET for token refresh, or store tokens only in encrypted POS credentials',
      );
    }
  }

  for (const warning of warnings) {
    logger.warn(`⚠️  ${warning}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return config;
}

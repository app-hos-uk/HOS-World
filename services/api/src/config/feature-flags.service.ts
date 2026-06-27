import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum FeatureFlag {
  FOUNDING_MEMBERS = 'FOUNDING_MEMBERS',
  EMAIL_TEMPLATE_OVERRIDES = 'EMAIL_TEMPLATE_OVERRIDES',
  LOYALTY_PROGRAMME = 'LOYALTY_PROGRAMME',
  AMBASSADOR_PROGRAMME = 'AMBASSADOR_PROGRAMME',
  BRAND_PARTNERSHIPS = 'BRAND_PARTNERSHIPS',
  CLICK_COLLECT = 'CLICK_COLLECT',
  DIGITAL_PRODUCTS = 'DIGITAL_PRODUCTS',
  INFLUENCER_STOREFRONTS = 'INFLUENCER_STOREFRONTS',
  GUEST_CHECKOUT = 'GUEST_CHECKOUT',
  AI_RECOMMENDATIONS = 'AI_RECOMMENDATIONS',
  POS_INTEGRATION = 'POS_INTEGRATION',
  MULTI_CURRENCY = 'MULTI_CURRENCY',
}

const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  [FeatureFlag.FOUNDING_MEMBERS]: true,
  [FeatureFlag.EMAIL_TEMPLATE_OVERRIDES]: true,
  [FeatureFlag.LOYALTY_PROGRAMME]: true,
  [FeatureFlag.AMBASSADOR_PROGRAMME]: true,
  [FeatureFlag.BRAND_PARTNERSHIPS]: true,
  [FeatureFlag.CLICK_COLLECT]: true,
  [FeatureFlag.DIGITAL_PRODUCTS]: true,
  [FeatureFlag.INFLUENCER_STOREFRONTS]: true,
  [FeatureFlag.GUEST_CHECKOUT]: true,
  [FeatureFlag.AI_RECOMMENDATIONS]: false,
  [FeatureFlag.POS_INTEGRATION]: false,
  [FeatureFlag.MULTI_CURRENCY]: false,
};

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly flags = new Map<string, boolean>();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    for (const [flag, defaultValue] of Object.entries(FLAG_DEFAULTS)) {
      const envKey = `FF_${flag}`;
      const envValue = this.configService.get<string>(envKey);
      const resolved =
        envValue !== undefined ? envValue === 'true' || envValue === '1' : defaultValue;
      this.flags.set(flag, resolved);
    }

    const enabled = [...this.flags.entries()]
      .filter(([, v]) => v)
      .map(([k]) => k);
    this.logger.log(`Feature flags loaded: ${enabled.length} enabled, ${this.flags.size - enabled.length} disabled`);
  }

  isEnabled(flag: FeatureFlag): boolean {
    return this.flags.get(flag) ?? false;
  }

  getAll(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [key, value] of this.flags) {
      result[key] = value;
    }
    return result;
  }

  setFlag(flag: FeatureFlag, enabled: boolean): void {
    this.flags.set(flag, enabled);
    this.logger.log(`Feature flag ${flag} set to ${enabled}`);
  }
}

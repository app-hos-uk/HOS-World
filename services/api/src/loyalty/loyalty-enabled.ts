import { ConfigService } from '@nestjs/config';
import { FeatureFlag, FeatureFlagsService } from '../config/feature-flags.service';
import { isTruthy } from '../common/utils/config';

/** Runtime gate for automatic earn/bonus side-effects (orders, jobs, listeners). */
export function isLoyaltyRuntimeEnabled(
  config: ConfigService,
  featureFlags: FeatureFlagsService,
): boolean {
  return (
    featureFlags.isEnabled(FeatureFlag.LOYALTY_PROGRAMME) &&
    isTruthy(config.get<string>('LOYALTY_ENABLED'))
  );
}

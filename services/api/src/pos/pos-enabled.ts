import { ConfigService } from '@nestjs/config';
import { FeatureFlag, FeatureFlagsService } from '../config/feature-flags.service';
import { isTruthy } from '../common/utils/config';

/**
 * Dual gate for POS runtime: env POS_ENABLED and FeatureFlag.POS_INTEGRATION.
 * Both must be on (defaults off) before webhooks/jobs/sync run.
 */
export function isPosRuntimeEnabled(
  config: ConfigService,
  featureFlags: FeatureFlagsService,
): boolean {
  return (
    isTruthy(config.get<string>('POS_ENABLED')) &&
    featureFlags.isEnabled(FeatureFlag.POS_INTEGRATION)
  );
}

import { isPosRuntimeEnabled } from './pos-enabled';
import { FeatureFlag } from '../config/feature-flags.service';

describe('isPosRuntimeEnabled', () => {
  it('requires both POS_ENABLED and FeatureFlag.POS_INTEGRATION', () => {
    const config = { get: jest.fn().mockReturnValue('true') } as any;
    const flags = {
      isEnabled: jest.fn().mockImplementation((f) => f === FeatureFlag.POS_INTEGRATION),
    } as any;
    expect(isPosRuntimeEnabled(config, flags)).toBe(true);

    config.get.mockReturnValue('false');
    expect(isPosRuntimeEnabled(config, flags)).toBe(false);

    config.get.mockReturnValue('true');
    flags.isEnabled.mockReturnValue(false);
    expect(isPosRuntimeEnabled(config, flags)).toBe(false);
  });
});

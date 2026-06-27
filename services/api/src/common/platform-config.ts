/** Default platform commission/fee rate (15%). Override via PLATFORM_FEE_RATE env. */
export const DEFAULT_PLATFORM_FEE_RATE = 0.15;

export function resolvePlatformFeeRate(getConfig: {
  get: <T = number>(key: string, defaultValue?: T) => T;
}): number {
  return getConfig.get<number>('PLATFORM_FEE_RATE', DEFAULT_PLATFORM_FEE_RATE);
}

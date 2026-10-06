import { ConfigService } from '@nestjs/config';

export async function findMarketId(
  prisma: any,
  where: { id?: string; code?: string; isDefault?: boolean },
): Promise<string | null> {
  if (typeof prisma.market?.findFirst !== 'function') return null;
  const row = await prisma.market.findFirst({ where, select: { id: true } });
  return row?.id ?? null;
}

export async function resolveDefaultMarketId(prisma: any): Promise<string | null> {
  return findMarketId(prisma, { isDefault: true });
}

/**
 * Per-market card prefix from PlatformSetting (`loyalty` / `card_prefix`),
 * then `LOYALTY_CARD_PREFIX`, then `HOS`.
 */
export async function resolveLoyaltyCardPrefix(
  prisma: any,
  config: ConfigService,
  marketId?: string | null,
): Promise<string> {
  if (marketId && typeof prisma.platformSetting?.findFirst === 'function') {
    const row = await prisma.platformSetting.findFirst({
      where: { category: 'loyalty', key: 'card_prefix', marketId },
      select: { value: true },
    });
    const value = typeof row?.value === 'string' ? row.value.trim() : '';
    if (value) return value.slice(0, 16);
  }
  const fromEnv = config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
  const prefix = (fromEnv && String(fromEnv).trim()) || 'HOS';
  return prefix.slice(0, 16);
}

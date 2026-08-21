import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type MarketRow = {
  id: string;
  code: string;
  name: string;
  country: string;
  countryCode: string;
  currency: string;
  locale: string;
  timezone: string;
  taxOrigin: unknown;
  isActive: boolean;
  isDefault: boolean;
};

const CACHE_TTL_MS = 30_000;

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private cache: { at: number; markets: MarketRow[] } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<MarketRow[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.markets;
    }
    try {
      const markets = (await this.prisma.market.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
      })) as MarketRow[];
      this.cache = { at: Date.now(), markets };
      return markets;
    } catch (e) {
      this.logger.warn(`Market list failed (migration pending?): ${(e as Error).message}`);
      return this.cache?.markets ?? [];
    }
  }

  async getDefault(): Promise<MarketRow | null> {
    const all = await this.listActive();
    return all.find((m) => m.isDefault) ?? all[0] ?? null;
  }

  async findByCode(code: string): Promise<MarketRow | null> {
    const normalised = code.trim().toUpperCase();
    const all = await this.listActive();
    return all.find((m) => m.code === normalised) ?? null;
  }

  async findById(id: string): Promise<MarketRow | null> {
    const all = await this.listActive();
    return all.find((m) => m.id === id) ?? null;
  }

  invalidate(): void {
    this.cache = null;
  }
}

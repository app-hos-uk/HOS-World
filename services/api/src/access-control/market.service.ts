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

  async listAll(): Promise<MarketRow[]> {
    const markets = (await this.prisma.market.findMany({
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    })) as MarketRow[];
    return markets;
  }

  async create(data: {
    code: string;
    name: string;
    country: string;
    countryCode: string;
    currency: string;
    locale: string;
    timezone: string;
    isActive?: boolean;
    isDefault?: boolean;
  }): Promise<MarketRow> {
    const market = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.market.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.market.create({ data });
    }) as MarketRow;
    this.invalidate();
    return market;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      country: string;
      countryCode: string;
      currency: string;
      locale: string;
      timezone: string;
      isActive: boolean;
      isDefault: boolean;
    }>,
  ): Promise<MarketRow> {
    const market = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.market.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.market.update({ where: { id }, data });
    }) as MarketRow;
    this.invalidate();
    return market;
  }

  invalidate(): void {
    this.cache = null;
  }
}

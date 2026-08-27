import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { normalizeCountryCode } from '../common/utils/country-code';
import { PrismaService } from '../database/prisma.service';

/**
 * Fixed shipping is priced in a single currency. Mixing currencies across tiers
 * would let one order sum charges from different currencies into one total.
 */
export const SHIPPING_CURRENCY = 'USD';

const DEFAULT_BOXES: Array<{
  name: string;
  label: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  customerPrice: number;
  packagingCost: number;
  sortOrder: number;
}> = [
  { name: 'SMALL', label: 'Small', lengthCm: 20, widthCm: 15, heightCm: 10, customerPrice: 9.99, packagingCost: 1.0, sortOrder: 1 },
  { name: 'MEDIUM', label: 'Medium', lengthCm: 30, widthCm: 20, heightCm: 15, customerPrice: 14.99, packagingCost: 1.5, sortOrder: 2 },
  { name: 'LARGE', label: 'Large', lengthCm: 40, widthCm: 30, heightCm: 20, customerPrice: 19.99, packagingCost: 2.25, sortOrder: 3 },
  { name: 'XL', label: 'Extra Large', lengthCm: 50, widthCm: 40, heightCm: 30, customerPrice: 29.99, packagingCost: 3.0, sortOrder: 4 },
  { name: 'CUSTOM', label: 'Custom', lengthCm: 40, widthCm: 30, heightCm: 20, customerPrice: 0, packagingCost: 2.25, sortOrder: 5 },
];

const DEFAULT_TIERS: Array<{
  code: string;
  name: string;
  description: string;
  countryCodes: string[];
  isCatchAll: boolean;
  sortOrder: number;
}> = [
  {
    code: 'TIER_1',
    name: 'Tier 1 — Domestic (US)',
    description: 'All 50 U.S. states, Washington D.C., and Puerto Rico.',
    countryCodes: ['US', 'PR'],
    isCatchAll: false,
    sortOrder: 1,
  },
  {
    code: 'TIER_2',
    name: 'Tier 2 — Near-International',
    description: 'Canada and Mexico.',
    countryCodes: ['CA', 'MX'],
    isCatchAll: false,
    sortOrder: 2,
  },
  {
    code: 'TIER_3',
    name: 'Tier 3 — Western Europe & UK',
    description: 'UK, Germany, France, Ireland, Italy, and nearby Western/Northern/Southern Europe.',
    countryCodes: [
      'GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'CH',
      'SE', 'NO', 'DK', 'FI', 'IS', 'GR', 'PL', 'CZ', 'SK', 'HU',
    ],
    isCatchAll: false,
    sortOrder: 3,
  },
  {
    code: 'TIER_4',
    name: 'Tier 4 — Rest of World',
    description: 'Asia, Africa, LATAM, Middle East, Oceania, and any country not listed above.',
    countryCodes: [],
    isCatchAll: true,
    sortOrder: 4,
  },
];

/**
 * Seed-only starting prices, used when a tier/box pair has no rate row yet.
 * Live pricing is whatever admin saves at /admin/shipping-rates — editing these
 * numbers will NOT change an existing deployment. CUSTOM stays 0 (staff quotes it).
 */
const DEFAULT_MATRIX: Record<string, Record<string, number>> = {
  SMALL: { TIER_1: 9.99, TIER_2: 14.99, TIER_3: 19.99, TIER_4: 24.99 },
  MEDIUM: { TIER_1: 14.99, TIER_2: 21.99, TIER_3: 29.99, TIER_4: 34.99 },
  LARGE: { TIER_1: 19.99, TIER_2: 29.99, TIER_3: 39.99, TIER_4: 49.99 },
  XL: { TIER_1: 29.99, TIER_2: 39.99, TIER_3: 54.99, TIER_4: 64.99 },
  CUSTOM: { TIER_1: 0, TIER_2: 0, TIER_3: 0, TIER_4: 0 },
};

@Injectable()
export class BoxSizeService {
  private seeded = false;

  constructor(private prisma: PrismaService) {}

  async list(storeId?: string, includeInactive = false) {
    await this.ensureDefaults(storeId);
    return this.prisma.boxSize.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        OR: storeId ? [{ storeId }, { storeId: null }] : [{ storeId: null }],
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: { rates: true },
    });
  }

  async create(data: {
    storeId?: string;
    name: string;
    label: string;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    customerPrice: number;
    packagingCost?: number;
    currency?: string;
    sortOrder?: number;
  }) {
    if (!data.name?.trim() || !data.label?.trim()) {
      throw new BadRequestException('Name and label are required');
    }
    const box = await this.prisma.boxSize.create({
      data: {
        storeId: data.storeId || null,
        name: data.name.trim().toUpperCase(),
        label: data.label.trim(),
        lengthCm: new Decimal(data.lengthCm),
        widthCm: new Decimal(data.widthCm),
        heightCm: new Decimal(data.heightCm),
        customerPrice: new Decimal(data.customerPrice),
        packagingCost: new Decimal(data.packagingCost ?? 0),
        currency: SHIPPING_CURRENCY,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    await this.ensureTiersAndRates();
    return box;
  }

  async update(
    id: string,
    data: {
      label?: string;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
      customerPrice?: number;
      packagingCost?: number;
      currency?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const row = await this.prisma.boxSize.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Box size not found');
    return this.prisma.boxSize.update({
      where: { id },
      data: {
        ...(data.label != null ? { label: data.label } : {}),
        ...(data.lengthCm != null ? { lengthCm: new Decimal(data.lengthCm) } : {}),
        ...(data.widthCm != null ? { widthCm: new Decimal(data.widthCm) } : {}),
        ...(data.heightCm != null ? { heightCm: new Decimal(data.heightCm) } : {}),
        ...(data.customerPrice != null ? { customerPrice: new Decimal(data.customerPrice) } : {}),
        ...(data.packagingCost != null ? { packagingCost: new Decimal(data.packagingCost) } : {}),
        ...(data.isActive != null ? { isActive: data.isActive } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async deactivate(id: string) {
    const row = await this.prisma.boxSize.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Box size not found');
    return this.prisma.boxSize.update({ where: { id }, data: { isActive: false } });
  }

  recommendName(itemCount: number): string {
    if (itemCount <= 2) return 'SMALL';
    if (itemCount <= 5) return 'MEDIUM';
    if (itemCount <= 10) return 'LARGE';
    return 'XL';
  }

  async rateMatrix() {
    await this.ensureDefaults();
    const [tiers, boxes, rates] = await Promise.all([
      this.prisma.shippingRateTier.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.boxSize.findMany({
        where: { storeId: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.boxSizeRate.findMany(),
    ]);
    return {
      tiers: tiers.map((t) => ({
        ...t,
        countryCodes: asStringArray(t.countryCodes),
      })),
      boxes,
      rates: rates.map((r) => ({
        id: r.id,
        boxSizeId: r.boxSizeId,
        tierId: r.tierId,
        customerPrice: Number(r.customerPrice),
      })),
    };
  }

  async updateTier(
    id: string,
    data: { name?: string; description?: string; countryCodes?: string[]; isActive?: boolean; currency?: string },
  ) {
    const row = await this.prisma.shippingRateTier.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Shipping tier not found');
    // Fixed shipping is priced in USD only; a mixed-currency matrix would let a
    // single order sum charges across currencies.
    if (data.currency != null && data.currency.toUpperCase() !== SHIPPING_CURRENCY) {
      throw new BadRequestException(`Shipping rates are ${SHIPPING_CURRENCY}-only`);
    }
    const codes = data.countryCodes?.map((c) => this.normalizeCountry(c)).filter(Boolean);
    return this.prisma.shippingRateTier.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(codes ? { countryCodes: codes } : {}),
        ...(data.isActive != null ? { isActive: data.isActive } : {}),
      },
    });
  }

  async saveRates(entries: Array<{ boxSizeId: string; tierId: string; customerPrice: number }>) {
    if (!entries?.length) throw new BadRequestException('No rates to save');
    await this.prisma.$transaction(
      entries.map((entry) => {
        if (!(entry.customerPrice >= 0)) {
          throw new BadRequestException('Price must be 0 or greater');
        }
        return this.prisma.boxSizeRate.upsert({
          where: { boxSizeId_tierId: { boxSizeId: entry.boxSizeId, tierId: entry.tierId } },
          create: {
            boxSizeId: entry.boxSizeId,
            tierId: entry.tierId,
            customerPrice: new Decimal(entry.customerPrice.toFixed(2)),
          },
          update: { customerPrice: new Decimal(entry.customerPrice.toFixed(2)) },
        });
      }),
    );
    return this.rateMatrix();
  }

  async resolveRate(boxSizeId: string, country?: string | null) {
    await this.ensureTiersAndRates();
    const box = await this.prisma.boxSize.findUnique({
      where: { id: boxSizeId },
      include: { rates: { include: { tier: true } } },
    });
    if (!box) throw new NotFoundException('Box size not found');
    const tiers = await this.prisma.shippingRateTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const tier = this.matchTierSync(country, tiers);
    const rate = box.rates.find((r) => r.tierId === tier?.id);
    const price = rate ? Number(rate.customerPrice) : Number(box.customerPrice);
    return {
      boxSizeId: box.id,
      boxName: box.name,
      boxLabel: box.label,
      packagingCost: Number(box.packagingCost),
      price,
      currency: tier?.currency || box.currency,
      tier: tier
        ? { id: tier.id, code: tier.code, name: tier.name, isCatchAll: tier.isCatchAll }
        : null,
    };
  }

  async pricesForCountry(country?: string | null) {
    await this.ensureDefaults();
    const boxes = await this.prisma.boxSize.findMany({
      where: { isActive: true, storeId: null },
      include: { rates: true },
      orderBy: { sortOrder: 'asc' },
    });
    const tiers = await this.prisma.shippingRateTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const tier = this.matchTierSync(country, tiers);
    return {
      tier: tier
        ? {
            id: tier.id,
            code: tier.code,
            name: tier.name,
            description: tier.description,
            currency: tier.currency,
            isCatchAll: tier.isCatchAll,
          }
        : null,
      prices: Object.fromEntries(
        boxes.map((box) => {
          const rate = tier ? box.rates.find((r) => r.tierId === tier.id) : null;
          return [box.id, rate ? Number(rate.customerPrice) : Number(box.customerPrice)];
        }),
      ) as Record<string, number>,
    };
  }

  normalizeCountry(raw?: string | null): string {
    return normalizeCountryCode(raw) || '';
  }

  private matchTierSync(
    country: string | null | undefined,
    tiers?: Array<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      countryCodes: unknown;
      isCatchAll: boolean;
      currency: string;
    }>,
  ) {
    const code = this.normalizeCountry(country);
    const list = tiers || [];
    const hit = list.find((t) => !t.isCatchAll && asStringArray(t.countryCodes).includes(code));
    if (hit) return hit;
    return list.find((t) => t.isCatchAll) || list[list.length - 1] || null;
  }

  private seedingPromise: Promise<void> | null = null;

  private async ensureDefaults(storeId?: string) {
    if (this.seeded && !storeId) return;
    if (!storeId) {
      if (!this.seedingPromise) {
        this.seedingPromise = this.doEnsureDefaults(undefined).finally(() => {
          this.seedingPromise = null;
        });
      }
      return this.seedingPromise;
    }
    return this.doEnsureDefaults(storeId);
  }

  private async doEnsureDefaults(storeId?: string) {
    const existing = await this.prisma.boxSize.count({
      where: storeId ? { OR: [{ storeId }, { storeId: null }] } : { storeId: null },
    });
    if (existing === 0) {
      await this.prisma.boxSize.createMany({
        skipDuplicates: true,
        data: DEFAULT_BOXES.map((b) => ({
          storeId: null,
          name: b.name,
          label: b.label,
          lengthCm: b.lengthCm,
          widthCm: b.widthCm,
          heightCm: b.heightCm,
          customerPrice: b.customerPrice,
          packagingCost: b.packagingCost,
          currency: SHIPPING_CURRENCY,
          sortOrder: b.sortOrder,
        })),
      });
    }
    if (!storeId) this.seeded = true;
    await this.ensureTiersAndRates();
  }

  private async ensureTiersAndRates() {
    const tierCount = await this.prisma.shippingRateTier.count();
    if (tierCount === 0) {
      for (const t of DEFAULT_TIERS) {
        await this.prisma.shippingRateTier.create({
          data: {
            code: t.code,
            name: t.name,
            description: t.description,
            countryCodes: t.countryCodes,
            isCatchAll: t.isCatchAll,
            sortOrder: t.sortOrder,
            currency: SHIPPING_CURRENCY,
          },
        });
      }
    }
    const [tiers, boxes, existingRates] = await Promise.all([
      this.prisma.shippingRateTier.findMany(),
      this.prisma.boxSize.findMany({ where: { storeId: null } }),
      this.prisma.boxSizeRate.findMany({ select: { boxSizeId: true, tierId: true } }),
    ]);
    if (!boxes?.length || !tiers?.length) return;
    const have = new Set((existingRates || []).map((r) => `${r.boxSizeId}:${r.tierId}`));
    const rows = [];
    for (const box of boxes) {
      for (const tier of tiers) {
        if (have.has(`${box.id}:${tier.id}`)) continue;
        const price = DEFAULT_MATRIX[box.name]?.[tier.code] ?? Number(box.customerPrice);
        rows.push({
          boxSizeId: box.id,
          tierId: tier.id,
          customerPrice: new Decimal(price),
        });
      }
    }
    if (rows.length) await this.prisma.boxSizeRate.createMany({ data: rows });
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).toUpperCase()).filter(Boolean);
}

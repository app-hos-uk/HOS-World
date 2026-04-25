import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateProductCampaignDto } from './dto/create-product-campaign.dto';
import { UpdateProductCampaignDto } from './dto/update-product-campaign.dto';

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export type ProductCampaignLine = {
  productId: string;
  fandom?: string | null;
  brand?: string | null;
  categoryId?: string | null;
  quantity: number;
};

@Injectable()
export class ProductCampaignsService {
  constructor(private prisma: PrismaService) {}

  lineMatchesCampaign(
    line: Pick<ProductCampaignLine, 'productId' | 'fandom' | 'categoryId'>,
    c: {
      productIds: string[];
      categoryIds: string[];
      fandomFilter: string[];
      type: string;
    },
  ): boolean {
    const hasP = (c.productIds?.length ?? 0) > 0;
    const hasC = (c.categoryIds?.length ?? 0) > 0;
    const hasF = (c.fandomFilter?.length ?? 0) > 0;
    if (!hasP && !hasC && !hasF) {
      return true;
    }
    if (hasP && !c.productIds.includes(line.productId)) {
      return false;
    }
    if (hasC && (!line.categoryId || !c.categoryIds.includes(line.categoryId))) {
      return false;
    }
    if (hasF) {
      const fd = norm(line.fandom);
      if (!fd) return false;
      return c.fandomFilter.some((f) => norm(f) === fd || fd.includes(norm(f)));
    }
    return true;
  }

  private hasTargeting(p: string[], c: string[], f: string[]): boolean {
    return (p?.length ?? 0) > 0 || (c?.length ?? 0) > 0 || (f?.length ?? 0) > 0;
  }

  private assertCreateTargeting(dto: CreateProductCampaignDto): void {
    const p = dto.productIds ?? [];
    const c = dto.categoryIds ?? [];
    const f = dto.fandomFilter ?? [];
    if (!this.hasTargeting(p, c, f) && !dto.applyToAllProducts) {
      throw new BadRequestException(
        'Add product, category, or fandom targeting, or set applyToAllProducts to true',
      );
    }
  }

  private assertUpdateTargeting(
    row: { productIds: string[]; categoryIds: string[]; fandomFilter: string[] },
    dto: UpdateProductCampaignDto,
  ): void {
    const p = dto.productIds !== undefined ? dto.productIds : row.productIds;
    const c = dto.categoryIds !== undefined ? dto.categoryIds : row.categoryIds;
    const f = dto.fandomFilter !== undefined ? dto.fandomFilter : row.fandomFilter;
    if (!this.hasTargeting(p, c, f) && dto.applyToAllProducts !== true) {
      throw new BadRequestException(
        'Resulting campaign has no targeting; set applyToAllProducts to true or add criteria',
      );
    }
  }

  async create(dto: CreateProductCampaignDto) {
    this.assertCreateTargeting(dto);
    const base = dto.slug?.trim() || slugify(dto.name);
    let slug = base;
    let n = 0;
    for (;;) {
      const clash = await this.prisma.productCampaign.findUnique({ where: { slug } });
      if (!clash) break;
      n++;
      slug = `${base}-${n}`;
    }
    return this.prisma.productCampaign.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() ?? null,
        type: dto.type ?? 'BONUS_POINTS',
        status: 'DRAFT',
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        productIds: dto.productIds ?? [],
        categoryIds: dto.categoryIds ?? [],
        fandomFilter: dto.fandomFilter ?? [],
        bonusPoints: dto.bonusPoints ?? null,
        minTierLevel: dto.minTierLevel ?? 0,
        regionCodes: dto.regionCodes ?? [],
        maxRedemptions: dto.maxRedemptions ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateProductCampaignDto) {
    const row = await this.get(id);
    if (
      dto.productIds !== undefined ||
      dto.categoryIds !== undefined ||
      dto.fandomFilter !== undefined ||
      dto.applyToAllProducts !== undefined
    ) {
      this.assertUpdateTargeting(row, dto);
    }
    const data: Prisma.ProductCampaignUpdateInput = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type != null) data.type = dto.type;
    if (dto.startsAt != null) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt != null) data.endsAt = new Date(dto.endsAt);
    if (dto.productIds != null) data.productIds = dto.productIds;
    if (dto.categoryIds != null) data.categoryIds = dto.categoryIds;
    if (dto.fandomFilter != null) data.fandomFilter = dto.fandomFilter;
    if (dto.bonusPoints !== undefined) data.bonusPoints = dto.bonusPoints;
    if (dto.minTierLevel != null) data.minTierLevel = dto.minTierLevel;
    if (dto.regionCodes != null) data.regionCodes = dto.regionCodes;
    if (dto.maxRedemptions !== undefined) data.maxRedemptions = dto.maxRedemptions;
    return this.prisma.productCampaign.update({ where: { id }, data });
  }

  async get(id: string) {
    const row = await this.prisma.productCampaign.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Product campaign not found');
    return row;
  }

  async list(filters: { status?: string }) {
    const where: Prisma.ProductCampaignWhereInput = {};
    if (filters.status) where.status = filters.status;
    return this.prisma.productCampaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async activate(id: string) {
    const c = await this.get(id);
    if (!['DRAFT', 'SCHEDULED'].includes(c.status)) {
      throw new BadRequestException('Campaign cannot be activated from this status');
    }
    const now = new Date();
    if (c.endsAt <= now) throw new BadRequestException('Campaign end date is in the past');
    return this.prisma.productCampaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async complete(id: string) {
    await this.get(id);
    return this.prisma.productCampaign.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  async cancel(id: string) {
    await this.get(id);
    return this.prisma.productCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async runScheduledActivations(): Promise<number> {
    const now = new Date();
    const res = await this.prisma.productCampaign.updateMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      data: { status: 'ACTIVE' },
    });
    return res.count;
  }

  async runExpiredCompletions(): Promise<number> {
    const now = new Date();
    const res = await this.prisma.productCampaign.updateMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        endsAt: { lt: now },
      },
      data: { status: 'COMPLETED' },
    });
    return res.count;
  }

  /**
   * Apply loyalty bonus points from active product campaigns inside a transaction.
   * Increments per-campaign redemption counts; auto-completes when maxRedemptions reached.
   */
  async applyProductCampaignBonusInTx(
    tx: Prisma.TransactionClient,
    params: {
      tierLevel: number;
      regionCode: string;
      lines: ProductCampaignLine[];
    },
  ): Promise<{
    points: number;
    primaryCampaignId?: string;
    primaryCampaignName?: string;
    breakdown: Array<{ campaignId: string; name: string; bonus: number }>;
  }> {
    const now = new Date();
    const campaigns = await tx.productCampaign.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
        type: 'BONUS_POINTS',
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalBonus = 0;
    const breakdown: Array<{ campaignId: string; name: string; bonus: number }> = [];

    for (const c of campaigns) {
      if (c.minTierLevel > params.tierLevel) continue;
      if (c.regionCodes?.length && !c.regionCodes.includes(params.regionCode)) continue;

      const fresh = await tx.productCampaign.findUnique({ where: { id: c.id } });
      if (!fresh) continue;
      if (fresh.maxRedemptions != null && fresh.totalRedemptions >= fresh.maxRedemptions) {
        continue;
      }

      const perUnit = fresh.bonusPoints ?? 0;
      if (perUnit <= 0) continue;

      let units = 0;
      for (const line of params.lines) {
        if (this.lineMatchesCampaign(line, fresh)) {
          units += Math.max(0, line.quantity);
        }
      }
      if (units <= 0) continue;

      const redemptionIncrement = Math.max(1, units);
      if (
        fresh.maxRedemptions != null &&
        fresh.totalRedemptions + redemptionIncrement > fresh.maxRedemptions
      ) {
        continue;
      }

      const bonus = perUnit * units;
      const updated = await tx.productCampaign.update({
        where: { id: c.id },
        data: {
          totalRedemptions: { increment: redemptionIncrement },
        },
      });

      if (updated.maxRedemptions != null && updated.totalRedemptions >= updated.maxRedemptions) {
        await tx.productCampaign.update({
          where: { id: c.id },
          data: { status: 'COMPLETED' },
        });
      }

      totalBonus += bonus;
      breakdown.push({ campaignId: c.id, name: c.name, bonus });
    }

    const primary = breakdown[0];
    return {
      points: totalBonus,
      primaryCampaignId: primary?.campaignId,
      primaryCampaignName: primary?.name,
      breakdown,
    };
  }
}

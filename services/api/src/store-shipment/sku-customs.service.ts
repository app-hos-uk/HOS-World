import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';

export type SkuCustomsStatus = 'PENDING' | 'READY' | 'BLOCKED';

@Injectable()
export class SkuCustomsService {
  private readonly logger = new Logger(SkuCustomsService.name);

  constructor(private prisma: PrismaService) {}

  async getOrCreateForSku(sku: string, productId?: string | null) {
    const normalized = sku.trim();
    let row = await this.prisma.skuCustomsAttribute.findUnique({ where: { sku: normalized } });
    if (row) return row;

    let weightKg: Decimal | undefined;
    let lengthCm: Decimal | undefined;
    let widthCm: Decimal | undefined;
    let heightCm: Decimal | undefined;

    if (productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { weight: true, length: true, width: true, height: true },
      });
      if (product?.weight) weightKg = product.weight;
      if (product?.length) lengthCm = product.length;
      if (product?.width) widthCm = product.width;
      if (product?.height) heightCm = product.height;
    }

    const ready =
      weightKg != null &&
      lengthCm != null &&
      widthCm != null &&
      heightCm != null;

    row = await this.prisma.skuCustomsAttribute.create({
      data: {
        sku: normalized,
        productId: productId ?? undefined,
        weightKg,
        lengthCm,
        widthCm,
        heightCm,
        status: ready ? 'READY' : 'PENDING',
      },
    });
    return row;
  }

  async listPending(limit = 50) {
    return this.prisma.skuCustomsAttribute.findMany({
      where: { status: 'PENDING' },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }

  async update(
    id: string,
    data: {
      hsCode?: string;
      countryOfOrigin?: string;
      weightKg?: number;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
      status?: SkuCustomsStatus;
      restrictedCountries?: string[];
    },
  ) {
    const existing = await this.prisma.skuCustomsAttribute.findUnique({ where: { id } });
    const priorMeta = (existing?.metadata as Record<string, unknown> | null) ?? {};
    const metadata =
      data.restrictedCountries !== undefined
        ? {
            ...priorMeta,
            restrictedCountries: data.restrictedCountries.map((c) => c.trim().toUpperCase()),
          }
        : undefined;

    const row = await this.prisma.skuCustomsAttribute.update({
      where: { id },
      data: {
        hsCode: data.hsCode,
        countryOfOrigin: data.countryOfOrigin,
        weightKg: data.weightKg != null ? new Decimal(data.weightKg) : undefined,
        lengthCm: data.lengthCm != null ? new Decimal(data.lengthCm) : undefined,
        widthCm: data.widthCm != null ? new Decimal(data.widthCm) : undefined,
        heightCm: data.heightCm != null ? new Decimal(data.heightCm) : undefined,
        status: data.status,
        ...(metadata ? { metadata } : {}),
      },
    });

    if (
      row.hsCode &&
      row.countryOfOrigin &&
      row.weightKg != null &&
      row.lengthCm != null &&
      row.widthCm != null &&
      row.heightCm != null &&
      row.status !== 'BLOCKED'
    ) {
      return this.prisma.skuCustomsAttribute.update({
        where: { id },
        data: { status: 'READY' },
      });
    }
    return row;
  }

  isRestrictedForDestination(
    attr: { metadata?: unknown; sku: string },
    destinationCountry: string,
  ): boolean {
    const dest = destinationCountry.trim().toUpperCase();
    if (!dest) return false;
    const meta = attr.metadata as { restrictedCountries?: string[] } | null;
    if (!meta?.restrictedCountries?.length) return false;
    return meta.restrictedCountries.some((c) => c.trim().toUpperCase() === dest);
  }

  async enrichSaleItems(items: Array<{ sku?: string | null; productId?: string | null }>) {
    const results = [];
    let allReady = true;
    let anyBlocked = false;

    for (const item of items) {
      const sku = item.sku?.trim();
      if (!sku) {
        allReady = false;
        results.push({ sku: null, status: 'BLOCKED' as const });
        anyBlocked = true;
        continue;
      }
      const attr = await this.getOrCreateForSku(sku, item.productId);
      results.push({ sku, status: attr.status as SkuCustomsStatus, id: attr.id });
      if (attr.status !== 'READY') allReady = false;
      if (attr.status === 'BLOCKED') anyBlocked = true;
    }

    return { results, allReady, anyBlocked };
  }
}

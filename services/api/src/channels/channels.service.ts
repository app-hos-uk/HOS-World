import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CurrencyService } from '../currency/currency.service';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private currency: CurrencyService,
  ) {}

  async assignProductToChannel(data: {
    productId: string;
    channelType: string;
    storeId?: string | null;
    currency: string;
    sellingPrice: number;
    costPrice?: number | null;
    compareAtPrice?: number | null;
    isActive?: boolean;
    assignedBy?: string | null;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productChannel.create({
      data: {
        productId: data.productId,
        channelType: data.channelType,
        storeId: data.storeId ?? undefined,
        currency: data.currency,
        sellingPrice: new Decimal(data.sellingPrice),
        costPrice: data.costPrice != null ? new Decimal(data.costPrice) : undefined,
        compareAtPrice: data.compareAtPrice != null ? new Decimal(data.compareAtPrice) : undefined,
        isActive: data.isActive ?? true,
        assignedBy: data.assignedBy ?? undefined,
      },
    });
  }

  async removeProductFromChannel(productChannelId: string) {
    await this.prisma.productChannel.delete({ where: { id: productChannelId } });
  }

  async updateChannelPrice(
    productChannelId: string,
    body: { sellingPrice: number; costPrice?: number; compareAtPrice?: number; isActive?: boolean },
  ) {
    return this.prisma.productChannel.update({
      where: { id: productChannelId },
      data: {
        sellingPrice: new Decimal(body.sellingPrice),
        costPrice: body.costPrice != null ? new Decimal(body.costPrice) : undefined,
        compareAtPrice: body.compareAtPrice != null ? new Decimal(body.compareAtPrice) : undefined,
        isActive: body.isActive,
      },
    });
  }

  getProductChannels(productId: string) {
    return this.prisma.productChannel.findMany({
      where: { productId },
      orderBy: { effectiveFrom: 'desc' },
      include: { store: true },
    });
  }

  getStoreProducts(storeId: string) {
    return this.prisma.productChannel.findMany({
      where: { storeId, isActive: true },
      include: { product: true },
    });
  }

  async resolvePrice(
    productId: string,
    channelType: string,
    storeId: string | undefined,
    currency: string,
  ): Promise<{ price: number; source: 'channel' | 'product' }> {
    const now = new Date();
    const row = await this.prisma.productChannel.findFirst({
      where: {
        productId,
        channelType,
        currency,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        storeId: storeId ?? null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (row) {
      return { price: row.sellingPrice.toNumber(), source: 'channel' };
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    let price = product.price.toNumber();
    if (product.currency !== currency) {
      price = await this.currency.convertBetween(price, product.currency, currency);
    }
    return { price, source: 'product' };
  }
}

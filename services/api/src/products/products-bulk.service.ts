import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductsBulkService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async exportProducts(sellerId: string): Promise<any[]> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new BadRequestException('Seller not found');
    }

    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      include: {
        images: true,
        variations: true,
      },
    });

    // Format for CSV/Excel export
    return products.map((product) => ({
      name: product.name,
      description: product.description,
      sku: product.sku || '',
      barcode: product.barcode || '',
      ean: product.ean || '',
      price: Number(product.price),
      tradePrice: product.tradePrice ? Number(product.tradePrice) : '',
      rrp: product.rrp ? Number(product.rrp) : '',
      currency: product.currency,
      taxRate: Number(product.taxRate),
      stock: product.stock,
      fandom: product.fandom || '',
      category: product.category || '',
      tags: product.tags.join(', '),
      status: product.status,
      images: product.images.map((img) => img.url).join(' | '),
      variations: JSON.stringify(product.variations.map((v) => ({
        name: v.name,
        options: v.options,
      }))),
    }));
  }

  async importProducts(sellerId: string, products: any[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new BadRequestException('Seller not found');
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const productData of products) {
      try {
        await this.productsService.create(sellerId, {
          name: productData.name,
          description: productData.description || '',
          sku: productData.sku,
          barcode: productData.barcode,
          ean: productData.ean,
          price: Number(productData.price) || 0,
          tradePrice: productData.tradePrice ? Number(productData.tradePrice) : undefined,
          rrp: productData.rrp ? Number(productData.rrp) : undefined,
          currency: productData.currency || 'USD',
          taxRate: productData.taxRate ? Number(productData.taxRate) : 0,
          stock: Number(productData.stock) || 0,
          fandom: productData.fandom,
          category: productData.category,
          tags: productData.tags ? productData.tags.split(',').map((t: string) => t.trim()) : [],
          status: ((productData.status as ProductStatus) || ProductStatus.DRAFT),
          images: productData.images
            ? productData.images.split('|').map((url: string, index: number) => ({
                url: url.trim(),
                order: index,
              }))
            : [],
          variations: productData.variations
            ? JSON.parse(productData.variations)
            : undefined,
        });
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Product "${productData.name}": ${error.message}`);
      }
    }

    return { success, failed, errors };
  }
}



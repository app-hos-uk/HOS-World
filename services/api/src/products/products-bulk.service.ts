import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';
import { ProductStatus } from '@prisma/client';
import { QueueService, JobType } from '../queue/queue.service';

@Injectable()
export class ProductsBulkService implements OnModuleInit {
  private readonly logger = new Logger(ProductsBulkService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private queueService: QueueService,
  ) {}

  async onModuleInit() {
    this.queueService.registerProcessor(JobType.BULK_IMPORT, async (job) => {
      const { sellerId, products } = job.data;
      this.logger.log(
        `Processing bulk import job ${job.id}: ${products.length} products for seller ${sellerId}`,
      );
      return this.importProducts(sellerId, products);
    });

    this.logger.log('Registered BULK_IMPORT job processor');
  }

  async queueBulkImport(sellerId: string, products: any[]): Promise<string> {
    const jobId = await this.queueService.queueBulkImport({ sellerId, products });
    this.logger.log(
      `Queued bulk import job ${jobId}: ${products.length} products for seller ${sellerId}`,
    );
    return jobId;
  }

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
      variations: JSON.stringify(
        product.variations.map((v) => ({
          name: v.name,
          options: v.options,
        })),
      ),
    }));
  }

  async validateImport(
    sellerId: string,
    products: any[],
  ): Promise<{
    total: number;
    valid: number;
    invalid: number;
    rows: Array<{
      rowIndex: number;
      name: string;
      sku?: string;
      valid: boolean;
      errors: string[];
      data: Record<string, unknown>;
    }>;
  }> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new BadRequestException('Seller not found');
    }

    const rows = await Promise.all(
      products.map(async (productData, index) => {
        const errors = await this.getImportValidationErrorsAsync(productData, seller.id);
        return {
          rowIndex: index + 1,
          name: productData.name || '',
          sku: productData.sku || undefined,
          valid: errors.length === 0,
          errors,
          data: productData as Record<string, unknown>,
        };
      }),
    );

    const valid = rows.filter((r) => r.valid).length;
    return {
      total: rows.length,
      valid,
      invalid: rows.length - valid,
      rows,
    };
  }

  private async checkDuplicateSku(sellerId: string, sku: string): Promise<boolean> {
    const existing = await this.prisma.product.findFirst({
      where: { sellerId, sku },
      select: { id: true },
    });
    return !!existing;
  }

  private getImportValidationErrors(productData: any, sellerId: string): string[] {
    const errors: string[] = [];
    if (!productData.name?.trim()) {
      errors.push('Name is required');
    }
    if (productData.price != null && Number(productData.price) < 0) {
      errors.push('Price cannot be negative');
    }
    if (productData.stock != null && Number(productData.stock) < 0) {
      errors.push('Stock cannot be negative');
    }
    return errors;
  }

  private async getImportValidationErrorsAsync(productData: any, sellerId: string): Promise<string[]> {
    const errors = this.getImportValidationErrors(productData, sellerId);
    if (productData.sku?.trim()) {
      const duplicate = await this.checkDuplicateSku(sellerId, productData.sku.trim());
      if (duplicate) {
        errors.push(`Duplicate SKU "${productData.sku}" for this seller`);
      }
    }
    return errors;
  }

  async importProducts(
    sellerId: string,
    products: any[],
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
    failedRows: Array<Record<string, unknown>>;
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
    const failedRows: Array<Record<string, unknown>> = [];

    for (let index = 0; index < products.length; index++) {
      const productData = products[index];
      try {
        const validationErrors = await this.getImportValidationErrorsAsync(productData, seller.id);
        if (validationErrors.length > 0) {
          failed++;
          const errorMsg = validationErrors.join('; ');
          errors.push(`Row ${index + 1} "${productData.name || 'Unknown'}": ${errorMsg}`);
          failedRows.push({
            rowIndex: index + 1,
            error: errorMsg,
            name: productData.name || '',
            sku: productData.sku || '',
            price: productData.price ?? '',
            stock: productData.stock ?? '',
            description: productData.description || '',
            currency: productData.currency || '',
            category: productData.category || '',
            fandom: productData.fandom || '',
            tags: productData.tags || '',
            images: productData.images || '',
            status: productData.status || '',
          });
          continue;
        }

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
          status: (productData.status as ProductStatus) || ProductStatus.DRAFT,
          images: productData.images
            ? (typeof productData.images === 'string'
                ? productData.images.split('|').map((url: string, index: number) => ({
                    url: url.trim(),
                    order: index,
                  }))
                : Array.isArray(productData.images)
                  ? productData.images.map((img: any, index: number) => ({
                      url: typeof img === 'string' ? img.trim() : img.url?.trim() || '',
                      alt: typeof img === 'object' ? img.alt : undefined,
                      order: typeof img === 'object' && img.order != null ? img.order : index,
                    }))
                  : [])
            : [],
          variations: productData.variations ? JSON.parse(productData.variations) : undefined,
        });
        success++;
      } catch (error: any) {
        failed++;
        const errorMsg = error.message || 'Import failed';
        errors.push(`Row ${index + 1} "${productData.name || 'Unknown'}": ${errorMsg}`);
        failedRows.push({
          rowIndex: index + 1,
          error: errorMsg,
          name: productData.name || '',
          sku: productData.sku || '',
          price: productData.price ?? '',
          stock: productData.stock ?? '',
          description: productData.description || '',
          currency: productData.currency || '',
          category: productData.category || '',
          fandom: productData.fandom || '',
          tags: productData.tags || '',
          images: productData.images || '',
          status: productData.status || '',
        });
      }
    }

    return { success, failed, errors, failedRows };
  }
}

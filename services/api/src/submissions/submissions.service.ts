import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { ProductSubmissionStatus } from '@prisma/client';
import { DuplicatesService } from '../duplicates/duplicates.service';
import { MeilisearchService } from '../meilisearch/meilisearch.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private duplicatesService: DuplicatesService,
    private meilisearchService: MeilisearchService,
  ) {}

  /** Idempotency window: reject duplicate submissions with same name from same seller within this period (ms). */
  private static readonly DUPLICATE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

  async create(userId: string, createSubmissionDto: CreateSubmissionDto) {
    // Verify seller exists
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    const name = createSubmissionDto.name?.trim();
    if (name) {
      const since = new Date(Date.now() - SubmissionsService.DUPLICATE_WINDOW_MS);
      const recentSubmissions = await this.prisma.productSubmission.findMany({
        where: {
          sellerId: seller.id,
          status: 'SUBMITTED',
          createdAt: { gte: since },
        },
        select: { id: true, productData: true },
      });
      const duplicate = recentSubmissions.some((s) => {
        const data = s.productData as { name?: string };
        return (data?.name ?? '').trim() === name;
      });
      if (duplicate) {
        throw new BadRequestException(
          'A submission with this product name was just created. Please check your submissions list to avoid duplicates.',
        );
      }
    }

    // Block exact-match duplicates against existing catalog products
    const sku = createSubmissionDto.sku?.trim();
    const barcode = createSubmissionDto.barcode?.trim();
    const ean = createSubmissionDto.ean?.trim();
    if (sku || barcode || ean) {
      const exactMatchConditions: any[] = [];
      if (sku) exactMatchConditions.push({ sku });
      if (barcode) exactMatchConditions.push({ barcode });
      if (ean) exactMatchConditions.push({ ean });

      const existingProduct = await this.prisma.product.findFirst({
        where: {
          status: { in: ['ACTIVE', 'DRAFT'] },
          OR: exactMatchConditions,
        },
        select: { id: true, name: true, sku: true },
      });

      if (existingProduct) {
        throw new BadRequestException(
          `This product already exists in the catalog as "${existingProduct.name}" (ID: ${existingProduct.id}). ` +
            `Instead of submitting a new product, use "List as Vendor" to sell this existing product with your own pricing.`,
        );
      }
    }

    if (!createSubmissionDto.name?.trim()) {
      throw new BadRequestException('Product name is required');
    }
    if (
      createSubmissionDto.price == null ||
      typeof createSubmissionDto.price !== 'number' ||
      createSubmissionDto.price <= 0
    ) {
      throw new BadRequestException('A valid positive price is required');
    }

    const productData = {
      name: createSubmissionDto.name,
      description: createSubmissionDto.description,
      shortDescription: createSubmissionDto.shortDescription,
      sku: createSubmissionDto.sku,
      barcode: createSubmissionDto.barcode,
      ean: createSubmissionDto.ean,
      price: createSubmissionDto.price,
      tradePrice: createSubmissionDto.tradePrice,
      rrp: createSubmissionDto.rrp,
      currency: createSubmissionDto.currency || 'USD',
      taxRate: createSubmissionDto.taxRate || 0,
      stock: createSubmissionDto.stock,
      quantity: createSubmissionDto.quantity,
      fandom: createSubmissionDto.fandom,
      category: createSubmissionDto.category,
      categoryId: createSubmissionDto.categoryId,
      tags: createSubmissionDto.tags || [],
      images: createSubmissionDto.images,
      variations: createSubmissionDto.variations || [],
    };

    const submission = await this.prisma.productSubmission.create({
      data: {
        sellerId: seller.id,
        productData: productData as any,
        status: 'SUBMITTED',
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            sellerType: true,
          },
        },
      },
    });

    // Automatically detect duplicates
    await this.duplicatesService.detectDuplicates(submission.id);

    return submission;
  }

  async findAll(userId: string, status?: ProductSubmissionStatus) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    const where: any = {
      sellerId: seller.id,
    };

    if (status) {
      where.status = status;
    }

    const submissions = await this.prisma.productSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            sellerType: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
        shipment: {
          select: {
            id: true,
            status: true,
            trackingNumber: true,
          },
        },
        catalogEntry: {
          select: {
            id: true,
            title: true,
            completedAt: true,
          },
        },
      },
    });

    return submissions;
  }

  async findOne(id: string, userId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
            sellerType: true,
          },
        },
        product: true,
        shipment: {
          include: {
            fulfillmentCenter: true,
          },
        },
        catalogEntry: true,
        marketingMaterials: true,
        duplicateProducts: {
          include: {
            existingProduct: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check permissions - seller can only view their own submissions
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller || submission.sellerId !== seller.id) {
      throw new ForbiddenException('You do not have permission to view this submission');
    }

    return submission;
  }

  async update(id: string, userId: string, updateSubmissionDto: UpdateSubmissionDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check permissions
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller || submission.sellerId !== seller.id) {
      throw new ForbiddenException('You do not have permission to update this submission');
    }

    // Only allow updates if status is SUBMITTED or UNDER_REVIEW
    if (
      submission.status !== 'SUBMITTED' &&
      submission.status !== 'UNDER_REVIEW' &&
      submission.status !== 'PROCUREMENT_REJECTED'
    ) {
      throw new BadRequestException('Submission cannot be updated in its current status');
    }

    // Prepare update data
    const updateData: any = {};

    if (updateSubmissionDto.procurementNotes !== undefined) {
      updateData.procurementNotes = updateSubmissionDto.procurementNotes;
    }

    if (updateSubmissionDto.catalogNotes !== undefined) {
      updateData.catalogNotes = updateSubmissionDto.catalogNotes;
    }

    if (updateSubmissionDto.marketingNotes !== undefined) {
      updateData.marketingNotes = updateSubmissionDto.marketingNotes;
    }

    if (updateSubmissionDto.financeNotes !== undefined) {
      updateData.financeNotes = updateSubmissionDto.financeNotes;
    }

    if (updateSubmissionDto.selectedQuantity !== undefined) {
      updateData.selectedQuantity = updateSubmissionDto.selectedQuantity;
    }

    if (updateSubmissionDto.productData) {
      updateData.productData = updateSubmissionDto.productData;
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id },
      data: updateData,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            sellerType: true,
          },
        },
      },
    });

    return updated;
  }

  async delete(id: string, userId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check permissions
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller || submission.sellerId !== seller.id) {
      throw new ForbiddenException('You do not have permission to delete this submission');
    }

    // Only allow deletion if status is SUBMITTED or REJECTED
    if (submission.status !== 'SUBMITTED' && submission.status !== 'REJECTED') {
      throw new BadRequestException('Submission cannot be deleted in its current status');
    }

    await this.prisma.productSubmission.delete({
      where: { id },
    });

    return { message: 'Submission deleted successfully' };
  }

  async resubmit(id: string, userId: string, updateData?: { productData?: any; notes?: string }) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check permissions
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller || submission.sellerId !== seller.id) {
      throw new ForbiddenException('You do not have permission to resubmit this submission');
    }

    // Only allow resubmission if rejected
    if (submission.status !== 'PROCUREMENT_REJECTED' && submission.status !== 'REJECTED') {
      throw new BadRequestException('Only rejected submissions can be resubmitted');
    }

    const data: any = {
      status: 'SUBMITTED' as ProductSubmissionStatus,
      procurementNotes: null,
      catalogNotes: null,
      marketingNotes: null,
      financeNotes: null,
      procurementApprovedAt: null,
      catalogCompletedAt: null,
      marketingCompletedAt: null,
      financeApprovedAt: null,
    };

    // Allow updating product data on resubmission
    if (updateData?.productData) {
      data.productData = updateData.productData;
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id },
      data,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            sellerType: true,
          },
        },
      },
    });

    // Re-run duplicate detection on resubmission
    await this.duplicatesService.detectDuplicates(updated.id);

    // Send SUBMISSION_RESUBMITTED notification to procurement team
    try {
      const procurementTeam = await this.prisma.user.findMany({
        where: {
          role: { in: ['PROCUREMENT', 'ADMIN'] },
        },
        select: { id: true, email: true },
      });

      if (procurementTeam.length > 0) {
        await this.prisma.notification.createMany({
          data: procurementTeam.map((user) => ({
            userId: user.id,
            type: 'SUBMISSION_RESUBMITTED' as any,
            subject: 'Product Resubmitted for Review',
            content: `Submission from ${updated.seller?.storeName || 'Unknown Seller'} has been resubmitted and is ready for review.`,
            metadata: {
              submissionId: updated.id,
              sellerId: updated.sellerId,
            } as any,
          })),
        });
      }
    } catch {
      // Non-critical: notification delivery failure should not block submission
    }

    return updated;
  }

  async checkDuplicates(
    userId: string,
    query: { name?: string; sku?: string; barcode?: string; ean?: string },
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    const results: {
      catalogueMatches: any[];
      sellerPendingMatches: any[];
      sellerActiveMatches: any[];
    } = {
      catalogueMatches: [],
      sellerPendingMatches: [],
      sellerActiveMatches: [],
    };

    const existingProducts = await this.prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'DRAFT'] } },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        ean: true,
        slug: true,
        price: true,
        status: true,
        sellerId: true,
      },
      take: 500,
    });

    for (const product of existingProducts) {
      let score = 0;
      const reasons: string[] = [];

      if (query.sku && product.sku && query.sku.trim() === product.sku.trim()) {
        score = 100;
        reasons.push('Exact SKU match');
      } else if (
        query.barcode &&
        product.barcode &&
        query.barcode.trim() === product.barcode.trim()
      ) {
        score = 100;
        reasons.push('Exact barcode match');
      } else if (query.ean && product.ean && query.ean.trim() === product.ean.trim()) {
        score = 100;
        reasons.push('Exact EAN match');
      } else if (query.name && product.name) {
        const sim = this.duplicatesService['calculateStringSimilarity'](
          query.name.toLowerCase(),
          product.name.toLowerCase(),
        );
        if (sim >= 80) {
          score = sim;
          reasons.push(`Name similarity: ${sim.toFixed(1)}%`);
        }
      }

      if (score >= 80) {
        const isSameSeller = product.sellerId === seller.id;
        const entry = { ...product, similarityScore: score, reasons };
        if (isSameSeller) {
          results.sellerActiveMatches.push(entry);
        } else {
          results.catalogueMatches.push(entry);
        }
      }
    }

    const pendingSubmissions = await this.prisma.productSubmission.findMany({
      where: {
        sellerId: seller.id,
        status: {
          in: [
            'SUBMITTED',
            'UNDER_REVIEW',
            'PROCUREMENT_APPROVED',
            'CATALOG_COMPLETED',
            'MARKETING_COMPLETED',
            'CONTENT_COMPLETED' as any,
            'FINANCE_APPROVED',
          ],
        },
      },
      select: { id: true, productData: true, status: true, createdAt: true },
      take: 100,
    });

    for (const sub of pendingSubmissions) {
      const pd = sub.productData as any;
      let score = 0;
      const reasons: string[] = [];

      if (query.sku && pd?.sku && query.sku.trim() === pd.sku.trim()) {
        score = 100;
        reasons.push('Exact SKU match');
      } else if (query.barcode && pd?.barcode && query.barcode.trim() === pd.barcode.trim()) {
        score = 100;
        reasons.push('Exact barcode match');
      } else if (query.ean && pd?.ean && query.ean.trim() === pd.ean.trim()) {
        score = 100;
        reasons.push('Exact EAN match');
      } else if (query.name && pd?.name) {
        const sim = this.duplicatesService['calculateStringSimilarity'](
          query.name.toLowerCase(),
          pd.name.toLowerCase(),
        );
        if (sim >= 80) {
          score = sim;
          reasons.push(`Name similarity: ${sim.toFixed(1)}%`);
        }
      }

      if (score >= 80) {
        results.sellerPendingMatches.push({
          id: sub.id,
          name: pd?.name,
          sku: pd?.sku,
          status: sub.status,
          createdAt: sub.createdAt,
          similarityScore: score,
          reasons,
        });
      }
    }

    results.catalogueMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    results.sellerActiveMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    results.sellerPendingMatches.sort((a, b) => b.similarityScore - a.similarityScore);

    return results;
  }

  async browseCatalogForVendor(
    userId: string,
    opts: { fandom?: string; search?: string; page: number; limit: number },
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });

    // Use MeiliSearch for fast, typo-tolerant search across thousands of products.
    // Passes includeInactive so both ACTIVE and DRAFT products appear in the catalog.
    const meiliResult = await this.meilisearchService.search(opts.search || '', {
      fandom: opts.fandom,
      page: opts.page,
      limit: opts.limit,
      includeInactive: true,
    });

    const hitIds = meiliResult.hits.map((h: any) => h.id);

    // Enrich MeiliSearch results with vendor product info from the database
    const vendorProductMap = new Map<string, any>();
    const vendorCountMap = new Map<string, number>();

    if (hitIds.length > 0) {
      const [vendorProducts, vendorCounts] = await Promise.all([
        seller
          ? this.prisma.vendorProduct.findMany({
              where: { sellerId: seller.id, productId: { in: hitIds } },
              select: {
                productId: true,
                id: true,
                vendorPrice: true,
                vendorStock: true,
                status: true,
              },
            })
          : Promise.resolve([]),
        this.prisma.vendorProduct.groupBy({
          by: ['productId'],
          where: { productId: { in: hitIds } },
          _count: true,
        }),
      ]);

      for (const vp of vendorProducts) {
        vendorProductMap.set(vp.productId, vp);
      }
      for (const vc of vendorCounts) {
        vendorCountMap.set(vc.productId, vc._count);
      }
    }

    // Extract fandom facets from MeiliSearch facet distribution
    const fandomFacets = meiliResult.facetDistribution?.fandom || {};
    const fandoms = Object.entries(fandomFacets)
      .filter(([name]) => name && name !== 'null')
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    // If MeiliSearch had no fandom facets (empty index or unavailable), fall back to DB
    if (fandoms.length === 0) {
      const dbFandoms = await this.prisma.product.groupBy({
        by: ['fandom'],
        where: { status: { in: ['ACTIVE', 'DRAFT'] }, fandom: { not: null } },
        _count: true,
        orderBy: { _count: { fandom: 'desc' } },
        take: 50,
      });
      for (const f of dbFandoms) {
        if (f.fandom) fandoms.push({ name: f.fandom, count: f._count });
      }
    }

    return {
      products: meiliResult.hits.map((hit: any) => {
        const myListing = vendorProductMap.get(hit.id) || null;
        return {
          id: hit.id,
          name: hit.name,
          slug: hit.slug,
          sku: hit.sku || null,
          price: hit.price,
          currency: hit.currency || 'USD',
          stock: hit.stock,
          fandom: hit.fandom,
          status: hit.isActive ? 'ACTIVE' : 'DRAFT',
          imageUrl: hit.images?.[0]?.url || null,
          vendorCount: vendorCountMap.get(hit.id) || 0,
          alreadyListed: myListing !== null,
          myListing: myListing
            ? {
                id: myListing.id,
                vendorPrice: myListing.vendorPrice,
                vendorStock: myListing.vendorStock,
                status: myListing.status,
              }
            : null,
        };
      }),
      pagination: { page: opts.page, limit: opts.limit, total: meiliResult.total },
      fandoms,
      searchMeta: {
        processingTimeMs: meiliResult.processingTimeMs,
        query: meiliResult.query,
        engine: this.meilisearchService.isAvailable() ? 'meilisearch' : 'prisma-fallback',
      },
    };
  }

  async bulkCreate(userId: string, submissions: CreateSubmissionDto[]) {
    if (!submissions || submissions.length === 0) {
      throw new BadRequestException('At least one submission is required');
    }
    if (submissions.length > 50) {
      throw new BadRequestException('Bulk submissions are limited to 50 items per batch');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    // Validate each submission has required fields and check for duplicates within the batch
    const seenNames = new Set<string>();
    for (const dto of submissions) {
      if (!dto.name?.trim()) {
        throw new BadRequestException('Each submission must include a product name');
      }
      if (dto.price == null || typeof dto.price !== 'number' || dto.price <= 0) {
        throw new BadRequestException(`Invalid price for product "${dto.name}"`);
      }
      const normalizedName = dto.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        throw new BadRequestException(`Duplicate product name in batch: "${dto.name}"`);
      }
      seenNames.add(normalizedName);
    }

    // Check for existing pending submissions by this seller with the same product names
    const pendingSubmissions = await this.prisma.productSubmission.findMany({
      where: {
        sellerId: seller.id,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      },
      select: { productData: true },
    });
    const existingNames = new Set(
      pendingSubmissions.map((s) => {
        const pd = s.productData as { name?: string };
        return (pd?.name ?? '').trim().toLowerCase();
      }),
    );
    for (const dto of submissions) {
      if (existingNames.has(dto.name.trim().toLowerCase())) {
        throw new BadRequestException(
          `A pending submission already exists for product "${dto.name}"`,
        );
      }
    }

    const createdSubmissions = [];

    for (const submissionDto of submissions) {
      const productData = {
        name: submissionDto.name,
        description: submissionDto.description,
        sku: submissionDto.sku,
        barcode: submissionDto.barcode,
        ean: submissionDto.ean,
        price: submissionDto.price,
        tradePrice: submissionDto.tradePrice,
        rrp: submissionDto.rrp,
        currency: submissionDto.currency || 'USD',
        taxRate: submissionDto.taxRate || 0,
        stock: submissionDto.stock,
        quantity: submissionDto.quantity,
        fandom: submissionDto.fandom,
        category: submissionDto.category, // Legacy field - kept for backward compatibility
        categoryId: submissionDto.categoryId, // New taxonomy category ID
        tags: submissionDto.tags || [],
        images: submissionDto.images,
        variations: submissionDto.variations || [],
      };

      const submission = await this.prisma.productSubmission.create({
        data: {
          sellerId: seller.id,
          productData: productData as any,
          status: 'SUBMITTED',
        },
      });

      createdSubmissions.push(submission);
    }

    return {
      count: createdSubmissions.length,
      submissions: createdSubmissions,
    };
  }
}

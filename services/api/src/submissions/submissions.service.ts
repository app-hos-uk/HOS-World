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

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private duplicatesService: DuplicatesService,
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

    // Prepare product data as JSON
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
      currency: createSubmissionDto.currency || 'GBP',
      taxRate: createSubmissionDto.taxRate || 0,
      stock: createSubmissionDto.stock,
      quantity: createSubmissionDto.quantity, // For wholesalers
      fandom: createSubmissionDto.fandom,
      category: createSubmissionDto.category, // Legacy field - kept for backward compatibility
      categoryId: createSubmissionDto.categoryId, // New taxonomy category ID
      tags: createSubmissionDto.tags || [],
      images: createSubmissionDto.images,
      variations: createSubmissionDto.variations || [],
    };

    // Create submission
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

    if (updateSubmissionDto.status) {
      updateData.status = updateSubmissionDto.status;
    }

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
    if (
      submission.status !== 'PROCUREMENT_REJECTED' &&
      submission.status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        'Only rejected submissions can be resubmitted',
      );
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
    } catch (error) {
      console.error('Failed to send resubmission notification:', error);
    }

    return updated;
  }

  async checkDuplicates(userId: string, query: { name?: string; sku?: string; barcode?: string; ean?: string }) {
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
      select: { id: true, name: true, sku: true, barcode: true, ean: true, slug: true, price: true, status: true, sellerId: true },
      take: 500,
    });

    for (const product of existingProducts) {
      let score = 0;
      const reasons: string[] = [];

      if (query.sku && product.sku && query.sku.trim() === product.sku.trim()) {
        score = 100;
        reasons.push('Exact SKU match');
      } else if (query.barcode && product.barcode && query.barcode.trim() === product.barcode.trim()) {
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
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'PROCUREMENT_APPROVED', 'CATALOG_COMPLETED', 'MARKETING_COMPLETED', 'FINANCE_APPROVED'] },
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

  async bulkCreate(userId: string, submissions: CreateSubmissionDto[]) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
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
        currency: submissionDto.currency || 'GBP',
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

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

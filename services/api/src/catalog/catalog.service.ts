import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCatalogEntryDto, UpdateCatalogEntryDto } from './dto/create-catalog-entry.dto';
import { ProductSubmissionStatus } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findPending() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: 'PROCUREMENT_APPROVED',
        catalogEntry: null, // Not yet cataloged
      },
      take: 100,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        shipment: {
          select: {
            id: true,
            status: true,
            receivedAt: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { procurementApprovedAt: 'asc' },
    });

    return submissions;
  }

  async create(submissionId: string, userId: string, createDto: CreateCatalogEntryDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'PROCUREMENT_APPROVED') {
      throw new BadRequestException(
        'Catalog entry can only be created for procurement-approved submissions',
      );
    }

    // Check if catalog entry already exists
    const existing = await this.prisma.catalogEntry.findUnique({
      where: { submissionId },
    });

    if (existing) {
      throw new BadRequestException('Catalog entry already exists for this submission');
    }

    const now = new Date();
    const catalogEntry = await this.prisma.catalogEntry.create({
      data: {
        submissionId,
        title: createDto.title,
        description: createDto.description,
        keywords: createDto.keywords,
        specs: createDto.specs as any,
        images: createDto.images,
        completedBy: userId,
        completedAt: now,
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    // Create marketing materials inline if provided (merged pipeline)
    if (createDto.marketingMaterials && createDto.marketingMaterials.length > 0) {
      await this.prisma.marketingMaterial.createMany({
        data: createDto.marketingMaterials.map((m) => ({
          submissionId,
          type: m.type as any,
          url: m.url,
          createdBy: userId,
        })),
      });
    }

    // Determine target status: CONTENT_COMPLETED (merged) when materials provided, else CATALOG_COMPLETED
    const hasMarketingMaterials = (createDto.marketingMaterials?.length ?? 0) > 0;

    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'CONTENT_COMPLETED' as any,
        catalogCompletedAt: now,
        marketingCompletedAt: hasMarketingMaterials ? now : null,
      },
    });

    // Notify finance team that content is ready for pricing review
    try {
      await this.notificationsService.sendNotificationToRole(
        'FINANCE',
        'CONTENT_COMPLETED' as any,
        'Product Content Completed',
        `Product submission has been cataloged${hasMarketingMaterials ? ' with marketing materials' : ''} and is ready for finance/pricing review.`,
        { submissionId, catalogEntryId: catalogEntry.id },
      );
    } catch (error) {
      console.error('Failed to send notification to finance team:', error);
    }

    return catalogEntry;
  }

  async update(submissionId: string, userId: string, updateDto: UpdateCatalogEntryDto) {
    const catalogEntry = await this.prisma.catalogEntry.findUnique({
      where: { submissionId },
    });

    if (!catalogEntry) {
      throw new NotFoundException('Catalog entry not found');
    }

    const updated = await this.prisma.catalogEntry.update({
      where: { submissionId },
      data: {
        ...(updateDto.title && { title: updateDto.title }),
        ...(updateDto.description && { description: updateDto.description }),
        ...(updateDto.keywords && { keywords: updateDto.keywords }),
        ...(updateDto.specs && { specs: updateDto.specs as any }),
        ...(updateDto.images && { images: updateDto.images }),
        completedBy: userId,
        completedAt: new Date(),
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  async findOne(submissionId: string) {
    // First try to find an existing catalog entry
    const catalogEntry = await this.prisma.catalogEntry.findUnique({
      where: { submissionId },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (catalogEntry) {
      return catalogEntry;
    }

    // If no catalog entry exists yet, return the submission data directly
    // This supports the "Create Entry" flow where the catalog team needs
    // to view submission details before creating the entry
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        shipment: {
          select: {
            id: true,
            status: true,
            receivedAt: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  async findAll(status?: 'pending' | 'in_progress' | 'completed') {
    const where: any = {};

    // 'in_progress' is an alias for 'pending': entries that exist but are not yet completed
    if (status === 'pending' || status === 'in_progress') {
      where.completedAt = null;
    } else if (status === 'completed') {
      where.completedAt = { not: null };
    }

    const entries = await this.prisma.catalogEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return entries;
  }

  async markComplete(submissionId: string, userId: string) {
    const catalogEntry = await this.prisma.catalogEntry.findUnique({
      where: { submissionId },
    });

    if (!catalogEntry) {
      throw new NotFoundException('Catalog entry not found');
    }

    const updated = await this.prisma.catalogEntry.update({
      where: { submissionId },
      data: {
        completedBy: userId,
        completedAt: new Date(),
      },
    });

    const submission = await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'CONTENT_COMPLETED' as any,
        catalogCompletedAt: new Date(),
        marketingCompletedAt: new Date(),
      },
      include: {
        seller: {
          select: {
            storeName: true,
          },
        },
      },
    });

    await this.notificationsService.sendNotificationToRole(
      'FINANCE',
      'CONTENT_COMPLETED' as any,
      'Product Content Completed',
      `Content has been completed for submission from ${submission.seller?.storeName || 'Unknown Seller'}. The product is ready for finance/pricing review.`,
      { submissionId, catalogEntryId: updated.id },
    );

    return updated;
  }

  async getDashboardStats() {
    const [pending, completed, total] = await Promise.all([
      this.prisma.productSubmission.count({
        where: {
          status: 'PROCUREMENT_APPROVED',
          catalogEntry: null,
        },
      }),
      this.prisma.catalogEntry.count({
        where: {
          completedAt: { not: null },
        },
      }),
      this.prisma.catalogEntry.count(),
    ]);

    return {
      pending,
      completed,
      total,
    };
  }
}

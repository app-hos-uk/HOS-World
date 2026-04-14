import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/create-material.dto';
import { MaterialType, ProductSubmissionStatus } from '@prisma/client';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findPending() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: { in: ['CATALOG_COMPLETED'] },
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
        catalogEntry: {
          select: {
            id: true,
            title: true,
            images: true,
          },
        },
        marketingMaterials: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { catalogCompletedAt: 'asc' },
    });

    return submissions;
  }

  async createMaterial(userId: string, createDto: CreateMaterialDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: createDto.submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const allowedStatuses = ['CATALOG_COMPLETED', 'MARKETING_COMPLETED', 'CONTENT_COMPLETED'];
    if (!allowedStatuses.includes(submission.status)) {
      throw new BadRequestException(
        'Marketing materials can only be added to content-completed or catalog-completed submissions',
      );
    }

    const material = await this.prisma.marketingMaterial.create({
      data: {
        submissionId: createDto.submissionId,
        type: createDto.type,
        url: createDto.url,
        createdBy: userId,
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

    return material;
  }

  async findAllMaterials(submissionId?: string, type?: MaterialType) {
    const where: any = {};

    if (submissionId) {
      where.submissionId = submissionId;
    }

    if (type) {
      where.type = type;
    }

    const materials = await this.prisma.marketingMaterial.findMany({
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

    return materials;
  }

  async findOneMaterial(id: string) {
    const material = await this.prisma.marketingMaterial.findUnique({
      where: { id },
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
            catalogEntry: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException('Marketing material not found');
    }

    return material;
  }

  async updateMaterial(id: string, updateDto: UpdateMaterialDto) {
    const material = await this.prisma.marketingMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException('Marketing material not found');
    }

    const updated = await this.prisma.marketingMaterial.update({
      where: { id },
      data: updateDto,
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

  async deleteMaterial(id: string) {
    const material = await this.prisma.marketingMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException('Marketing material not found');
    }

    await this.prisma.marketingMaterial.delete({
      where: { id },
    });

    return { message: 'Marketing material deleted successfully' };
  }

  async reopenMarketing(submissionId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const st = submission.status as string;
    if (st !== 'MARKETING_COMPLETED' && st !== 'CONTENT_COMPLETED') {
      throw new BadRequestException('Only content-completed submissions can be reopened');
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'CATALOG_COMPLETED' as any,
        marketingCompletedAt: null,
        marketingNotes:
          `${submission.marketingNotes || ''}\n\nReopened for additional materials at ${new Date().toISOString()}`.trim(),
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        marketingMaterials: true,
      },
    });

    return updated;
  }

  async markComplete(submissionId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
      include: {
        marketingMaterials: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Idempotent: if already completed, return success
    const status = submission.status as string;
    if (status === 'MARKETING_COMPLETED' || status === 'CONTENT_COMPLETED') {
      return this.prisma.productSubmission.findUniqueOrThrow({
        where: { id: submissionId },
        include: {
          seller: { select: { id: true, storeName: true, slug: true } },
          marketingMaterials: true,
        },
      });
    }

    if (submission.status !== 'CATALOG_COMPLETED') {
      throw new BadRequestException(
        `Marketing can only be completed for catalog-completed submissions (current status: ${submission.status})`,
      );
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'CONTENT_COMPLETED' as any,
        marketingCompletedAt: new Date(),
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        marketingMaterials: true,
      },
    });

    try {
      await this.notificationsService.sendNotificationToRole(
        'FINANCE',
        'CONTENT_COMPLETED',
        'Product Content Completed',
        `Content has been completed for submission from ${updated.seller?.storeName || 'Unknown Seller'}. The product is ready for finance review.`,
        { submissionId },
      );
    } catch (notifyErr) {
      this.logger.warn(`Post-complete notification failed for submission ${submissionId}: ${notifyErr}`);
    }

    return updated;
  }

  async getDashboardStats() {
    const [pending, completed, totalMaterials] = await Promise.all([
      this.prisma.productSubmission.count({
        where: {
          status: { in: ['CATALOG_COMPLETED'] },
        },
      }),
      this.prisma.productSubmission.count({
        where: {
          status: { in: ['MARKETING_COMPLETED', 'CONTENT_COMPLETED' as any] },
        },
      }),
      this.prisma.marketingMaterial.count(),
    ]);

    return {
      pending,
      completed,
      totalMaterials,
    };
  }
}

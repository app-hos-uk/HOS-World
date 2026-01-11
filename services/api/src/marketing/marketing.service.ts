import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/create-material.dto';
import { MaterialType, ProductSubmissionStatus } from '@prisma/client';

@Injectable()
export class MarketingService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findPending() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: 'CATALOG_COMPLETED',
      },
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

    if (submission.status !== 'CATALOG_COMPLETED') {
      throw new BadRequestException(
        'Marketing materials can only be added to catalog-completed submissions',
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

    if (submission.status !== 'CATALOG_COMPLETED') {
      throw new BadRequestException(
        'Marketing can only be completed for catalog-completed submissions',
      );
    }

    if (submission.marketingMaterials.length === 0) {
      throw new BadRequestException(
        'At least one marketing material is required before marking as complete',
      );
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'MARKETING_COMPLETED',
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

    // Send notification to finance team
    await this.notificationsService.sendNotificationToRole(
      'FINANCE',
      'ORDER_CONFIRMATION', // Using existing type as placeholder
      'Marketing Materials Completed',
      `Marketing materials have been completed for submission from ${updated.seller?.storeName || 'Unknown Seller'}. The product is ready for finance review.`,
      { submissionId },
    );

    return updated;
  }

  async getDashboardStats() {
    const [
      pending,
      completed,
      totalMaterials,
    ] = await Promise.all([
      this.prisma.productSubmission.count({
        where: {
          status: 'CATALOG_COMPLETED',
        },
      }),
      this.prisma.productSubmission.count({
        where: {
          status: 'MARKETING_COMPLETED',
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


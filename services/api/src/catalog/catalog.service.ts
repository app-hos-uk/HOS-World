import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateCatalogEntryDto,
  UpdateCatalogEntryDto,
} from './dto/create-catalog-entry.dto';
import { ProductSubmissionStatus } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async findPending() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: 'FC_ACCEPTED',
        catalogEntry: null, // Not yet cataloged
      },
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
      orderBy: { fcAcceptedAt: 'asc' },
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

    if (submission.status !== 'FC_ACCEPTED') {
      throw new BadRequestException(
        'Catalog entry can only be created for FC-accepted submissions',
      );
    }

    // Check if catalog entry already exists
    const existing = await this.prisma.catalogEntry.findUnique({
      where: { submissionId },
    });

    if (existing) {
      throw new BadRequestException('Catalog entry already exists for this submission');
    }

    const catalogEntry = await this.prisma.catalogEntry.create({
      data: {
        submissionId,
        title: createDto.title,
        description: createDto.description,
        keywords: createDto.keywords,
        specs: createDto.specs as any,
        images: createDto.images,
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

    // Update submission status
    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'CATALOG_COMPLETED',
        catalogCompletedAt: new Date(),
      },
    });

    // TODO: Send notification to marketing team

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
            productData: true,
          },
        },
      },
    });

    if (!catalogEntry) {
      throw new NotFoundException('Catalog entry not found');
    }

    return catalogEntry;
  }

  async findAll(status?: 'pending' | 'completed') {
    const where: any = {};

    if (status === 'pending') {
      where.completedAt = null;
    } else if (status === 'completed') {
      where.completedAt = { not: null };
    }

    const entries = await this.prisma.catalogEntry.findMany({
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

    // Update submission status
    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'CATALOG_COMPLETED',
        catalogCompletedAt: new Date(),
      },
    });

    // TODO: Send notification to marketing team

    return updated;
  }

  async getDashboardStats() {
    const [
      pending,
      completed,
      total,
    ] = await Promise.all([
      this.prisma.productSubmission.count({
        where: {
          status: 'FC_ACCEPTED',
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


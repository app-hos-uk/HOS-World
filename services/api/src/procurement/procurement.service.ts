import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ApproveSubmissionDto,
  RejectSubmissionDto,
  SelectQuantityDto,
} from './dto/approve-submission.dto';
import { ProductSubmissionStatus } from '@prisma/client';
import { DuplicatesService } from '../duplicates/duplicates.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProcurementService {
  constructor(
    private prisma: PrismaService,
    private duplicatesService: DuplicatesService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(status?: ProductSubmissionStatus | string, skip = 0, take = 100) {
    const where: any = {};

    // Only filter by status when explicitly provided (for procurement review queue).
    // When no status is passed (e.g. admin overview), return ALL submissions.
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const submissions = await this.prisma.productSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
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
        catalogEntry: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        duplicateProducts: {
          include: {
            existingProduct: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                barcode: true,
                ean: true,
                price: true,
                currency: true,
                status: true,
                description: true,
                category: true,
                stock: true,
                images: { select: { url: true, alt: true }, orderBy: { order: 'asc' }, take: 4 },
              },
            },
          },
          orderBy: {
            similarityScore: 'desc',
          },
        },
      },
    });

    return submissions;
  }

  async findOne(id: string) {
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
            country: true,
            city: true,
          },
        },
        duplicateProducts: {
          include: {
            existingProduct: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                barcode: true,
                ean: true,
                price: true,
                currency: true,
                status: true,
                description: true,
                category: true,
                stock: true,
                images: { select: { url: true, alt: true }, orderBy: { order: 'asc' }, take: 4 },
              },
            },
          },
          orderBy: {
            similarityScore: 'desc',
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  async approve(id: string, userId: string, approveDto: ApproveSubmissionDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'SUBMITTED' && submission.status !== 'UNDER_REVIEW') {
      throw new BadRequestException(`Cannot approve submission in status: ${submission.status}`);
    }

    const duplicates = await this.duplicatesService.getDuplicatesForSubmission(id);
    if (duplicates.length > 0 && duplicates[0].similarityScore >= 90) {
      if (!approveDto.acknowledgeDuplicates) {
        throw new BadRequestException(
          'High similarity duplicate detected. To proceed, acknowledge the duplicates and provide a reason.',
        );
      }
      if (!approveDto.duplicateAcknowledgementNote?.trim()) {
        throw new BadRequestException(
          'A note explaining why this duplicate should be approved is required.',
        );
      }
    }

    const noteParts: string[] = [];
    if (approveDto.notes) noteParts.push(approveDto.notes);
    if (approveDto.duplicateAcknowledgementNote?.trim()) {
      noteParts.push(`[Duplicate acknowledged] ${approveDto.duplicateAcknowledgementNote.trim()}`);
    }

    const updateData: any = {
      status: 'PROCUREMENT_APPROVED',
      procurementApprovedAt: new Date(),
    };

    if (approveDto.selectedQuantity) {
      updateData.selectedQuantity = approveDto.selectedQuantity;
    }

    if (noteParts.length > 0) {
      updateData.procurementNotes = noteParts.join('\n\n');
    }

    // Atomic status check prevents race conditions
    const updated = await this.prisma.productSubmission.update({
      where: { id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      data: updateData,
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    // Send notification to seller about approval
    if (updated.seller?.userId) {
      await this.notificationsService.sendNotificationToUser(
        updated.seller.userId,
        'SUBMISSION_APPROVED',
        'Product Submission Approved',
        `Your product submission has been approved by Procurement and is moving to the next stage.`,
        { submissionId: id },
      );
    }

    return updated;
  }

  async reject(id: string, userId: string, rejectDto: RejectSubmissionDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'SUBMITTED' && submission.status !== 'UNDER_REVIEW') {
      throw new BadRequestException(`Cannot reject submission in status: ${submission.status}`);
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      data: {
        status: 'PROCUREMENT_REJECTED',
        procurementNotes: rejectDto.reason + (rejectDto.notes ? `\n\n${rejectDto.notes}` : ''),
      },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    // Send notification to seller about rejection
    if (updated.seller?.userId) {
      await this.notificationsService.sendNotificationToUser(
        updated.seller.userId,
        'SUBMISSION_REJECTED',
        'Product Submission Rejected',
        `Your product submission has been rejected by Procurement. Reason: ${rejectDto.reason}${rejectDto.notes ? `\n\nNotes: ${rejectDto.notes}` : ''}`,
        { submissionId: id },
      );
    }

    return updated;
  }

  async selectQuantity(id: string, userId: string, selectQuantityDto: SelectQuantityDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (selectQuantityDto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id },
      data: {
        selectedQuantity: selectQuantityDto.quantity,
        procurementNotes: selectQuantityDto.notes
          ? `${submission.procurementNotes || ''}\n\nQuantity selected: ${selectQuantityDto.quantity}. ${selectQuantityDto.notes}`
          : `${submission.procurementNotes || ''}\n\nQuantity selected: ${selectQuantityDto.quantity}`,
      },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    return updated;
  }

  async updateQuantity(id: string, userId: string, selectQuantityDto: SelectQuantityDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Allow quantity update at any stage before publishing
    const nonEditableStatuses: ProductSubmissionStatus[] = ['PUBLISHED', 'REJECTED', 'PROCUREMENT_REJECTED'];
    if (nonEditableStatuses.includes(submission.status)) {
      throw new BadRequestException(
        `Cannot update quantity for submission in status: ${submission.status}`,
      );
    }

    if (selectQuantityDto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id },
      data: {
        selectedQuantity: selectQuantityDto.quantity,
        procurementNotes: selectQuantityDto.notes
          ? `${submission.procurementNotes || ''}\n\nQuantity updated to: ${selectQuantityDto.quantity}. ${selectQuantityDto.notes}`
          : `${submission.procurementNotes || ''}\n\nQuantity updated to: ${selectQuantityDto.quantity}`,
      },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    return updated;
  }

  async getDuplicates() {
    return this.duplicatesService.getSubmissionsWithDuplicates();
  }

  async getDashboardStats() {
    const [totalSubmissions, pendingReview, approved, rejected, withDuplicates] = await Promise.all(
      [
        this.prisma.productSubmission.count(),
        this.prisma.productSubmission.count({
          where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        }),
        this.prisma.productSubmission.count({
          where: { status: 'PROCUREMENT_APPROVED' },
        }),
        this.prisma.productSubmission.count({
          where: { status: 'PROCUREMENT_REJECTED' },
        }),
        this.prisma.duplicateProduct.count({
          where: {
            submission: {
              status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
            },
          },
        }),
      ],
    );

    return {
      totalSubmissions,
      pendingReview,
      approved,
      rejected,
      withDuplicates,
    };
  }
}

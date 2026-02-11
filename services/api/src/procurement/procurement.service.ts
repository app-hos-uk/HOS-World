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

  async findAll(status?: ProductSubmissionStatus) {
    const where: any = {};

    if (status) {
      where.status = status;
    } else {
      // Default: show submitted and under review
      where.status = {
        in: ['SUBMITTED', 'UNDER_REVIEW'],
      };
    }

    const submissions = await this.prisma.productSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
        duplicateProducts: {
          include: {
            existingProduct: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                price: true,
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
                status: true,
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

    // Check for duplicates before approving
    const duplicates = await this.duplicatesService.getDuplicatesForSubmission(id);
    if (duplicates.length > 0 && duplicates[0].similarityScore >= 90) {
      throw new BadRequestException(
        'Cannot approve: High similarity duplicate detected. Please review duplicates first.',
      );
    }

    const updateData: any = {
      status: 'PROCUREMENT_APPROVED',
      procurementApprovedAt: new Date(),
    };

    if (approveDto.selectedQuantity) {
      updateData.selectedQuantity = approveDto.selectedQuantity;
    }

    if (approveDto.notes) {
      updateData.procurementNotes = approveDto.notes;
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id },
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
      where: { id },
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

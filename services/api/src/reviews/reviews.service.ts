import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReviewStatus } from '@prisma/client';
import { LoyaltyListener } from '../loyalty/listeners/loyalty.listener';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  verified: boolean;
  helpful: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => LoyaltyListener))
    private loyaltyListener: LoyaltyListener,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private activityService: ActivityService,
  ) {}

  async create(
    userId: string,
    productId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<Review> {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await this.prisma.productReview.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    // Check if user purchased this product (for verified badge)
    const hasPurchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          paymentStatus: 'PAID',
        },
      },
    });

    const review = await this.prisma.productReview.create({
      data: {
        productId,
        userId,
        rating: createReviewDto.rating,
        title: createReviewDto.title,
        comment: createReviewDto.comment,
        images: createReviewDto.images ?? [],
        verified: !!hasPurchased,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Log activity
    this.activityService.createLog({
      userId,
      action: 'REVIEW_SUBMITTED',
      entityType: 'ProductReview',
      entityId: review.id,
      description: `Review submitted for product "${product.name}" (rating: ${createReviewDto.rating}/5)`,
      metadata: { productId, rating: createReviewDto.rating, verified: !!hasPurchased },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    // Notify admins about pending review for moderation
    this.notificationsService.sendNotificationToRole(
      'ADMIN',
      'GENERAL',
      'New Review Pending Moderation',
      `A new ${review.verified ? 'verified' : ''} review (${createReviewDto.rating}/5 stars) has been submitted for "${product.name}" and requires moderation.`,
      { reviewId: review.id, productId, productName: product.name },
    ).catch((e) => this.logger.warn(`Review moderation notification failed: ${(e as Error).message}`));

    return this.mapToReviewType(review);
  }

  async findAll(
    productId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where: {
          productId,
          status: 'APPROVED',
        },
        skip,
        take: limit,
        orderBy: [{ verified: 'desc' }, { helpful: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.productReview.count({
        where: {
          productId,
          status: 'APPROVED',
        },
      }),
    ]);

    return {
      reviews: reviews.map((r) => this.mapToReviewType(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.mapToReviewType(review);
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    const updated = await this.prisma.productReview.update({
      where: { id },
      data: updateReviewDto,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Update product rating if rating changed
    if (updateReviewDto.rating && updateReviewDto.rating !== review.rating) {
      await this.updateProductRating(review.productId);
    }

    return this.mapToReviewType(updated);
  }

  async delete(id: string, userId: string, role: string): Promise<void> {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Allow deletion if user owns review or is admin
    if (review.userId !== userId && role?.toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to delete this review');
    }

    const productId = review.productId;

    await this.prisma.productReview.delete({
      where: { id },
    });

    // Update product rating
    await this.updateProductRating(productId);
  }

  async markHelpful(id: string, helpful: boolean): Promise<Review> {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.prisma.productReview.update({
      where: { id },
      data: {
        helpful: helpful ? review.helpful + 1 : Math.max(0, review.helpful - 1),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return this.mapToReviewType(updated);
  }

  async getPendingReviews(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    reviews: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where: { status: 'PENDING' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
          product: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.productReview.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      reviews: reviews.map((r) => this.mapToAdminReviewType(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllReviewsForAdmin(
    filters?: { status?: string; page?: number; limit?: number },
  ): Promise<{
    reviews: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) {
      const normalizedStatus = filters.status.toUpperCase();
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
      if (!validStatuses.includes(normalizedStatus)) {
        throw new BadRequestException(
          `Invalid status filter. Allowed values: ${validStatuses.join(', ')}`,
        );
      }
      where.status = normalizedStatus;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
          product: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      reviews: reviews.map((r) => this.mapToAdminReviewType(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async moderateReview(
    reviewId: string,
    action: 'approve' | 'reject',
    moderatorId: string,
  ): Promise<Review> {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.status !== 'PENDING') {
      throw new BadRequestException(`Review has already been ${review.status.toLowerCase()}`);
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: { status: newStatus },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
    });

    // Update product rating if approved
    if (newStatus === 'APPROVED') {
      await this.updateProductRating(review.productId);

      // Award loyalty points for approved review
      this.loyaltyListener.onReviewSubmitted(review.userId, review.id).catch((e) => {
        this.logger.warn(`Loyalty review earn: ${(e as Error).message}`);
      });
    }

    // Log moderation activity
    this.activityService.createLog({
      userId: moderatorId,
      action: `REVIEW_${newStatus}`,
      entityType: 'ProductReview',
      entityId: reviewId,
      description: `Review for "${review.product.name}" was ${action === 'approve' ? 'approved' : 'rejected'} by moderator`,
      metadata: { productId: review.productId, reviewUserId: review.userId, action },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    // Notify the review author about the moderation decision
    const statusMessage = action === 'approve'
      ? `Your review for "${review.product.name}" has been approved and is now visible.`
      : `Your review for "${review.product.name}" was not approved. Please ensure your review follows our community guidelines.`;

    this.notificationsService.sendNotificationToUser(
      review.userId,
      'GENERAL',
      action === 'approve' ? 'Your Review Has Been Approved' : 'Review Update',
      statusMessage,
      { reviewId, productId: review.productId, action },
    ).catch((e) => this.logger.warn(`Review notification failed: ${(e as Error).message}`));

    return this.mapToReviewType(updated);
  }

  private async updateProductRating(productId: string): Promise<void> {
    const agg = await this.prisma.productReview.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        reviewCount: agg._count.rating,
      },
    });
  }

  private mapToAdminReviewType(review: any): any {
    return {
      ...this.mapToReviewType(review),
      user: review.user
        ? {
            id: review.user.id,
            email: review.user.email || undefined,
            firstName: review.user.firstName || undefined,
            lastName: review.user.lastName || undefined,
            avatar: review.user.avatar || undefined,
          }
        : undefined,
      product: review.product
        ? {
            id: review.product.id,
            name: review.product.name,
            slug: review.product.slug || undefined,
          }
        : undefined,
    };
  }

  private mapToReviewType(review: any): Review {
    return {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      title: review.title || undefined,
      comment: review.comment || undefined,
      images: Array.isArray(review.images) ? review.images : [],
      verified: review.verified,
      helpful: review.helpful,
      status: review.status.toLowerCase(),
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.user
        ? {
            id: review.user.id,
            firstName: review.user.firstName || undefined,
            lastName: review.user.lastName || undefined,
            avatar: review.user.avatar || undefined,
          }
        : undefined,
    };
  }
}

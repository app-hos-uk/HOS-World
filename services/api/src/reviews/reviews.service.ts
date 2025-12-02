import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
  verified: boolean;
  helpful: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    avatar?: string;
  };
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

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
        verified: !!hasPurchased,
        status: 'APPROVED', // Auto-approve, can be changed to moderation
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

    // Update product rating
    await this.updateProductRating(productId);

    return this.mapToReviewType(review);
  }

  async findAll(productId: string, page: number = 1, limit: number = 10): Promise<{
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
        orderBy: [
          { verified: 'desc' },
          { helpful: 'desc' },
          { createdAt: 'desc' },
        ],
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
    if (review.userId !== userId && role !== 'ADMIN') {
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

  private async updateProductRating(productId: string): Promise<void> {
    const reviews = await this.prisma.productReview.findMany({
      where: {
        productId,
        status: 'APPROVED',
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          averageRating: 0,
          reviewCount: 0,
        },
      });
      return;
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / reviews.length;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating,
        reviewCount: reviews.length,
      },
    });
  }

  private mapToReviewType(review: any): Review {
    return {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      title: review.title || undefined,
      comment: review.comment || undefined,
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
            email: review.user.email,
            avatar: review.user.avatar || undefined,
          }
        : undefined,
    };
  }
}



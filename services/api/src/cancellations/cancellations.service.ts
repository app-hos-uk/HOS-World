import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { RefundsService } from '../finance/refunds.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestCancellationDto } from './dto/request-cancellation.dto';
import { ReviewCancellationDto } from './dto/review-cancellation.dto';
import { SellerReviewCancellationDto } from './dto/seller-review-cancellation.dto';
import { EscalateCancellationDto } from './dto/escalate-cancellation.dto';
import {
  CancellationStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { canAccessAllOrders } from '../common/constants/order-access.constants';

const DEFAULT_AUTO_APPROVAL_WINDOW_MINUTES = 30;

const ACTIVE_CANCELLATION_STATUSES: CancellationStatus[] = [
  'PENDING_SELLER',
  'SELLER_APPROVED',
  'PENDING_FINANCE',
  'FINANCE_APPROVED',
  'ESCALATED',
];

const CUSTOMER_REQUESTABLE_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'CONFIRMED',
  'PROCESSING',
  'FULFILLED',
];

@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private refundsService: RefundsService,
    @Optional() private notificationsService?: NotificationsService,
  ) {}

  async getAutoApprovalWindowMinutes(): Promise<number> {
    try {
      const row = await this.prisma.config.findFirst({
        where: {
          level: 'PLATFORM',
          levelId: 'PLATFORM',
          key: 'cancellation_auto_approval_window_minutes',
        },
      });
      if (row?.value != null) {
        const minutes = Number(row.value);
        if (Number.isFinite(minutes) && minutes >= 0) {
          return minutes;
        }
      }
    } catch {
      // fall through
    }
    const envVal = process.env.CANCELLATION_AUTO_APPROVAL_WINDOW_MINUTES;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return DEFAULT_AUTO_APPROVAL_WINDOW_MINUTES;
  }

  async requestCancellation(userId: string, dto: RequestCancellationDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        seller: { select: { id: true, userId: true, storeName: true } },
        childOrders: {
          include: { seller: { select: { id: true, userId: true, storeName: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to cancel this order');
    }

    if (order.parentOrderId) {
      throw new BadRequestException(
        'You cannot cancel vendor sub-orders directly. Cancel the parent order instead.',
      );
    }

    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Unpaid orders should be cancelled directly via POST /orders/:id/cancel',
      );
    }

    if (order.status === 'CANCELLATION_REQUESTED') {
      throw new BadRequestException('A cancellation request is already pending for this order');
    }

    if (!CUSTOMER_REQUESTABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled in status ${order.status}. Allowed: ${CUSTOMER_REQUESTABLE_STATUSES.join(', ')}`,
      );
    }

    const existingActive = await this.prisma.cancellationRequest.findFirst({
      where: {
        orderId: order.id,
        status: { in: ACTIVE_CANCELLATION_STATUSES },
      },
    });
    if (existingActive) {
      throw new BadRequestException('A cancellation request is already pending for this order');
    }

    const windowMinutes = await this.getAutoApprovalWindowMinutes();
    const orderAgeMs = Date.now() - order.createdAt.getTime();
    const withinAutoWindow = windowMinutes > 0 && orderAgeMs <= windowMinutes * 60 * 1000;

    if (withinAutoWindow) {
      await this.ordersService.cancel(order.id, userId, 'CUSTOMER', {
        skipApproval: true,
        recordTransaction: true,
      });

      const request = await this.prisma.cancellationRequest.create({
        data: {
          orderId: order.id,
          requestedById: userId,
          reason: dto.reason,
          status: 'AUTO_APPROVED',
          previousStatus: order.status,
          autoApproved: true,
        },
        include: this.defaultInclude(),
      });

      await this.notifyCustomer(
        userId,
        'CANCELLATION_APPROVED',
        'Cancellation Approved',
        `Your cancellation for order ${order.orderNumber} was auto-approved. Your refund is being processed.`,
        { orderId: order.id, orderNumber: order.orderNumber, cancellationRequestId: request.id },
      );

      return request;
    }

    const hasChildSellers = (order.childOrders || []).some((child) => child.sellerId);
    const initialStatus: CancellationStatus =
      order.sellerId || hasChildSellers ? 'PENDING_SELLER' : 'PENDING_FINANCE';

    const request = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLATION_REQUESTED' },
      });

      return tx.cancellationRequest.create({
        data: {
          orderId: order.id,
          requestedById: userId,
          reason: dto.reason,
          status: initialStatus,
          previousStatus: order.status,
        },
        include: this.defaultInclude(),
      });
    });

    if (initialStatus === 'PENDING_SELLER') {
      await this.notifySellers(order, request);
    } else {
      await this.notifyFinanceTeam(order, request);
    }

    return request;
  }

  async sellerReview(requestId: string, userId: string, dto: SellerReviewCancellationDto) {
    const request = await this.findRequestOrThrow(requestId);
    if (request.status !== 'PENDING_SELLER') {
      throw new BadRequestException('Cancellation request is not awaiting seller review');
    }

    await this.assertSellerAccess(request.order, userId);

    if (!dto.approved) {
      const rejectionReason = dto.notes?.trim();
      if (!rejectionReason) {
        throw new BadRequestException('Rejection reason is required when rejecting a cancellation request');
      }
      return this.rejectRequest(request, {
        notes: rejectionReason,
        reviewerField: 'seller',
        reviewerId: userId,
      });
    }

    if (dto.approved) {
      const updated = await this.prisma.cancellationRequest.update({
        where: { id: requestId },
        data: {
          status: 'PENDING_FINANCE',
          sellerReviewedBy: { connect: { id: userId } },
          sellerReviewedAt: new Date(),
          sellerNotes: dto.notes,
        },
        include: this.defaultInclude(),
      });

      await this.notifyFinanceTeam(request.order, updated);
      await this.notifyCustomer(
        request.requestedById,
        'CANCELLATION_SELLER_APPROVED',
        'Cancellation Under Finance Review',
        `Your cancellation request for order ${request.order.orderNumber} was approved by the seller and is now awaiting finance review.`,
        {
          orderId: request.orderId,
          orderNumber: request.order.orderNumber,
          cancellationRequestId: requestId,
        },
      );

      return updated;
    }
  }

  async financeReview(requestId: string, userId: string, role: string, dto: ReviewCancellationDto) {
    const request = await this.findRequestOrThrow(requestId);
    if (!['FINANCE', 'ADMIN'].includes(role)) {
      throw new ForbiddenException('Only finance or admin can review at this stage');
    }
    if (request.status !== 'PENDING_FINANCE' && request.status !== 'ESCALATED') {
      throw new BadRequestException('Cancellation request is not awaiting finance review');
    }

    if (dto.approved) {
      return this.executeApprovedCancellation(request, userId, dto.notes, 'finance');
    }

    return this.rejectRequest(request, {
      notes: dto.notes,
      reviewerField: 'finance',
      reviewerId: userId,
    });
  }

  async escalate(requestId: string, userId: string, dto: EscalateCancellationDto) {
    const request = await this.findRequestOrThrow(requestId);
    if (request.requestedById !== userId) {
      throw new ForbiddenException('You can only escalate your own cancellation requests');
    }
    if (request.status !== 'REJECTED') {
      throw new BadRequestException('Only rejected cancellation requests can be escalated');
    }

    const updated = await this.prisma.cancellationRequest.update({
      where: { id: requestId },
      data: {
        status: 'ESCALATED',
        escalatedAt: new Date(),
        escalationReason: dto.reason,
      },
      include: this.defaultInclude(),
    });

    await this.notificationsService?.sendNotificationToRole(
      'ADMIN',
      'CANCELLATION_ESCALATED',
      'Cancellation Escalated',
      `Customer escalated cancellation for order ${request.order.orderNumber}. Reason: ${dto.reason || 'Not provided'}`,
      {
        orderId: request.orderId,
        orderNumber: request.order.orderNumber,
        cancellationRequestId: requestId,
      },
    );

    return updated;
  }

  async adminResolve(requestId: string, adminId: string, dto: ReviewCancellationDto) {
    const request = await this.findRequestOrThrow(requestId);
    if (!['REJECTED', 'ESCALATED', 'PENDING_FINANCE'].includes(request.status)) {
      throw new BadRequestException('Cancellation request cannot be resolved by admin in its current status');
    }

    if (dto.approved) {
      return this.executeApprovedCancellation(request, adminId, dto.notes, 'admin');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: request.orderId },
        data: { status: request.previousStatus },
      });

      return tx.cancellationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          resolvedBy: { connect: { id: adminId } },
          resolvedAt: new Date(),
          adminNotes: dto.notes,
        },
        include: this.defaultInclude(),
      });
    });

    await this.notifyCustomer(
      request.requestedById,
      'CANCELLATION_REJECTED',
      'Cancellation Rejected',
      `Your escalated cancellation for order ${request.order.orderNumber} was rejected. Reason: ${dto.notes || 'Not provided'}`,
      {
        orderId: request.orderId,
        orderNumber: request.order.orderNumber,
        cancellationRequestId: requestId,
      },
    );

    return updated;
  }

  async findAll(userId: string, role: string, filters?: { status?: string; page?: number; limit?: number }) {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CancellationRequestWhereInput = {};

    if (filters?.status) {
      where.status = filters.status.toUpperCase() as CancellationStatus;
    }

    if (role === 'CUSTOMER') {
      where.requestedById = userId;
    } else if (['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(role)) {
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      if (!seller) {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      where.order = {
        OR: [{ sellerId: seller.id }, { childOrders: { some: { sellerId: seller.id } } }],
      };
    } else if (!canAccessAllOrders(role)) {
      throw new ForbiddenException('Insufficient permissions to view cancellation requests');
    }

    const [data, total] = await Promise.all([
      this.prisma.cancellationRequest.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cancellationRequest.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, role: string) {
    const request = await this.findRequestOrThrow(id);
    await this.assertCanView(request, userId, role);
    return request;
  }

  async findByOrderId(orderId: string, userId: string, role: string) {
    const request = await this.prisma.cancellationRequest.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
    if (!request) {
      return null;
    }
    await this.assertCanView(request, userId, role);
    return request;
  }

  private defaultInclude() {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          currency: true,
          userId: true,
          sellerId: true,
          createdAt: true,
          seller: { select: { id: true, storeName: true, userId: true } },
          childOrders: {
            select: {
              id: true,
              sellerId: true,
              status: true,
              seller: { select: { id: true, storeName: true, userId: true } },
            },
          },
        },
      },
      requestedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    };
  }

  private async findRequestOrThrow(id: string) {
    const request = await this.prisma.cancellationRequest.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!request) {
      throw new NotFoundException('Cancellation request not found');
    }
    return request;
  }

  private async assertCanView(
    request: Prisma.CancellationRequestGetPayload<{ include: ReturnType<CancellationsService['defaultInclude']> }>,
    userId: string,
    role: string,
  ) {
    if (canAccessAllOrders(role)) {
      return;
    }
    if (role === 'CUSTOMER' && request.requestedById === userId) {
      return;
    }
    if (['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(role)) {
      await this.assertSellerAccess(request.order, userId);
      return;
    }
    throw new ForbiddenException('Insufficient permissions to view this cancellation request');
  }

  private async assertSellerAccess(
    order: {
      sellerId: string | null;
      seller?: { userId: string } | null;
      childOrders?: Array<{ sellerId: string | null; seller?: { userId: string } | null }>;
    },
    userId: string,
  ) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) {
      throw new ForbiddenException('Seller profile not found');
    }

    const ownsOrder =
      order.sellerId === seller.id ||
      (order.childOrders || []).some((child) => child.sellerId === seller.id);

    if (!ownsOrder) {
      throw new ForbiddenException('You do not have permission to review this cancellation request');
    }
  }

  private async rejectRequest(
    request: Prisma.CancellationRequestGetPayload<{ include: ReturnType<CancellationsService['defaultInclude']> }>,
    options: {
      notes?: string;
      reviewerField: 'seller' | 'finance';
      reviewerId: string;
    },
  ) {
    const updateData: Prisma.CancellationRequestUpdateInput = {
      status: 'REJECTED',
    };

    if (options.reviewerField === 'seller') {
      updateData.sellerReviewedBy = { connect: { id: options.reviewerId } };
      updateData.sellerReviewedAt = new Date();
      updateData.sellerNotes = options.notes;
    } else {
      updateData.financeReviewedBy = { connect: { id: options.reviewerId } };
      updateData.financeReviewedAt = new Date();
      updateData.financeNotes = options.notes;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: request.orderId },
        data: { status: request.previousStatus },
      });

      return tx.cancellationRequest.update({
        where: { id: request.id },
        data: updateData,
        include: this.defaultInclude(),
      });
    });

    await this.notifyCustomer(
      request.requestedById,
      'CANCELLATION_REJECTED',
      'Cancellation Rejected',
      `Your cancellation request for order ${request.order.orderNumber} was rejected. Reason: ${options.notes || 'Not provided'}. You may escalate to admin if you disagree.`,
      {
        orderId: request.orderId,
        orderNumber: request.order.orderNumber,
        cancellationRequestId: request.id,
      },
    );

    return updated;
  }

  private async executeApprovedCancellation(
    request: Prisma.CancellationRequestGetPayload<{ include: ReturnType<CancellationsService['defaultInclude']> }>,
    reviewerId: string,
    notes: string | undefined,
    reviewerType: 'finance' | 'admin',
  ) {
    await this.ordersService.cancel(request.orderId, request.requestedById, 'ADMIN', {
      skipApproval: true,
      recordTransaction: true,
      cancellationRequestId: request.id,
    });

    const updateData: Prisma.CancellationRequestUpdateInput = {
      status: 'APPROVED',
    };

    if (reviewerType === 'finance') {
      updateData.financeReviewedBy = { connect: { id: reviewerId } };
      updateData.financeReviewedAt = new Date();
      updateData.financeNotes = notes;
    } else {
      updateData.resolvedBy = { connect: { id: reviewerId } };
      updateData.resolvedAt = new Date();
      updateData.adminNotes = notes;
    }

    const updated = await this.prisma.cancellationRequest.update({
      where: { id: request.id },
      data: updateData,
      include: this.defaultInclude(),
    });

    await this.notifyCustomer(
      request.requestedById,
      'CANCELLATION_APPROVED',
      'Cancellation Approved',
      `Your cancellation for order ${request.order.orderNumber} has been approved. Your refund is being processed.`,
      {
        orderId: request.orderId,
        orderNumber: request.order.orderNumber,
        cancellationRequestId: request.id,
      },
    );

    return updated;
  }

  private async notifySellers(
    order: {
      orderNumber: string;
      id: string;
      seller?: { userId: string } | null;
      childOrders?: Array<{ seller?: { userId: string } | null }>;
    },
    request: { id: string; reason?: string | null },
  ) {
    const sellerUserIds = new Set<string>();
    if (order.seller?.userId) {
      sellerUserIds.add(order.seller.userId);
    }
    for (const child of order.childOrders || []) {
      if (child.seller?.userId) {
        sellerUserIds.add(child.seller.userId);
      }
    }

    await Promise.all(
      Array.from(sellerUserIds).map((sellerUserId) =>
        this.notifyCustomer(
          sellerUserId,
          'CANCELLATION_REQUESTED',
          'Cancellation Requested',
          `Customer requested cancellation for order ${order.orderNumber}. Reason: ${request.reason || 'Not provided'}`,
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            cancellationRequestId: request.id,
          },
        ),
      ),
    );
  }

  private async notifyFinanceTeam(
    order: { orderNumber: string; id: string },
    request: { id: string },
  ) {
    await this.notificationsService?.sendNotificationToRole(
      'FINANCE',
      'CANCELLATION_SELLER_APPROVED',
      'Cancellation Awaiting Finance Review',
      `Cancellation for order ${order.orderNumber} is awaiting finance approval.`,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        cancellationRequestId: request.id,
      },
    );
  }

  private async notifyCustomer(
    userId: string,
    type: string,
    subject: string,
    content: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.notificationsService?.sendNotificationToUser(
        userId,
        type,
        subject,
        content,
        metadata,
      );
    } catch (err) {
      this.logger.warn(`Failed to send ${type} notification: ${(err as Error).message}`);
    }
  }
}

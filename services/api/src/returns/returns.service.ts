import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { RefundsService } from '../finance/refunds.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { ReturnPoliciesService } from '../return-policies/return-policies.service';
import { LoyaltyReversalService } from '../loyalty/services/loyalty-reversal.service';

interface ReturnTimelineStep {
  step: string;
  label: string;
  at?: Date;
  completed: boolean;
}

const ACTIVE_RETURN_STATUSES = [
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'AWAITING_CUSTOMER_RETURN',
  'ITEM_RECEIVED',
  'REFUND_PENDING',
] as const;

const POS_RETURNABLE_SALE_STATUSES = ['PROCESSED', 'IMPORTED'] as const;

const POS_SALE_DETAIL_INCLUDE = {
  store: { select: { id: true, name: true, code: true, sellerId: true } },
  items: {
    include: {
      product: {
        select: { id: true, name: true, price: true, sellerId: true, categoryId: true },
      },
    },
  },
};

const RETURN_ITEMS_INCLUDE = {
  orderItem: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  },
  posSaleItem: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  },
};

interface ReturnRequest {
  id: string;
  orderId?: string;
  posSaleId?: string;
  userId: string;
  reason: string;
  status: string;
  refundAmount?: number;
  refundMethod?: string;
  notes?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  order?: {
    id: string;
    orderNumber?: string;
    total?: number;
    currency?: string;
    paymentStatus?: string;
  };
  posSale?: {
    id: string;
    externalInvoice?: string;
    externalSaleId?: string;
    total?: number;
    currency?: string;
    saleDate?: Date;
    status?: string;
    store?: { id: string; name?: string; code?: string };
    items?: Array<{
      id: string;
      name: string;
      sku?: string;
      quantity: number;
      unitPrice?: number;
      totalPrice?: number;
    }>;
  };
  items?: Array<{
    id: string;
    quantity: number;
    reason?: string;
    productName?: string;
    orderItemId?: string;
    posSaleItemId?: string;
  }>;
  refundTransactions?: Array<{
    id: string;
    amount: number;
    status: string;
    currency?: string;
    createdAt: Date;
    stripeRefundId?: string;
  }>;
  timeline?: ReturnTimelineStep[];
}

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private prisma: PrismaService,
    private refundsService: RefundsService,
    private returnPoliciesService: ReturnPoliciesService,
    private moduleRef: ModuleRef,
    @Optional() private notificationsService?: NotificationsService,
    @Optional() private activityService?: ActivityService,
    @Optional() private _inventoryService?: InventoryService,
    @Optional()
    @Inject(forwardRef(() => LoyaltyReversalService))
    private loyaltyReversalService?: LoyaltyReversalService,
  ) {}

  private getOrdersService(): OrdersService {
    return this.moduleRef.get(OrdersService, { strict: false });
  }

  async create(userId: string, createReturnDto: CreateReturnDto): Promise<ReturnRequest> {
    const orderId = createReturnDto.orderId?.trim() || undefined;
    const posSaleId = createReturnDto.posSaleId?.trim() || undefined;
    if (!!orderId === !!posSaleId) {
      throw new BadRequestException('Exactly one of orderId or posSaleId must be provided');
    }
    if (posSaleId) {
      return this.createFromPosSale(userId, createReturnDto, posSaleId);
    }

    // Verify order exists and belongs to user
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order is eligible for return (must be delivered)
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Order must be delivered to request a return');
    }

    const eligibility = await this.returnPoliciesService.checkReturnEligibility(
      orderId!,
      createReturnDto.items?.[0]
        ? order.items.find((i) => i.id === createReturnDto.items![0].orderItemId)?.productId
        : order.items[0]?.productId,
    );
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason || 'Return is not allowed for this order');
    }
    const applicablePolicyId =
      eligibility.policy?.id && typeof eligibility.policy.id === 'string'
        ? eligibility.policy.id
        : undefined;

    // If item-level returns are specified, validate them
    if (createReturnDto.items && createReturnDto.items.length > 0) {
      // Validate each item
      for (const returnItem of createReturnDto.items) {
        if (!returnItem.orderItemId) {
          throw new BadRequestException('Online returns require orderItemId for each item');
        }
        const orderItem = order.items.find((item) => item.id === returnItem.orderItemId);
        if (!orderItem) {
          throw new BadRequestException(`Order item ${returnItem.orderItemId} not found in order`);
        }
        if (returnItem.quantity > orderItem.quantity) {
          throw new BadRequestException(
            `Return quantity (${returnItem.quantity}) exceeds ordered quantity (${orderItem.quantity}) for item ${orderItem.id}`,
          );
        }

        // Check if item is already being returned
        const existingReturnItem = await this.prisma.returnItem.findFirst({
          where: {
            orderItemId: returnItem.orderItemId,
            returnRequest: {
              status: {
                in: [
                  'PENDING',
                  'APPROVED',
                  'PROCESSING',
                  'AWAITING_CUSTOMER_RETURN',
                  'ITEM_RECEIVED',
                  'REFUND_PENDING',
                ],
              },
            },
          },
        });

        if (existingReturnItem) {
          throw new BadRequestException(`Item ${returnItem.orderItemId} is already being returned`);
        }
      }
    } else {
      // Full order return - block only active return requests
      const existingReturn = await this.prisma.returnRequest.findFirst({
        where: {
          orderId,
          status: {
            in: [
              'PENDING',
              'APPROVED',
              'PROCESSING',
              'AWAITING_CUSTOMER_RETURN',
              'ITEM_RECEIVED',
              'REFUND_PENDING',
            ],
          },
        },
      });

      if (existingReturn) {
        throw new BadRequestException('An active return request already exists for this order');
      }
    }

    // Create return request
    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        orderId,
        userId,
        reason: createReturnDto.reason,
        notes: createReturnDto.notes,
        status: 'PENDING',
        returnPolicyId: applicablePolicyId,
        items: createReturnDto.items
          ? {
              create: createReturnDto.items.map((item) => ({
                orderItemId: item.orderItemId!,
                quantity: item.quantity,
                reason: item.reason || createReturnDto.reason,
                status: 'PENDING',
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    this.activityService
      ?.createLog({
        userId,
        action: 'RETURN_REQUESTED',
        entityType: 'ReturnRequest',
        entityId: returnRequest.id,
        description: `Return requested for order ${order.orderNumber || order.id}`,
        metadata: { orderId: order.id, reason: createReturnDto.reason },
      })
      .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    if (this.notificationsService) {
      this.notificationsService
        .sendNotificationToUser(
          userId,
          'RETURN_REQUESTED',
          'Return request received',
          `Your return request for order ${order.orderNumber || order.id} has been submitted and is pending review.`,
          { returnId: returnRequest.id, orderId: order.id },
        )
        .catch((e) => this.logger.warn(`Return notification failed: ${(e as Error).message}`));

      if (order.sellerId) {
        const seller = await this.prisma.seller.findUnique({
          where: { id: order.sellerId },
          select: { userId: true },
        });
        if (seller?.userId) {
          this.notificationsService
            .sendNotificationToUser(
              seller.userId,
              'RETURN_REQUESTED',
              'New return request',
              `A customer has requested a return for order ${order.orderNumber || order.id}. Please review it in your returns dashboard.`,
              { returnId: returnRequest.id, orderId: order.id },
            )
            .catch((e) =>
              this.logger.warn(`Seller return notification failed: ${(e as Error).message}`),
            );
        }
      }

      this.notificationsService
        .sendNotificationToRole(
          'ADMIN',
          'RETURN_REQUESTED',
          'New return request',
          `A return has been requested for order ${order.orderNumber || order.id}. Review pending in the returns management queue.`,
          { returnId: returnRequest.id, orderId: order.id },
        )
        .catch((e) =>
          this.logger.warn(`Admin return notification failed: ${(e as Error).message}`),
        );
    }

    return this.mapToReturnType(returnRequest);
  }

  private async createFromPosSale(
    userId: string,
    createReturnDto: CreateReturnDto,
    posSaleId: string,
  ): Promise<ReturnRequest> {
    const sale = await this.prisma.pOSSale.findFirst({
      where: { id: posSaleId, customerId: userId },
      include: POS_SALE_DETAIL_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException('POS sale not found');
    }

    if (
      !POS_RETURNABLE_SALE_STATUSES.includes(
        sale.status as (typeof POS_RETURNABLE_SALE_STATUSES)[number],
      )
    ) {
      throw new BadRequestException('POS sale must be processed or imported to request a return');
    }

    const requestedItem = createReturnDto.items?.[0];
    const matchedSaleItem = requestedItem?.posSaleItemId
      ? sale.items.find((item) => item.id === requestedItem.posSaleItemId)
      : sale.items[0];
    const product = matchedSaleItem?.product;

    const policy = product?.id
      ? await this.returnPoliciesService.getApplicablePolicy(
          product.id,
          product.sellerId || sale.store?.sellerId || undefined,
          product.categoryId || undefined,
        )
      : null;

    const effectivePolicy =
      policy ||
      ({
        id: null,
        isReturnable: true,
        returnWindowDays: 30,
      } as const);

    if (!effectivePolicy.isReturnable) {
      throw new BadRequestException('Product is not returnable');
    }

    const daysSinceSale = Math.floor(
      (Date.now() - sale.saleDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceSale > effectivePolicy.returnWindowDays) {
      throw new BadRequestException(
        `Return window expired. Return must be initiated within ${effectivePolicy.returnWindowDays} days of purchase.`,
      );
    }

    const applicablePolicyId = policy?.id && typeof policy.id === 'string' ? policy.id : undefined;

    if (createReturnDto.items && createReturnDto.items.length > 0) {
      for (const returnItem of createReturnDto.items) {
        if (!returnItem.posSaleItemId) {
          throw new BadRequestException('POS returns require posSaleItemId for each item');
        }
        const saleItem = sale.items.find((item) => item.id === returnItem.posSaleItemId);
        if (!saleItem) {
          throw new BadRequestException(
            `POS sale item ${returnItem.posSaleItemId} not found in sale`,
          );
        }
        if (returnItem.quantity > saleItem.quantity) {
          throw new BadRequestException(
            `Return quantity (${returnItem.quantity}) exceeds sold quantity (${saleItem.quantity}) for item ${saleItem.id}`,
          );
        }

        const existingReturnItem = await this.prisma.returnItem.findFirst({
          where: {
            posSaleItemId: returnItem.posSaleItemId,
            returnRequest: {
              status: { in: [...ACTIVE_RETURN_STATUSES] },
            },
          },
        });

        if (existingReturnItem) {
          throw new BadRequestException(
            `Item ${returnItem.posSaleItemId} is already being returned`,
          );
        }
      }
    } else {
      const existingReturn = await this.prisma.returnRequest.findFirst({
        where: {
          posSaleId,
          status: { in: [...ACTIVE_RETURN_STATUSES] },
        },
      });

      if (existingReturn) {
        throw new BadRequestException('An active return request already exists for this POS sale');
      }
    }

    const saleLabel = sale.externalInvoice || sale.externalSaleId || sale.id;

    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        posSaleId,
        userId,
        reason: createReturnDto.reason,
        notes: createReturnDto.notes,
        status: 'PENDING',
        refundMethod: 'IN_STORE',
        returnPolicyId: applicablePolicyId,
        marketId: sale.marketId || undefined,
        items: createReturnDto.items
          ? {
              create: createReturnDto.items.map((item) => ({
                posSaleItemId: item.posSaleItemId!,
                quantity: item.quantity,
                reason: item.reason || createReturnDto.reason,
                status: 'PENDING',
              })),
            }
          : undefined,
      },
      include: {
        posSale: { include: POS_SALE_DETAIL_INCLUDE },
        items: { include: RETURN_ITEMS_INCLUDE },
      },
    });

    this.activityService
      ?.createLog({
        userId,
        action: 'RETURN_REQUESTED',
        entityType: 'ReturnRequest',
        entityId: returnRequest.id,
        description: `Return requested for POS sale ${saleLabel}`,
        metadata: { posSaleId: sale.id, reason: createReturnDto.reason },
      })
      .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    if (this.notificationsService) {
      this.notificationsService
        .sendNotificationToUser(
          userId,
          'RETURN_REQUESTED',
          'Return request received',
          `Your return request for in-store sale ${saleLabel} has been submitted and is pending review.`,
          { returnId: returnRequest.id, posSaleId: sale.id },
        )
        .catch((e) => this.logger.warn(`Return notification failed: ${(e as Error).message}`));

      if (sale.store?.sellerId) {
        const seller = await this.prisma.seller.findUnique({
          where: { id: sale.store.sellerId },
          select: { userId: true },
        });
        if (seller?.userId) {
          this.notificationsService
            .sendNotificationToUser(
              seller.userId,
              'RETURN_REQUESTED',
              'New return request',
              `A customer has requested a return for in-store sale ${saleLabel}. Please review it in your returns dashboard.`,
              { returnId: returnRequest.id, posSaleId: sale.id },
            )
            .catch((e) =>
              this.logger.warn(`Seller return notification failed: ${(e as Error).message}`),
            );
        }
      }

      this.notificationsService
        .sendNotificationToRole(
          'ADMIN',
          'RETURN_REQUESTED',
          'New return request',
          `A return has been requested for in-store sale ${saleLabel}. Review pending in the returns management queue.`,
          { returnId: returnRequest.id, posSaleId: sale.id },
        )
        .catch((e) =>
          this.logger.warn(`Admin return notification failed: ${(e as Error).message}`),
        );
    }

    return this.mapToReturnType(returnRequest);
  }

  async findAll(userId: string, role: string, page = 1, limit = 50): Promise<ReturnRequest[]> {
    const where: any = {};

    if (role === 'CUSTOMER') {
      where.userId = userId;
    } else if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      if (seller) {
        where.OR = [
          {
            order: {
              OR: [{ sellerId: seller.id }, { childOrders: { some: { sellerId: seller.id } } }],
            },
          },
          { posSale: { store: { sellerId: seller.id } } },
        ];
      } else {
        where.userId = userId;
      }
    }
    // ADMIN and FINANCE see all returns (no filter)

    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const returns = await this.prisma.returnRequest.findMany({
      where,
      skip,
      take,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        posSale: { include: POS_SALE_DETAIL_INCLUDE },
        items: {
          include: RETURN_ITEMS_INCLUDE,
        },
        transactions: {
          where: { type: 'REFUND' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return returns.map((r) => this.mapToReturnType(r));
  }

  async findOne(id: string, userId: string, role: string): Promise<ReturnRequest> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            paymentStatus: true,
            sellerId: true,
            parentOrderId: true,
          },
        },
        posSale: { include: POS_SALE_DETAIL_INCLUDE },
        items: {
          include: RETURN_ITEMS_INCLUDE,
        },
        transactions: {
          where: { type: 'REFUND' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            status: true,
            currency: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    // Check permissions
    if (role === 'CUSTOMER' && returnRequest.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this return');
    } else if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      if (returnRequest.posSaleId) {
        const storeSellerId = returnRequest.posSale?.store?.sellerId;
        if (!seller || !storeSellerId || storeSellerId !== seller.id) {
          throw new ForbiddenException('You do not have permission to view this return');
        }
      } else {
        const order = returnRequest.order;
        const isDirectSeller = seller && order?.sellerId === seller.id;
        let hasChildOrder = false;
        if (seller && order?.id && !isDirectSeller) {
          hasChildOrder =
            (await this.prisma.order.count({
              where: { parentOrderId: order.id, sellerId: seller.id },
            })) > 0;
        }
        if (!seller || (!isDirectSeller && !hasChildOrder)) {
          throw new ForbiddenException('You do not have permission to view this return');
        }
      }
    }

    return this.mapToReturnType(returnRequest);
  }

  async updateStatus(
    id: string,
    status: string,
    refundAmount?: number,
    refundMethod?: string,
    userId?: string,
    role?: string,
    notes?: string,
  ): Promise<ReturnRequest> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: { select: { id: true, categoryId: true } },
              },
            },
            seller: true,
          },
        },
        posSale: { include: POS_SALE_DETAIL_INCLUDE },
        items: {
          include: {
            posSaleItem: {
              include: {
                product: { select: { id: true, categoryId: true, sellerId: true } },
              },
            },
          },
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (userId && role && role !== 'ADMIN') {
      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      if (sellerRoles.includes(role)) {
        const seller = await this.prisma.seller.findUnique({ where: { userId } });
        if (returnRequest.posSaleId) {
          const storeSellerId = returnRequest.posSale?.store?.sellerId;
          if (!seller || !storeSellerId || storeSellerId !== seller.id) {
            throw new ForbiddenException('You do not have permission to update this return');
          }
        } else {
          // Check direct sellerId OR if seller has a child order for this parent order
          const isDirectSeller = seller && returnRequest.order?.sellerId === seller.id;
          const hasChildOrder =
            seller && returnRequest.order?.id
              ? (await this.prisma.order.count({
                  where: { parentOrderId: returnRequest.order.id, sellerId: seller.id },
                })) > 0
              : false;
          if (!seller || (!isDirectSeller && !hasChildOrder)) {
            throw new ForbiddenException('You do not have permission to update this return');
          }
        }
      }
    }

    const validTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: [
        'AWAITING_CUSTOMER_RETURN',
        'PROCESSING',
        'REFUND_PENDING',
        'COMPLETED',
        'CANCELLED',
      ],
      AWAITING_CUSTOMER_RETURN: ['ITEM_RECEIVED', 'PROCESSING', 'CANCELLED'],
      ITEM_RECEIVED: ['REFUND_PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'],
      REFUND_PENDING: ['COMPLETED', 'CANCELLED'],
      PROCESSING: ['ITEM_RECEIVED', 'REFUND_PENDING', 'COMPLETED', 'CANCELLED'],
    };
    const currentStatus = returnRequest.status;
    const newStatus = status.toUpperCase();
    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition return from ${currentStatus} to ${newStatus}`,
      );
    }

    // For APPROVED status, check policy for requiresInspection. If inspection
    // is required, approve without processing refund/restock (those happen at
    // COMPLETED). Otherwise, process refund immediately on approval.
    if (newStatus === 'APPROVED') {
      if (this.isPosReturn(returnRequest)) {
        return this.approvePosReturn(id, returnRequest, refundAmount, refundMethod, userId);
      }
      if (!returnRequest.order) {
        throw new BadRequestException('Return is not linked to an order');
      }

      const policyProduct = this.resolveReturnPolicyProduct(returnRequest);
      const policy = returnRequest.order
        ? await this.returnPoliciesService.getApplicablePolicy(
            policyProduct?.id || returnRequest.order.items[0]?.productId || '',
            returnRequest.order.sellerId || undefined,
            policyProduct?.categoryId || undefined,
          )
        : null;

      if (policy?.requiresInspection) {
        await this.prisma.returnRequest.update({
          where: { id },
          data: {
            status: 'APPROVED' as any,
            refundMethod: refundMethod || 'ORIGINAL_PAYMENT',
          },
        });

        this.activityService
          ?.createLog({
            userId: userId || returnRequest.userId,
            action: 'RETURN_APPROVED',
            entityType: 'ReturnRequest',
            entityId: id,
            description: `Return approved (inspection required) for order ${returnRequest.order.orderNumber || returnRequest.orderId}`,
          })
          .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

        if (this.notificationsService) {
          this.notificationsService
            .sendNotificationToUser(
              returnRequest.userId,
              'RETURN_APPROVED',
              'Return approved — awaiting inspection',
              `Your return for order ${returnRequest.order.orderNumber || returnRequest.orderId} has been approved. Please ship the item(s) back. Your refund will be processed after inspection.`,
              { returnId: id },
            )
            .catch((e) =>
              this.logger.warn(`Return approval notification failed: ${(e as Error).message}`),
            );
        }

        const updated = await this.prisma.returnRequest.findUnique({ where: { id } });
        return this.mapToReturnType(updated);
      }

      const maxRefundable = this.calculateReturnRefundAmount(returnRequest);
      let amount = Math.min(refundAmount ?? maxRefundable, maxRefundable);
      const restockingFee = policy?.restockingFee != null ? Number(policy.restockingFee) : 0;

      if (restockingFee > 0) {
        amount = Math.max(0, Math.round((amount - restockingFee) * 100) / 100);
      }
      if (amount <= 0) {
        throw new BadRequestException('No refundable amount for the returned items');
      }

      const refundBreakdown =
        restockingFee > 0
          ? `Refund $${amount.toFixed(2)} = order share $${maxRefundable.toFixed(2)} − restocking fee $${restockingFee.toFixed(2)} (${policy?.name || 'return policy'})`
          : `Refund $${amount.toFixed(2)} (order share $${maxRefundable.toFixed(2)})`;

      const refundResult = await this.refundsService.processRefund({
        returnId: id,
        amount,
        currency: returnRequest.order.currency,
        description: `Refund for return request ${id}`,
      });

      const refundSucceeded = refundResult.stripeRefundSucceeded;

      await this.prisma.$transaction(async (tx) => {
        await tx.returnRequest.update({
          where: { id },
          data: {
            status: 'APPROVED' as any,
            refundAmount: amount,
            refundMethod: refundMethod || 'ORIGINAL_PAYMENT',
            notes: [
              returnRequest.notes || '',
              `[${refundBreakdown}]`,
              refundSucceeded
                ? ''
                : `[Refund pending: ${refundResult.error || 'Stripe refund failed — manual retry required'}]`,
            ]
              .filter(Boolean)
              .join(' '),
          },
        });

        if (refundSucceeded) {
          await this.applyRestockForReturn(tx, returnRequest);
          const isPartial =
            returnRequest.items?.length > 0 &&
            returnRequest.items.length < (returnRequest.order?.items?.length ?? 0);
          await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
        }
      });

      if (refundSucceeded && returnRequest.orderId) {
        try {
          await this.getOrdersService().reverseInfluencerAttribution(returnRequest.orderId);
        } catch (commErr) {
          this.logger.error(
            `Influencer attribution reversal failed for refunded order ${returnRequest.orderId}: ${(commErr as Error).message}`,
          );
        }
      }

      this.activityService
        ?.createLog({
          userId: userId || returnRequest.userId,
          action: 'RETURN_APPROVED',
          entityType: 'ReturnRequest',
          entityId: id,
          description: `Return approved for order ${returnRequest.order.orderNumber || returnRequest.orderId}`,
          metadata: { refundAmount: amount, refundSucceeded },
        })
        .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

      if (this.notificationsService) {
        this.notificationsService
          .sendNotificationToUser(
            returnRequest.userId,
            'RETURN_APPROVED',
            refundSucceeded ? 'Return approved' : 'Return approved — refund pending',
            refundSucceeded
              ? `Your return for order ${returnRequest.order.orderNumber || returnRequest.orderId} has been approved. Your refund is being processed.`
              : `Your return for order ${returnRequest.order.orderNumber || returnRequest.orderId} was approved, but the automatic refund could not be completed. Our team will process it shortly.`,
            { returnId: id, refundSucceeded },
          )
          .catch((e) =>
            this.logger.warn(`Return approval notification failed: ${(e as Error).message}`),
          );
      }

      const updated = await this.prisma.returnRequest.findUnique({ where: { id } });
      return this.mapToReturnType(updated);
    }

    // Determine whether refund+restock were already completed on APPROVE
    // (i.e. immediate-approval path where Stripe succeeded).
    // A refund transaction with status COMPLETED is the definitive signal.
    const refundFullyProcessed =
      returnRequest.refundAmount &&
      Number(returnRequest.refundAmount) > 0 &&
      (await this.prisma.transaction
        .count({
          where: { returnId: id, type: 'REFUND', status: 'COMPLETED' },
        })
        .then((c) => c > 0)
        .catch(() => false));

    // For non-APPROVED transitions, commit directly
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.returnRequest.update({
        where: { id },
        data: {
          status: newStatus as any,
          refundAmount: refundAmount ? refundAmount : undefined,
          refundMethod: newStatus === 'REJECTED' ? undefined : refundMethod,
          notes: notes || (newStatus === 'REJECTED' ? refundMethod : undefined),
          processedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
        },
      });

      if (
        newStatus === 'COMPLETED' &&
        returnRequest.order &&
        returnRequest.orderId &&
        refundFullyProcessed
      ) {
        const isPartial =
          returnRequest.items?.length > 0 &&
          returnRequest.items.length < (returnRequest.order?.items?.length ?? 0);
        await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
      }

      return result;
    });

    // If transitioning to COMPLETED and no successful refund exists yet
    // (inspection flow), process refund + restock + mark order now.
    if (newStatus === 'COMPLETED' && this.isPosReturn(returnRequest)) {
      await this.completePosReturn(id, returnRequest, refundAmount, refundMethod);
    } else if (newStatus === 'COMPLETED' && returnRequest.order && !refundFullyProcessed) {
      const policyProduct = this.resolveReturnPolicyProduct(returnRequest);
      const policy = await this.returnPoliciesService.getApplicablePolicy(
        policyProduct?.id || returnRequest.order.items[0]?.productId || '',
        returnRequest.order.sellerId || undefined,
        policyProduct?.categoryId || undefined,
      );
      const maxRefundable = this.calculateReturnRefundAmount(returnRequest);
      let amount = Math.min(refundAmount ?? maxRefundable, maxRefundable);
      const restockingFee = policy?.restockingFee != null ? Number(policy.restockingFee) : 0;
      if (restockingFee > 0) {
        amount = Math.max(0, Math.round((amount - restockingFee) * 100) / 100);
      }
      const refundBreakdown =
        restockingFee > 0
          ? `Refund $${amount.toFixed(2)} = order share $${maxRefundable.toFixed(2)} − restocking fee $${restockingFee.toFixed(2)} (${policy?.name || 'return policy'})`
          : `Refund $${amount.toFixed(2)} (order share $${maxRefundable.toFixed(2)})`;
      if (amount > 0) {
        try {
          const refundResult = await this.refundsService.processRefund({
            returnId: id,
            amount,
            currency: returnRequest.order.currency,
            description: `Refund for completed return ${id}`,
          });
          if (refundResult.stripeRefundSucceeded) {
            await this.prisma.$transaction(async (tx) => {
              await this.applyRestockForReturn(tx, returnRequest);
              const isPartial =
                returnRequest.items?.length > 0 &&
                returnRequest.items.length < (returnRequest.order?.items?.length ?? 0);
              if (returnRequest.orderId) {
                await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
              }
            });
            await this.prisma.returnRequest.update({
              where: { id },
              data: {
                refundAmount: amount,
                refundMethod: refundMethod || 'ORIGINAL_PAYMENT',
                notes: [returnRequest.notes || '', `[${refundBreakdown}]`]
                  .filter(Boolean)
                  .join(' '),
              },
            });
            if (returnRequest.orderId) {
              try {
                await this.getOrdersService().reverseInfluencerAttribution(returnRequest.orderId);
              } catch (commErr) {
                this.logger.error(
                  `Influencer attribution reversal failed for completed return order ${returnRequest.orderId}: ${(commErr as Error).message}`,
                );
              }
            }
          } else {
            await this.prisma.returnRequest.update({
              where: { id },
              data: {
                refundAmount: amount,
                notes: [
                  returnRequest.notes || '',
                  `[${refundBreakdown}]`,
                  `[Refund pending: ${refundResult.error || 'Stripe refund failed — manual retry required'}]`,
                ]
                  .filter(Boolean)
                  .join(' '),
              },
            });
          }
        } catch (e) {
          this.logger.error(
            `Refund on completion failed for return ${id}: ${(e as Error).message}`,
          );
        }
      }
    }

    if (this.notificationsService && ['REJECTED', 'COMPLETED'].includes(newStatus)) {
      const sourceLabel = this.returnSourceLabel(returnRequest);
      const title = newStatus === 'REJECTED' ? 'Return request rejected' : 'Return completed';
      let message: string;
      if (newStatus === 'REJECTED') {
        message = `Your return request for ${sourceLabel} has been rejected.${notes ? ` Reason: ${notes}` : ''}`;
      } else if (this.isPosReturn(returnRequest)) {
        message = `Your return for ${sourceLabel} has been completed. Your in-store refund is being processed.`;
      } else if (refundFullyProcessed) {
        message = `Your return for ${sourceLabel} has been completed. Your refund was already processed.`;
      } else {
        message = `Your return for ${sourceLabel} has been completed and your refund is being processed.`;
      }
      this.notificationsService
        .sendNotificationToUser(
          returnRequest.userId,
          newStatus === 'REJECTED' ? 'RETURN_REJECTED' : 'RETURN_COMPLETED',
          title,
          message,
          { returnId: id },
        )
        .catch((e) =>
          this.logger.warn(`Return ${newStatus} notification failed: ${(e as Error).message}`),
        );
    }

    this.activityService
      ?.createLog({
        userId: userId || returnRequest.userId,
        action: `RETURN_${newStatus}`,
        entityType: 'ReturnRequest',
        entityId: id,
        description: `Return ${newStatus.toLowerCase()} for ${this.returnSourceLabel(returnRequest)}`,
      })
      .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    // Re-fetch after potential post-transaction updates (refundAmount, notes)
    // to return the most current state
    if (newStatus === 'COMPLETED') {
      const latest = await this.prisma.returnRequest.findUnique({ where: { id } });
      return this.mapToReturnType(latest);
    }
    return this.mapToReturnType(updated);
  }

  async cancelReturn(id: string, userId: string): Promise<ReturnRequest> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.userId !== userId) {
      throw new ForbiddenException('You do not have permission to cancel this return request');
    }

    if (returnRequest.status !== 'PENDING') {
      throw new BadRequestException('Only pending return requests can be cancelled');
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return this.mapToReturnType(updated);
  }

  async retryReturnRefund(id: string, userId?: string, role?: string): Promise<ReturnRequest> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }
    if (role && role !== 'ADMIN' && role !== 'FINANCE') {
      throw new ForbiddenException('Only admin or finance can retry refunds');
    }

    if (!returnRequest.orderId || this.isPosReturn(returnRequest)) {
      throw new BadRequestException('In-store POS returns do not use Stripe refunds');
    }

    const refundResult = await this.refundsService.retryReturnRefund(id);

    if (refundResult.stripeRefundSucceeded) {
      const fullReturn = await this.prisma.returnRequest.findUnique({
        where: { id },
        include: { order: { include: { items: true, seller: true } }, items: true },
      });
      await this.prisma.$transaction(async (tx) => {
        if (fullReturn) {
          await this.applyRestockForReturn(tx, fullReturn);
        }
        const isPartial =
          fullReturn?.items?.length > 0 &&
          fullReturn.items.length < (fullReturn.order?.items?.length ?? 0);
        await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
      });
      try {
        await this.getOrdersService().reverseInfluencerAttribution(returnRequest.orderId);
      } catch (commErr) {
        this.logger.error(
          `Influencer reversal on retry failed for order ${returnRequest.orderId}: ${(commErr as Error).message}`,
        );
      }
    }

    this.activityService
      ?.createLog({
        userId: userId || returnRequest.userId,
        action: 'RETURN_REFUND_RETRY',
        entityType: 'ReturnRequest',
        entityId: id,
        description: `Refund retry for return ${id}: ${refundResult.stripeRefundSucceeded ? 'succeeded' : 'failed'}`,
        metadata: {
          refundSucceeded: refundResult.stripeRefundSucceeded,
          error: refundResult.error,
        },
      })
      .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    const updated = await this.prisma.returnRequest.findUnique({ where: { id } });
    return this.mapToReturnType(updated);
  }

  /**
   * Fulfilment side of a refund that settled after the inline attempt (Stripe
   * webhook). The approval path only restocks and moves the order when the card
   * refund succeeds inline, so an async settlement has to finish that work here.
   * The caller is responsible for making sure this runs once per return.
   */
  async finalizeSettledReturn(returnId: string): Promise<void> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: { include: { items: true, seller: true } }, items: true },
    });
    if (!returnRequest?.order || !returnRequest.orderId) return;

    const isPartial =
      returnRequest.items?.length > 0 &&
      returnRequest.items.length < (returnRequest.order.items?.length ?? 0);

    await this.prisma.$transaction(async (tx) => {
      await this.applyRestockForReturn(tx, returnRequest);
      await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
    });

    try {
      await this.getOrdersService().reverseInfluencerAttribution(returnRequest.orderId);
    } catch (commErr) {
      this.logger.error(
        `Influencer reversal after settled refund failed for order ${returnRequest.orderId}: ${(commErr as Error).message}`,
      );
    }
  }

  private async markOrderRefundedInTx(
    tx: any,
    orderId: string | null | undefined,
    isPartial?: boolean,
  ) {
    if (!orderId) return;
    if (isPartial) {
      // For partial returns, only update paymentStatus to REFUNDED but keep order
      // status unchanged — the order is only partially returned, not fully refunded.
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'REFUNDED' },
      });
      return;
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    });
    await tx.order.updateMany({
      where: { parentOrderId: orderId },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    });
  }

  private async applyRestockForReturn(tx: any, returnRequest: any) {
    if (!returnRequest.order) return;
    const returnItems = returnRequest.items;
    if (returnItems && returnItems.length > 0) {
      for (const ri of returnItems) {
        const orderItem = returnRequest.order.items.find((oi: any) => oi.id === ri.orderItemId);
        if (orderItem) {
          await tx.product.update({
            where: { id: orderItem.productId },
            data: { stock: { increment: ri.quantity } },
          });
          if (returnRequest.order.sellerId) {
            const vp = await tx.vendorProduct.findFirst({
              where: {
                productId: orderItem.productId,
                sellerId: returnRequest.order.sellerId,
              },
            });
            if (vp) {
              await tx.vendorProduct.update({
                where: { id: vp.id },
                data: { vendorStock: { increment: ri.quantity } },
              });
            }
          }
        }
      }
    } else {
      for (const item of returnRequest.order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        if (returnRequest.order.sellerId) {
          const vp = await tx.vendorProduct.findFirst({
            where: { productId: item.productId, sellerId: returnRequest.order.sellerId },
          });
          if (vp) {
            await tx.vendorProduct.update({
              where: { id: vp.id },
              data: { vendorStock: { increment: item.quantity } },
            });
          }
        }
      }
    }
  }

  /** Prefer the returned line item's product when resolving category-specific policies. */
  private resolveReturnPolicyProduct(
    returnRequest: any,
  ): { id: string; categoryId?: string | null } | undefined {
    const orderItems = returnRequest.order?.items || [];
    const returnedOrderItemId = returnRequest.items?.[0]?.orderItemId;
    const matched = returnedOrderItemId
      ? orderItems.find((oi: any) => oi.id === returnedOrderItemId)
      : undefined;
    return (matched || orderItems[0])?.product;
  }

  private isPosReturn(returnRequest: { posSaleId?: string | null }): boolean {
    return Boolean(returnRequest.posSaleId);
  }

  private posReturnLabel(returnRequest: any): string {
    return (
      returnRequest.posSale?.store?.name ||
      returnRequest.posSale?.externalInvoice ||
      returnRequest.posSaleId ||
      'in-store purchase'
    );
  }

  private resolvePosReturnPolicyProduct(
    returnRequest: any,
  ): { id: string; categoryId?: string | null; sellerId?: string | null } | undefined {
    const returnedPosItemId = returnRequest.items?.[0]?.posSaleItemId;
    const saleItems = returnRequest.posSale?.items || [];
    const matched = returnedPosItemId
      ? saleItems.find((item: any) => item.id === returnedPosItemId)
      : saleItems[0];
    const fromInclude = returnRequest.items?.[0]?.posSaleItem?.product;
    const product = fromInclude || matched?.product;
    if (!product?.id) return undefined;
    return {
      id: product.id,
      categoryId: product.categoryId,
      sellerId: product.sellerId,
    };
  }

  private calculatePosReturnRefundAmount(returnRequest: any): number {
    const saleItems = returnRequest.posSale?.items || [];
    const returnItems = returnRequest.items;
    const saleTotal = Number(returnRequest.posSale?.totalAmount ?? 0);

    if (returnItems && returnItems.length > 0) {
      let itemsTotal = 0;
      let saleItemsTotal = 0;
      for (const ri of returnItems) {
        const saleItem =
          saleItems.find((item: any) => item.id === ri.posSaleItemId) || ri.posSaleItem;
        if (saleItem) {
          itemsTotal += Number(saleItem.unitPrice ?? 0) * (ri.quantity || 1);
        } else if (ri.refundAmount != null) {
          itemsTotal += Number(ri.refundAmount);
        }
      }
      for (const item of saleItems) {
        saleItemsTotal += Number(item.unitPrice ?? 0) * Number(item.quantity || 1);
      }
      if (itemsTotal > 0 && saleItemsTotal > 0 && saleTotal > 0) {
        return Math.round(saleTotal * (itemsTotal / saleItemsTotal) * 100) / 100;
      }
      if (itemsTotal > 0) return Math.round(itemsTotal * 100) / 100;
    }

    return saleTotal;
  }

  private async triggerPosLoyaltyClawback(
    returnRequest: any,
    refundAmount: number,
  ): Promise<void> {
    if (!returnRequest.posSaleId || !this.loyaltyReversalService) return;
    const amount =
      refundAmount > 0 ? refundAmount : this.calculatePosReturnRefundAmount(returnRequest);
    if (amount <= 0) return;
    try {
      await this.loyaltyReversalService.onPosReturnCompleted({
        returnId: returnRequest.id,
        posSaleId: returnRequest.posSaleId,
        refundAmount: amount,
      });
    } catch (e) {
      this.logger.warn(
        `POS loyalty clawback failed for return ${returnRequest.id}: ${(e as Error).message}`,
      );
    }
  }

  private async approvePosReturn(
    id: string,
    returnRequest: any,
    refundAmount?: number,
    refundMethod?: string,
    userId?: string,
  ): Promise<ReturnRequest> {
    const policyProduct = this.resolvePosReturnPolicyProduct(returnRequest);
    const productId = policyProduct?.id;
    const policy = productId
      ? await this.returnPoliciesService.getApplicablePolicy(
          productId,
          policyProduct?.sellerId || returnRequest.posSale?.store?.sellerId || undefined,
          policyProduct?.categoryId || undefined,
        )
      : null;

    const saleLabel = this.posReturnLabel(returnRequest);

    if (policy?.requiresInspection) {
      await this.prisma.returnRequest.update({
        where: { id },
        data: {
          status: 'APPROVED' as any,
          refundMethod: refundMethod || 'IN_STORE',
        },
      });

      this.activityService
        ?.createLog({
          userId: userId || returnRequest.userId,
          action: 'RETURN_APPROVED',
          entityType: 'ReturnRequest',
          entityId: id,
          description: `Return approved (inspection required) for in-store purchase at ${saleLabel}`,
        })
        .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

      if (this.notificationsService) {
        this.notificationsService
          .sendNotificationToUser(
            returnRequest.userId,
            'RETURN_APPROVED',
            'Return approved — awaiting inspection',
            `Your in-store return at ${saleLabel} has been approved. Please bring the item(s) back to the store. Your refund will be processed after inspection.`,
            { returnId: id },
          )
          .catch((e) =>
            this.logger.warn(`Return approval notification failed: ${(e as Error).message}`),
          );
      }

      const updated = await this.prisma.returnRequest.findUnique({
        where: { id },
        include: {
          posSale: { include: POS_SALE_DETAIL_INCLUDE },
          items: { include: RETURN_ITEMS_INCLUDE },
        },
      });
      return this.mapToReturnType(updated);
    }

    const maxRefundable = this.calculatePosReturnRefundAmount(returnRequest);
    let amount = Math.min(refundAmount ?? maxRefundable, maxRefundable);
    const restockingFee = policy?.restockingFee != null ? Number(policy.restockingFee) : 0;
    if (restockingFee > 0) {
      amount = Math.max(0, Math.round((amount - restockingFee) * 100) / 100);
    }

    await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'APPROVED' as any,
        refundAmount: amount,
        refundMethod: refundMethod || 'IN_STORE',
      },
    });

    await this.triggerPosLoyaltyClawback(returnRequest, amount);

    this.activityService
      ?.createLog({
        userId: userId || returnRequest.userId,
        action: 'RETURN_APPROVED',
        entityType: 'ReturnRequest',
        entityId: id,
        description: `Return approved for in-store purchase at ${saleLabel}`,
        metadata: { refundAmount: amount },
      })
      .catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    if (this.notificationsService) {
      this.notificationsService
        .sendNotificationToUser(
          returnRequest.userId,
          'RETURN_APPROVED',
          'Return approved',
          `Your in-store return at ${saleLabel} has been approved.`,
          { returnId: id },
        )
        .catch((e) =>
          this.logger.warn(`Return approval notification failed: ${(e as Error).message}`),
        );
    }

    const updated = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        posSale: { include: POS_SALE_DETAIL_INCLUDE },
        items: { include: RETURN_ITEMS_INCLUDE },
      },
    });
    return this.mapToReturnType(updated);
  }

  private async completePosReturn(
    id: string,
    returnRequest: any,
    refundAmount?: number,
    refundMethod?: string,
  ): Promise<void> {
    const existing = returnRequest.refundAmount != null ? Number(returnRequest.refundAmount) : 0;
    const amount =
      refundAmount ?? (existing > 0 ? existing : this.calculatePosReturnRefundAmount(returnRequest));

    if (amount > 0 && !(existing > 0)) {
      await this.prisma.returnRequest.update({
        where: { id },
        data: {
          refundAmount: amount,
          refundMethod: refundMethod || returnRequest.refundMethod || 'IN_STORE',
        },
      });
    }

    await this.triggerPosLoyaltyClawback(returnRequest, amount);
  }

  private calculateReturnRefundAmount(returnRequest: any): number {
    if (this.isPosReturn(returnRequest)) {
      return this.calculatePosReturnRefundAmount(returnRequest);
    }
    const returnItems = returnRequest.items;
    if (returnItems && returnItems.length > 0) {
      let itemsTotal = 0;
      let orderItemsTotal = 0;
      const orderItems = returnRequest.order?.items || [];

      for (const ri of returnItems) {
        const orderItem = orderItems.find((oi: any) => oi.id === ri.orderItemId);
        if (orderItem) {
          itemsTotal += Number(orderItem.price) * (ri.quantity || 1);
        }
      }
      // Calculate total of all order items for proportion
      for (const oi of orderItems) {
        orderItemsTotal += Number(oi.price) * Number(oi.quantity || 1);
      }

      if (itemsTotal > 0 && orderItemsTotal > 0) {
        const proportion = itemsTotal / orderItemsTotal;
        // Prefer order.total so discounts are reflected in the refund base.
        const orderTotal = Number(returnRequest.order?.total ?? 0);
        if (orderTotal > 0) {
          return Math.round(orderTotal * proportion * 100) / 100;
        }
        const tax = Number(returnRequest.order?.tax || 0) * proportion;
        const shipping =
          Number(returnRequest.order?.shippingAmount ?? returnRequest.order?.shippingCost ?? 0) *
          proportion;
        return Math.round((itemsTotal + tax + shipping) * 100) / 100;
      }
      if (itemsTotal > 0) return itemsTotal;
    }
    return Number(returnRequest.order?.total ?? 0);
  }

  private buildReturnTimeline(returnRequest: any): ReturnTimelineStep[] {
    const status = String(returnRequest.status || '').toUpperCase();
    const refundTx = returnRequest.transactions?.find(
      (t: any) => String(t.status).toUpperCase() === 'COMPLETED',
    );
    const failedRefundTx = returnRequest.transactions?.find(
      (t: any) => String(t.status).toUpperCase() === 'FAILED',
    );
    const afterApproved = [
      'APPROVED',
      'AWAITING_CUSTOMER_RETURN',
      'ITEM_RECEIVED',
      'REFUND_PENDING',
      'PROCESSING',
      'COMPLETED',
    ];
    const afterAwaitingReturn = [
      'AWAITING_CUSTOMER_RETURN',
      'ITEM_RECEIVED',
      'REFUND_PENDING',
      'PROCESSING',
      'COMPLETED',
    ];
    const afterItemReceived = ['ITEM_RECEIVED', 'REFUND_PENDING', 'PROCESSING', 'COMPLETED'];
    const afterRefundPending = ['REFUND_PENDING', 'PROCESSING', 'COMPLETED'];

    // Handle cancelled returns
    if (status === 'CANCELLED') {
      return [
        {
          step: 'REQUESTED',
          label: 'Return Requested',
          at: returnRequest.createdAt,
          completed: true,
        },
        {
          step: 'CANCELLED',
          label: 'Return cancelled',
          at: returnRequest.updatedAt,
          completed: true,
        },
      ];
    }

    // Handle rejected returns
    if (status === 'REJECTED') {
      return [
        {
          step: 'REQUESTED',
          label: 'Return Requested',
          at: returnRequest.createdAt,
          completed: true,
        },
        {
          step: 'REVIEW',
          label: 'Under Review',
          at: returnRequest.createdAt,
          completed: true,
        },
        {
          step: 'REJECTED',
          label: 'Return Rejected',
          at: returnRequest.updatedAt,
          completed: true,
        },
      ];
    }

    // Normal flow timeline
    const steps: ReturnTimelineStep[] = [
      {
        step: 'REQUESTED',
        label: 'Return Requested',
        at: returnRequest.createdAt,
        completed: true,
      },
      {
        step: 'REVIEW',
        label: 'Under Review',
        at: returnRequest.createdAt,
        completed: status !== 'PENDING',
      },
      {
        step: 'APPROVED',
        label: 'Return Approved',
        at: afterApproved.includes(status) ? returnRequest.updatedAt : undefined,
        completed: afterApproved.includes(status),
      },
      {
        step: 'AWAITING_CUSTOMER_RETURN',
        label: returnRequest.trackingNumber
          ? `Awaiting Customer Return (${returnRequest.carrier || 'Tracking'}: ${returnRequest.trackingNumber})`
          : 'Awaiting Customer Return',
        at:
          returnRequest.shippedAt ||
          (afterAwaitingReturn.includes(status) ? returnRequest.updatedAt : undefined),
        completed: !!returnRequest.shippedAt || afterAwaitingReturn.includes(status),
      },
      {
        step: 'ITEM_RECEIVED',
        label: 'Item Received',
        at:
          returnRequest.receivedAt ||
          (afterItemReceived.includes(status) ? returnRequest.updatedAt : undefined),
        completed: !!returnRequest.receivedAt || afterItemReceived.includes(status),
      },
      {
        step: 'REFUND_PENDING',
        label: failedRefundTx
          ? 'Refund failed — retry required'
          : refundTx
            ? 'Refund Completed'
            : 'Refund Pending',
        at:
          refundTx?.createdAt ||
          failedRefundTx?.createdAt ||
          (afterRefundPending.includes(status) ? returnRequest.updatedAt : undefined),
        completed: !!refundTx || status === 'COMPLETED',
      },
      {
        step: 'COMPLETED',
        label: 'Return Completed',
        at: returnRequest.processedAt || undefined,
        completed: status === 'COMPLETED',
      },
    ];
    return steps;
  }

  private returnSourceLabel(returnRequest: any): string {
    if (this.isPosReturn(returnRequest)) {
      return (
        returnRequest.posSale?.store?.name ||
        returnRequest.posSale?.externalInvoice ||
        returnRequest.posSale?.externalSaleId ||
        returnRequest.posSaleId
      );
    }
    return returnRequest.order?.orderNumber || returnRequest.orderId;
  }

  private mapToReturnType(returnRequest: any): ReturnRequest {
    const refundTransactions = (returnRequest.transactions || []).map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      status: t.status,
      currency: t.currency,
      createdAt: t.createdAt,
      stripeRefundId:
        (t.metadata as any)?.stripeRefundId || (t.metadata as any)?.refundId || undefined,
    }));

    return {
      id: returnRequest.id,
      orderId: returnRequest.orderId || undefined,
      posSaleId: returnRequest.posSaleId || undefined,
      userId: returnRequest.userId,
      reason: returnRequest.reason,
      status: returnRequest.status.toLowerCase(),
      refundAmount: returnRequest.refundAmount ? Number(returnRequest.refundAmount) : undefined,
      refundMethod: returnRequest.refundMethod || undefined,
      notes: returnRequest.notes || undefined,
      processedAt: returnRequest.processedAt || undefined,
      createdAt: returnRequest.createdAt,
      updatedAt: returnRequest.updatedAt,
      order: returnRequest.order
        ? {
            id: returnRequest.order.id,
            orderNumber: returnRequest.order.orderNumber,
            total:
              returnRequest.order.total != null ? Number(returnRequest.order.total) : undefined,
            currency: returnRequest.order.currency,
            paymentStatus: returnRequest.order.paymentStatus,
          }
        : undefined,
      posSale: returnRequest.posSale
        ? {
            id: returnRequest.posSale.id,
            externalInvoice: returnRequest.posSale.externalInvoice || undefined,
            externalSaleId: returnRequest.posSale.externalSaleId || undefined,
            total:
              returnRequest.posSale.totalAmount != null
                ? Number(returnRequest.posSale.totalAmount)
                : undefined,
            currency: returnRequest.posSale.currency,
            saleDate: returnRequest.posSale.saleDate,
            status: returnRequest.posSale.status,
            store: returnRequest.posSale.store
              ? {
                  id: returnRequest.posSale.store.id,
                  name: returnRequest.posSale.store.name,
                  code: returnRequest.posSale.store.code,
                }
              : undefined,
            items: returnRequest.posSale.items?.map((item: any) => ({
              id: item.id,
              name: item.name,
              sku: item.sku || undefined,
              quantity: item.quantity,
              unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
              totalPrice: item.totalPrice != null ? Number(item.totalPrice) : undefined,
            })),
          }
        : undefined,
      items: returnRequest.items?.map((ri: any) => ({
        id: ri.id,
        quantity: ri.quantity,
        reason: ri.reason,
        productName:
          ri.orderItem?.product?.name || ri.posSaleItem?.product?.name || ri.posSaleItem?.name,
        orderItemId: ri.orderItemId || undefined,
        posSaleItemId: ri.posSaleItemId || undefined,
      })),
      refundTransactions,
      timeline: this.buildReturnTimeline(returnRequest),
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
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

interface ReturnTimelineStep {
  step: string;
  label: string;
  at?: Date;
  completed: boolean;
}

interface ReturnRequest {
  id: string;
  orderId: string;
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
  items?: Array<{
    id: string;
    quantity: number;
    reason?: string;
    productName?: string;
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
  ) {}

  private getOrdersService(): OrdersService {
    return this.moduleRef.get(OrdersService, { strict: false });
  }

  async create(userId: string, createReturnDto: CreateReturnDto): Promise<ReturnRequest> {
    // Verify order exists and belongs to user
    const order = await this.prisma.order.findFirst({
      where: {
        id: createReturnDto.orderId,
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
      createReturnDto.orderId,
      createReturnDto.items?.[0]
        ? order.items.find((i) => i.id === createReturnDto.items![0].orderItemId)?.productId
        : order.items[0]?.productId,
    );
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason || 'Return is not allowed for this order');
    }
    const applicablePolicyId = eligibility.policy?.id;

    // If item-level returns are specified, validate them
    if (createReturnDto.items && createReturnDto.items.length > 0) {
      // Validate each item
      for (const returnItem of createReturnDto.items) {
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
                in: ['PENDING', 'APPROVED', 'PROCESSING'],
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
          orderId: createReturnDto.orderId,
          status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
        },
      });

      if (existingReturn) {
        throw new BadRequestException('An active return request already exists for this order');
      }
    }

    // Create return request
    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        orderId: createReturnDto.orderId,
        userId,
        reason: createReturnDto.reason,
        notes: createReturnDto.notes,
        status: 'PENDING',
        returnPolicyId: applicablePolicyId,
        items: createReturnDto.items
          ? {
              create: createReturnDto.items.map((item) => ({
                orderItemId: item.orderItemId,
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

    this.activityService?.createLog({
      userId,
      action: 'RETURN_REQUESTED',
      entityType: 'ReturnRequest',
      entityId: returnRequest.id,
      description: `Return requested for order ${order.orderNumber || order.id}`,
      metadata: { orderId: order.id, reason: createReturnDto.reason },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    if (this.notificationsService) {
      this.notificationsService.sendNotificationToUser(
        userId,
        'RETURN_REQUESTED',
        'Return request received',
        `Your return request for order ${order.orderNumber || order.id} has been submitted and is pending review.`,
        { returnId: returnRequest.id, orderId: order.id },
      ).catch((e) => this.logger.warn(`Return notification failed: ${(e as Error).message}`));

      if (order.sellerId) {
        const seller = await this.prisma.seller.findUnique({ where: { id: order.sellerId }, select: { userId: true } });
        if (seller?.userId) {
          this.notificationsService.sendNotificationToUser(
            seller.userId,
            'RETURN_REQUESTED',
            'New return request',
            `A customer has requested a return for order ${order.orderNumber || order.id}. Please review it in your returns dashboard.`,
            { returnId: returnRequest.id, orderId: order.id },
          ).catch((e) => this.logger.warn(`Seller return notification failed: ${(e as Error).message}`));
        }
      }

      this.notificationsService.sendNotificationToRole(
        'ADMIN',
        'RETURN_REQUESTED',
        'New return request',
        `A return has been requested for order ${order.orderNumber || order.id}. Review pending in the returns management queue.`,
        { returnId: returnRequest.id, orderId: order.id },
      ).catch((e) => this.logger.warn(`Admin return notification failed: ${(e as Error).message}`));
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
        where.order = {
          OR: [
            { sellerId: seller.id },
            { childOrders: { some: { sellerId: seller.id } } },
          ],
        };
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
        order: { include: { items: true, seller: true } },
        items: true,
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (userId && role && role !== 'ADMIN') {
      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      if (sellerRoles.includes(role)) {
        const seller = await this.prisma.seller.findUnique({ where: { userId } });
        // Check direct sellerId OR if seller has a child order for this parent order
        const isDirectSeller = seller && returnRequest.order?.sellerId === seller.id;
        const hasChildOrder = seller && returnRequest.order?.id
          ? await this.prisma.order.count({
              where: { parentOrderId: returnRequest.order.id, sellerId: seller.id },
            }) > 0
          : false;
        if (!seller || (!isDirectSeller && !hasChildOrder)) {
          throw new ForbiddenException('You do not have permission to update this return');
        }
      }
    }

    const validTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'CANCELLED'],
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
      const policy = returnRequest.order
        ? await this.returnPoliciesService.getApplicablePolicy(
            returnRequest.order.items[0]?.productId || '',
            returnRequest.order.sellerId || undefined,
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

        this.activityService?.createLog({
          userId: userId || returnRequest.userId,
          action: 'RETURN_APPROVED',
          entityType: 'ReturnRequest',
          entityId: id,
          description: `Return approved (inspection required) for order ${returnRequest.order.orderNumber || returnRequest.orderId}`,
        }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

        if (this.notificationsService) {
          this.notificationsService.sendNotificationToUser(
            returnRequest.userId,
            'RETURN_APPROVED',
            'Return approved — awaiting inspection',
            `Your return for order ${returnRequest.order.orderNumber || returnRequest.orderId} has been approved. Please ship the item(s) back. Your refund will be processed after inspection.`,
            { returnId: id },
          ).catch((e) => this.logger.warn(`Return approval notification failed: ${(e as Error).message}`));
        }

        const updated = await this.prisma.returnRequest.findUnique({ where: { id } });
        return this.mapToReturnType(updated);
      }

      const maxRefundable = this.calculateReturnRefundAmount(returnRequest);
      let amount = Math.min(refundAmount ?? maxRefundable, maxRefundable);

      if (policy?.restockingFee) {
        amount = Math.max(0, Math.round((amount - Number(policy.restockingFee)) * 100) / 100);
      }
      if (amount <= 0) {
        throw new BadRequestException('No refundable amount for the returned items');
      }

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
            notes: refundSucceeded
              ? returnRequest.notes
              : [
                  returnRequest.notes || '',
                  `[Refund pending: ${refundResult.error || 'Stripe refund failed — manual retry required'}]`,
                ]
                  .filter(Boolean)
                  .join(' '),
          },
        });

        if (refundSucceeded) {
          await this.applyRestockForReturn(tx, returnRequest);
          const isPartial = returnRequest.items?.length > 0 &&
            returnRequest.items.length < (returnRequest.order?.items?.length ?? 0);
          await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
        }
      });

      if (refundSucceeded) {
        try {
          await this.getOrdersService().reverseInfluencerAttribution(returnRequest.orderId);
        } catch (commErr) {
          this.logger.error(
            `Influencer attribution reversal failed for refunded order ${returnRequest.orderId}: ${(commErr as Error).message}`,
          );
        }
      }

      this.activityService?.createLog({
        userId: userId || returnRequest.userId,
        action: 'RETURN_APPROVED',
        entityType: 'ReturnRequest',
        entityId: id,
        description: `Return approved for order ${returnRequest.order.orderNumber || returnRequest.orderId}`,
        metadata: { refundAmount: amount, refundSucceeded },
      }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

      if (this.notificationsService) {
        this.notificationsService.sendNotificationToUser(
          returnRequest.userId,
          'RETURN_APPROVED',
          refundSucceeded ? 'Return approved' : 'Return approved — refund pending',
          refundSucceeded
            ? `Your return for order ${returnRequest.order.orderNumber || returnRequest.orderId} has been approved. Your refund is being processed.`
            : `Your return for order ${returnRequest.order.orderNumber || returnRequest.orderId} was approved, but the automatic refund could not be completed. Our team will process it shortly.`,
          { returnId: id, refundSucceeded },
        ).catch((e) => this.logger.warn(`Return approval notification failed: ${(e as Error).message}`));
      }

      const updated = await this.prisma.returnRequest.findUnique({ where: { id } });
      return this.mapToReturnType(updated);
    }

    // Determine whether refund+restock were already completed on APPROVE
    // (i.e. immediate-approval path where Stripe succeeded).
    // A refund transaction with status COMPLETED is the definitive signal.
    const refundFullyProcessed = returnRequest.refundAmount
      && Number(returnRequest.refundAmount) > 0
      && await this.prisma.transaction.count({
          where: { returnId: id, type: 'REFUND', status: 'COMPLETED' },
        }).then(c => c > 0).catch(() => false);

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

      if (newStatus === 'COMPLETED' && returnRequest.order && refundFullyProcessed) {
        const isPartial = returnRequest.items?.length > 0 &&
          returnRequest.items.length < (returnRequest.order?.items?.length ?? 0);
        await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
      }

      return result;
    });

    // If transitioning to COMPLETED and no successful refund exists yet
    // (inspection flow), process refund + restock + mark order now.
    if (newStatus === 'COMPLETED' && returnRequest.order && !refundFullyProcessed) {
      const policy = await this.returnPoliciesService.getApplicablePolicy(
        returnRequest.order.items[0]?.productId || '',
        returnRequest.order.sellerId || undefined,
      );
      const maxRefundable = this.calculateReturnRefundAmount(returnRequest);
      let amount = Math.min(refundAmount ?? maxRefundable, maxRefundable);
      if (policy?.restockingFee) {
        amount = Math.max(0, Math.round((amount - Number(policy.restockingFee)) * 100) / 100);
      }
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
              const isPartial = returnRequest.items?.length > 0 &&
                returnRequest.items.length < (returnRequest.order?.items?.length ?? 0);
              await this.markOrderRefundedInTx(tx, returnRequest.orderId, isPartial);
            });
            await this.prisma.returnRequest.update({
              where: { id },
              data: { refundAmount: amount, refundMethod: refundMethod || 'ORIGINAL_PAYMENT' },
            });
            try {
              await this.getOrdersService().reverseInfluencerAttribution(returnRequest.orderId);
            } catch (commErr) {
              this.logger.error(
                `Influencer attribution reversal failed for completed return order ${returnRequest.orderId}: ${(commErr as Error).message}`,
              );
            }
          } else {
            await this.prisma.returnRequest.update({
              where: { id },
              data: {
                refundAmount: amount,
                notes: [
                  returnRequest.notes || '',
                  `[Refund pending: ${refundResult.error || 'Stripe refund failed — manual retry required'}]`,
                ].filter(Boolean).join(' '),
              },
            });
          }
        } catch (e) {
          this.logger.error(`Refund on completion failed for return ${id}: ${(e as Error).message}`);
        }
      }
    }

    if (this.notificationsService && ['REJECTED', 'COMPLETED'].includes(newStatus)) {
      const orderLabel = returnRequest.order?.orderNumber || returnRequest.orderId;
      const title = newStatus === 'REJECTED' ? 'Return request rejected' : 'Return completed';
      let message: string;
      if (newStatus === 'REJECTED') {
        message = `Your return request for order ${orderLabel} has been rejected.${notes ? ` Reason: ${notes}` : ''}`;
      } else if (refundFullyProcessed) {
        message = `Your return for order ${orderLabel} has been completed. Your refund was already processed.`;
      } else {
        message = `Your return for order ${orderLabel} has been completed and your refund is being processed.`;
      }
      this.notificationsService.sendNotificationToUser(
        returnRequest.userId,
        newStatus === 'REJECTED' ? 'RETURN_REJECTED' : 'RETURN_COMPLETED',
        title,
        message,
        { returnId: id },
      ).catch((e) => this.logger.warn(`Return ${newStatus} notification failed: ${(e as Error).message}`));
    }

    this.activityService?.createLog({
      userId: userId || returnRequest.userId,
      action: `RETURN_${newStatus}`,
      entityType: 'ReturnRequest',
      entityId: id,
      description: `Return ${newStatus.toLowerCase()} for order ${returnRequest.order?.orderNumber || returnRequest.orderId}`,
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

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

  async retryReturnRefund(
    id: string,
    userId?: string,
    role?: string,
  ): Promise<ReturnRequest> {
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
        const isPartial = fullReturn?.items?.length > 0 &&
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

    this.activityService?.createLog({
      userId: userId || returnRequest.userId,
      action: 'RETURN_REFUND_RETRY',
      entityType: 'ReturnRequest',
      entityId: id,
      description: `Refund retry for return ${id}: ${refundResult.stripeRefundSucceeded ? 'succeeded' : 'failed'}`,
      metadata: { refundSucceeded: refundResult.stripeRefundSucceeded, error: refundResult.error },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    const updated = await this.prisma.returnRequest.findUnique({ where: { id } });
    return this.mapToReturnType(updated);
  }

  private async markOrderRefundedInTx(tx: any, orderId: string, isPartial?: boolean) {
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

  private calculateReturnRefundAmount(returnRequest: any): number {
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
        // Add proportional tax and shipping
        const proportion = itemsTotal / orderItemsTotal;
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

    // Handle cancelled returns
    if (status === 'CANCELLED') {
      return [
        {
          step: 'REQUESTED',
          label: 'Return requested',
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
          label: 'Return requested',
          at: returnRequest.createdAt,
          completed: true,
        },
        {
          step: 'REVIEW',
          label: 'Under review',
          at: returnRequest.createdAt,
          completed: true,
        },
        {
          step: 'REJECTED',
          label: 'Return rejected',
          at: returnRequest.updatedAt,
          completed: true,
        },
      ];
    }

    // Normal flow timeline
    const steps: ReturnTimelineStep[] = [
      {
        step: 'REQUESTED',
        label: 'Return requested',
        at: returnRequest.createdAt,
        completed: true,
      },
      {
        step: 'REVIEW',
        label: 'Under review',
        at: returnRequest.createdAt,
        completed: status !== 'PENDING',
      },
      {
        step: 'APPROVED',
        label: 'Return approved',
        at: ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(status)
          ? returnRequest.updatedAt
          : undefined,
        completed: ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(status),
      },
      {
        step: 'SHIPPED',
        label: returnRequest.trackingNumber
          ? `Shipped (${returnRequest.carrier || 'Tracking'}: ${returnRequest.trackingNumber})`
          : (['PROCESSING', 'COMPLETED'].includes(status) || returnRequest.shippedAt ? 'Shipped' : 'Awaiting shipment'),
        at: returnRequest.shippedAt || (['PROCESSING', 'COMPLETED'].includes(status) ? returnRequest.updatedAt : undefined),
        // Mark completed if we have shipping evidence OR status indicates shipping has occurred
        completed: !!returnRequest.shippedAt || ['PROCESSING', 'COMPLETED'].includes(status),
      },
      {
        step: 'RECEIVED',
        label: 'Package received',
        at: returnRequest.receivedAt || (['PROCESSING', 'COMPLETED'].includes(status) ? returnRequest.updatedAt : undefined),
        // Mark completed if we have received evidence OR status indicates item was received
        completed: !!returnRequest.receivedAt || ['PROCESSING', 'COMPLETED'].includes(status),
      },
      {
        step: 'INSPECTED',
        label: 'Inspection complete',
        at: returnRequest.inspectedAt || (status === 'COMPLETED' ? returnRequest.processedAt || returnRequest.updatedAt : undefined),
        completed: !!returnRequest.inspectedAt || status === 'COMPLETED',
      },
      {
        step: 'REFUND',
        label: failedRefundTx
          ? 'Refund failed — retry required'
          : refundTx
            ? 'Refund processed'
            : 'Refund pending',
        at: refundTx?.createdAt || failedRefundTx?.createdAt,
        completed: !!refundTx || status === 'COMPLETED',
      },
      {
        step: 'COMPLETED',
        label: 'Return completed',
        at: returnRequest.processedAt || undefined,
        completed: status === 'COMPLETED',
      },
    ];
    return steps;
  }

  private mapToReturnType(returnRequest: any): ReturnRequest {
    const refundTransactions = (returnRequest.transactions || []).map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      status: t.status,
      currency: t.currency,
      createdAt: t.createdAt,
      stripeRefundId:
        (t.metadata as any)?.stripeRefundId ||
        (t.metadata as any)?.refundId ||
        undefined,
    }));

    return {
      id: returnRequest.id,
      orderId: returnRequest.orderId,
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
            total: returnRequest.order.total != null ? Number(returnRequest.order.total) : undefined,
            currency: returnRequest.order.currency,
            paymentStatus: returnRequest.order.paymentStatus,
          }
        : undefined,
      items: returnRequest.items?.map((ri: any) => ({
        id: ri.id,
        quantity: ri.quantity,
        reason: ri.reason,
        productName: ri.orderItem?.product?.name,
      })),
      refundTransactions,
      timeline: this.buildReturnTimeline(returnRequest),
    };
  }
}

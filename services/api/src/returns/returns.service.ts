import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { NotificationsService } from '../notifications/notifications.service';

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
}

@Injectable()
export class ReturnsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createReturnDto: CreateReturnDto): Promise<ReturnRequest> {
    // Verify order exists and belongs to user
    const order = await this.prisma.order.findFirst({
      where: {
        id: createReturnDto.orderId,
        userId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order is eligible for return (e.g., delivered, not already returned)
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Order must be delivered to request a return');
    }

    // Check if return already exists for this order
    const existingReturn = await this.prisma.returnRequest.findFirst({
      where: {
        orderId: createReturnDto.orderId,
      },
    });

    if (existingReturn) {
      throw new BadRequestException('Return request already exists for this order');
    }

    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        orderId: createReturnDto.orderId,
        userId,
        reason: createReturnDto.reason,
        notes: createReturnDto.notes,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    // Send notification to customer
    await this.notificationsService.sendReturnRequested(returnRequest.id);

    return this.mapToReturnType(returnRequest);
  }

  async findAll(userId: string, role: string): Promise<ReturnRequest[]> {
    const where: any = {};

    if (role === 'CUSTOMER') {
      where.userId = userId;
    }

    const returns = await this.prisma.returnRequest.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
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
        order: true,
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    // Check permissions
    if (role === 'CUSTOMER' && returnRequest.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this return');
    }

    return this.mapToReturnType(returnRequest);
  }

  async updateStatus(
    id: string,
    status: string,
    refundAmount?: number,
    refundMethod?: string,
  ): Promise<ReturnRequest> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: status.toUpperCase() as any,
        refundAmount: refundAmount ? refundAmount : undefined,
        refundMethod,
        processedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    });

    // If approved and refund amount set, update order payment status
    if (status === 'APPROVED' && refundAmount) {
      await this.prisma.order.update({
        where: { id: returnRequest.orderId },
        data: {
          paymentStatus: 'REFUNDED',
        },
      });
    }

    // Send notification based on status change
    const returnRequestWithUser = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    if (returnRequestWithUser) {
      if (status === 'APPROVED') {
        await this.notificationsService.sendReturnApproved(returnRequestWithUser.id);
      } else if (status === 'COMPLETED') {
        await this.notificationsService.sendReturnCompleted(returnRequestWithUser.id);
      } else if (status === 'REJECTED') {
        await this.notificationsService.sendReturnRejected(returnRequestWithUser.id);
      }
    }

    return this.mapToReturnType(updated);
  }

  private mapToReturnType(returnRequest: any): ReturnRequest {
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
    };
  }
}



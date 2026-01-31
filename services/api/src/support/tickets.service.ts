import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async generateTicketNumber(): Promise<string> {
    const prefix = 'TKT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  async createTicket(data: {
    userId?: string;
    sellerId?: string;
    orderId?: string;
    subject: string;
    category:
      | 'ORDER_INQUIRY'
      | 'PRODUCT_QUESTION'
      | 'RETURN_REQUEST'
      | 'PAYMENT_ISSUE'
      | 'TECHNICAL_SUPPORT'
      | 'SELLER_SUPPORT'
      | 'OTHER';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    initialMessage: string;
  }) {
    const ticketNumber = await this.generateTicketNumber();

    // Calculate SLA due date (24 hours for URGENT, 48 hours for HIGH, 72 hours for others)
    const slaHours = data.priority === 'URGENT' ? 24 : data.priority === 'HIGH' ? 48 : 72;
    const slaDueAt = new Date();
    slaDueAt.setHours(slaDueAt.getHours() + slaHours);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: data.userId,
        sellerId: data.sellerId,
        orderId: data.orderId,
        subject: data.subject,
        category: data.category,
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
        slaDueAt,
        messages: {
          create: {
            userId: data.userId,
            content: data.initialMessage,
            isInternal: false,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return ticket;
  }

  async getTickets(filters?: {
    userId?: string;
    sellerId?: string;
    orderId?: string;
    category?: string;
    priority?: string;
    status?: string;
    assignedTo?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
            },
          },
          assignedAgent: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async updateTicket(
    id: string,
    data: {
      subject?: string;
      category?: string;
      priority?: string;
      status?: string;
    },
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Cast category to enum if provided
    const updateData: any = { ...data };
    if (updateData.category && typeof updateData.category === 'string') {
      updateData.category = updateData.category as any; // Type assertion for enum
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async addMessage(
    ticketId: string,
    data: {
      userId?: string;
      content: string;
      isInternal?: boolean;
      attachments?: any;
    },
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Update ticket status if needed
    const statusUpdate: any = {};
    if (ticket.status === 'OPEN' && data.userId) {
      // If user is replying, set to IN_PROGRESS
      statusUpdate.status = 'IN_PROGRESS';
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        userId: data.userId,
        content: data.content,
        isInternal: data.isInternal || false,
        attachments: data.attachments || {},
      },
    });

    // Update ticket
    if (Object.keys(statusUpdate).length > 0) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: statusUpdate,
      });
    }

    return this.prisma.ticketMessage.findUnique({
      where: { id: message.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async assignTicket(ticketId: string, assignedTo: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verify agent exists
    const agent = await this.prisma.user.findUnique({
      where: { id: assignedTo },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo,
        status: 'ASSIGNED',
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async updateTicketStatus(
    ticketId: string,
    status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED',
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updateData: any = { status };
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}

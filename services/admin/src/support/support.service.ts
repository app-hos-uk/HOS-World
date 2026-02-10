import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminPrismaService } from '../database/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: AdminPrismaService) {}

  async createTicket(userId: string, data: { subject: string; description?: string; category?: string; priority?: string }) {
    return this.prisma.supportTicket.create({ data: { userId, ...data } });
  }

  async findAll(filters: { status?: string; userId?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.userId = filters.userId;
    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({ where, include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { tickets, pagination: { page, limit, total } };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async addMessage(ticketId: string, senderId: string, content: string, isInternal = false) {
    await this.findOne(ticketId);
    return this.prisma.ticketMessage.create({ data: { ticketId, senderId, content, isInternal } });
  }

  async updateStatus(id: string, status: string, assignedTo?: string) {
    await this.findOne(id);
    const data: any = { status };
    if (assignedTo) data.assignedTo = assignedTo;
    if (status === 'RESOLVED') data.resolvedAt = new Date();
    return this.prisma.supportTicket.update({ where: { id }, data });
  }

  async getKnowledgeBase(category?: string) {
    return this.prisma.knowledgeBaseArticle.findMany({
      where: { isPublished: true, ...(category ? { category } : {}) },
      orderBy: { views: 'desc' },
    });
  }
}

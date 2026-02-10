import { Injectable } from '@nestjs/common';
import { AdminPrismaService } from '../database/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private prisma: AdminPrismaService) {}

  async log(data: { userId?: string; action: string; entity?: string; entityId?: string; details?: any; ipAddress?: string; userAgent?: string }) {
    return this.prisma.activityLog.create({ data });
  }

  async findAll(filters: { userId?: string; action?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

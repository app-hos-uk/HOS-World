import { Injectable, Logger } from '@nestjs/common';
import { AdminPrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(private prisma: AdminPrismaService) {}

  async getDashboard() {
    const [totalActivity, ticketsOpen, ticketsTotal] = await Promise.all([
      this.prisma.activityLog.count(),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count(),
    ]);
    return { totalActivity, tickets: { open: ticketsOpen, total: ticketsTotal }, timestamp: new Date().toISOString() };
  }

  async getActivityTimeline(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.activityLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });
    return logs.map((l) => ({ action: l.action, count: l._count.id }));
  }
}

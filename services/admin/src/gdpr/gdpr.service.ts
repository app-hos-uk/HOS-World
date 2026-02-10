import { Injectable } from '@nestjs/common';
import { AdminPrismaService } from '../database/prisma.service';

@Injectable()
export class GdprService {
  constructor(private prisma: AdminPrismaService) {}

  async logConsent(userId: string, consentType: string, granted: boolean, ipAddress?: string) {
    return this.prisma.gDPRConsentLog.create({ data: { userId, consentType, granted, ipAddress } });
  }

  async getUserConsents(userId: string) {
    return this.prisma.gDPRConsentLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async exportUserData(userId: string) {
    const [consents, activity, tickets] = await Promise.all([
      this.prisma.gDPRConsentLog.findMany({ where: { userId } }),
      this.prisma.activityLog.findMany({ where: { userId } }),
      this.prisma.supportTicket.findMany({ where: { userId }, include: { messages: true } }),
    ]);
    return { userId, consents, activity, tickets, exportedAt: new Date().toISOString() };
  }
}

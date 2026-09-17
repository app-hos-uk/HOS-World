import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessagingService } from '../../messaging/messaging.service';
import { TemplatesService } from '../../templates/templates.service';

export type LoyaltyMemberEmailRecipient = {
  userId: string;
  email: string | null;
  firstName: string | null;
  cardNumber: string | null;
  pointsBalance: number;
  tierName: string;
};

export type LoyaltyMemberEmailSendResult = {
  targeted: number;
  sent: number;
  failed: number;
  skippedConsent: number;
  errors: string[];
};

export type LoyaltyMemberEmailSendParams = {
  templateSlug: string;
  subject?: string;
  memberIds?: string[];
  sendToAll?: boolean;
  search?: string;
  onlyUnverified?: boolean;
  dryRun?: boolean;
};

@Injectable()
export class LoyaltyMemberEmailService {
  constructor(
    private prisma: PrismaService,
    private messaging: MessagingService,
    private templates: TemplatesService,
    private config: ConfigService,
  ) {}

  private recipientCap(): number {
    return this.config.get<number>('LOYALTY_MEMBER_EMAIL_CAP', 2000);
  }

  private loginUrl(): string {
    return this.config.get<string>('LOYALTY_LOGIN_URL', 'https://join.houseofspells.com');
  }

  buildMemberSearchWhere(
    search?: string,
    onlyUnverified?: boolean,
  ): Prisma.LoyaltyMembershipWhereInput | undefined {
    const term = search?.trim() || '';
    const parts = term.split(/\s+/).filter(Boolean);
    const searchWhere: Prisma.LoyaltyMembershipWhereInput | undefined = term
      ? {
          OR: [
            { user: { email: { contains: term, mode: 'insensitive' } } },
            { user: { firstName: { contains: term, mode: 'insensitive' } } },
            { user: { lastName: { contains: term, mode: 'insensitive' } } },
            { cardNumber: { contains: term, mode: 'insensitive' } },
            ...(parts.length >= 2
              ? [
                  {
                    AND: [
                      { user: { firstName: { contains: parts[0], mode: 'insensitive' as const } } },
                      {
                        user: {
                          lastName: {
                            contains: parts.slice(1).join(' '),
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      : undefined;

    if (onlyUnverified) {
      const unverified = { user: { emailVerified: false } };
      if (searchWhere) {
        return { AND: [searchWhere, unverified] };
      }
      return unverified;
    }

    return searchWhere;
  }

  async resolveRecipients(params: LoyaltyMemberEmailSendParams): Promise<LoyaltyMemberEmailRecipient[]> {
    const cap = this.recipientCap();
    const ids = params.memberIds?.filter(Boolean) ?? [];

    if (ids.length > 0) {
      const rows = await this.prisma.loyaltyMembership.findMany({
        where: { userId: { in: ids } },
        select: this.recipientSelect(),
      });
      if (rows.length < ids.length) {
        const found = new Set(rows.map((r) => r.userId));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) {
          throw new BadRequestException(
            `No loyalty membership found for: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
          );
        }
      }
      return rows.map((r) => this.toRecipient(r));
    }

    if (!params.sendToAll) {
      throw new BadRequestException('Provide memberIds or set sendToAll to true');
    }

    const where = this.buildMemberSearchWhere(params.search, params.onlyUnverified);
    const total = await this.prisma.loyaltyMembership.count({ where });
    if (total > cap) {
      throw new BadRequestException(
        `Send would target ${total} members; maximum is ${cap}. Narrow your search or select specific members.`,
      );
    }

    const rows = await this.prisma.loyaltyMembership.findMany({
      where,
      select: this.recipientSelect(),
      orderBy: { enrolledAt: 'desc' },
      take: cap,
    });
    return rows.map((r) => this.toRecipient(r));
  }

  async sendMemberEmails(params: LoyaltyMemberEmailSendParams): Promise<LoyaltyMemberEmailSendResult> {
    const template = await this.templates.getTemplate(params.templateSlug);
    if (template.channel !== 'EMAIL') {
      throw new BadRequestException(`Template "${params.templateSlug}" is not an EMAIL template`);
    }

    const recipients = await this.resolveRecipients(params);
    const result: LoyaltyMemberEmailSendResult = {
      targeted: recipients.length,
      sent: 0,
      failed: 0,
      skippedConsent: 0,
      errors: [],
    };

    if (recipients.length === 0) {
      return result;
    }

    const loginUrl = this.loginUrl();
    const verifyHint = `Log in at ${loginUrl.replace(/^https?:\/\//, '')} and check your inbox for the verification link, or request a new one from your account settings.`;

    for (const member of recipients) {
      const templateVars: Record<string, string> = {
        firstName: member.firstName || 'Member',
        email: member.email || '',
        tierName: member.tierName,
        pointsBalance: String(member.pointsBalance),
        cardNumber: member.cardNumber || '—',
        loginUrl,
        verifyHint,
        messageHtml: '<p>We have an update for you in The Enchanted Circle.</p>',
      };

      if (params.dryRun) {
        const allowed = await this.messaging.canSendMarketing(member.userId, 'EMAIL');
        if (!allowed) {
          result.skippedConsent++;
          continue;
        }
        if (!member.email) {
          result.failed++;
          result.errors.push(`${member.userId}: No email`);
          continue;
        }
        result.sent++;
        continue;
      }

      const sendResult = await this.messaging.send({
        userId: member.userId,
        channel: 'EMAIL',
        templateSlug: params.templateSlug,
        templateVars,
        subject: params.subject,
      });

      if (sendResult.error === 'SKIPPED_CONSENT') {
        result.skippedConsent++;
      } else if (sendResult.success) {
        result.sent++;
      } else {
        result.failed++;
        const label = member.email || member.userId;
        result.errors.push(`${label}: ${sendResult.error || 'Send failed'}`);
      }
    }

    return result;
  }

  private recipientSelect() {
    return {
      userId: true,
      cardNumber: true,
      currentBalance: true,
      user: { select: { email: true, firstName: true } },
      tier: { select: { name: true } },
    } as const;
  }

  private toRecipient(row: {
    userId: string;
    cardNumber: string | null;
    currentBalance: number;
    user: { email: string | null; firstName: string | null } | null;
    tier: { name: string } | null;
  }): LoyaltyMemberEmailRecipient {
    return {
      userId: row.userId,
      email: row.user?.email ?? null,
      firstName: row.user?.firstName ?? null,
      cardNumber: row.cardNumber,
      pointsBalance: row.currentBalance ?? 0,
      tierName: row.tier?.name ?? 'Member',
    };
  }
}

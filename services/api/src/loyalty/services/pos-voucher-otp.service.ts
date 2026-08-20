import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class PosVoucherOtpService {
  private readonly logger = new Logger(PosVoucherOtpService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private generateCode(): string {
    const max = 10 ** OTP_LENGTH;
    return String(randomInt(0, max)).padStart(OTP_LENGTH, '0');
  }

  /**
   * Send a one-time code to the member's registered email to prove they are present at the till.
   */
  async sendOtp(params: {
    membershipId: string;
    storeId: string;
    staffUserId: string;
  }): Promise<{ expiresAt: Date; maskedDestination: string }> {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { id: params.membershipId },
      include: { user: { select: { email: true, phone: true } } },
    });
    if (!membership?.user?.email) {
      throw new BadRequestException('Member has no registered email for OTP delivery');
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.loyaltyPosRedeemOtp.create({
      data: {
        membershipId: params.membershipId,
        storeId: params.storeId,
        staffUserId: params.staffUserId,
        codeHash: this.hashCode(code),
        expiresAt,
      },
    });

    const email = membership.user.email;
    const masked = email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
    const html = `Your House of Spells in-store verification code is: ${code}. It expires in 10 minutes. Share it only with store staff at the till.`;
    await this.notifications.sendNotificationToUser(
      membership.userId,
      'LOYALTY_REDEMPTION',
      'Your in-store verification code',
      html,
    ).catch((err) => {
      this.logger.warn(`OTP email failed for ${membership.userId}: ${(err as Error).message}`);
    });

    return { expiresAt, maskedDestination: masked };
  }

  /** Verify OTP and mark the latest challenge as consumed. */
  async verifyOtp(params: {
    membershipId: string;
    storeId: string;
    staffUserId: string;
    code: string;
  }): Promise<void> {
    const code = params.code?.trim();
    if (!code || code.length !== OTP_LENGTH) {
      throw new BadRequestException('Invalid OTP format');
    }

    const challenge = await this.prisma.loyaltyPosRedeemOtp.findFirst({
      where: {
        membershipId: params.membershipId,
        storeId: params.storeId,
        staffUserId: params.staffUserId,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new ForbiddenException('No active OTP challenge — request a new code');
    }

    const attempts = ((challenge as any).attempts as number) ?? 0;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new ForbiddenException('Too many failed attempts — request a new code');
    }

    if (challenge.codeHash !== this.hashCode(code)) {
      await this.prisma.loyaltyPosRedeemOtp.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } } as any,
      });
      throw new ForbiddenException('Incorrect verification code');
    }

    await this.prisma.loyaltyPosRedeemOtp.update({
      where: { id: challenge.id },
      data: { verifiedAt: new Date() },
    });
  }

  /** Returns true when staff has a verified OTP within the last 15 minutes. */
  async hasRecentVerification(params: {
    membershipId: string;
    storeId: string;
    staffUserId: string;
  }): Promise<boolean> {
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const row = await this.prisma.loyaltyPosRedeemOtp.findFirst({
      where: {
        membershipId: params.membershipId,
        storeId: params.storeId,
        staffUserId: params.staffUserId,
        verifiedAt: { gte: since },
      },
      orderBy: { verifiedAt: 'desc' },
    });
    return !!row;
  }

  async assertStaffOtpVerified(params: {
    membershipId: string;
    storeId: string;
    staffUserId: string;
  }): Promise<void> {
    const ok = await this.hasRecentVerification(params);
    if (!ok) {
      throw new ForbiddenException(
        'Customer presence must be verified with OTP before staff-assisted redemption',
      );
    }
  }

  async purgeExpired(): Promise<number> {
    const result = await this.prisma.loyaltyPosRedeemOtp.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return result.count;
  }
}

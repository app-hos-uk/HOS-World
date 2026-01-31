import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateInfluencerInvitationDto } from './dto/create-invitation.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class InfluencerInvitationsService {
  private readonly logger = new Logger(InfluencerInvitationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create and send an influencer invitation
   */
  async create(invitedBy: string, dto: CreateInfluencerInvitationDto) {
    // Check if email already has a pending invitation
    const existingInvitation = await this.prisma.influencerInvitation.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new ConflictException('An invitation is already pending for this email');
    }

    // Check if user already exists as influencer
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { influencerProfile: true },
    });

    if (existingUser?.influencerProfile) {
      throw new ConflictException('This user is already an influencer');
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await this.prisma.influencerInvitation.create({
      data: {
        email: dto.email.toLowerCase(),
        invitedBy,
        token,
        expiresAt,
        message: dto.message,
        baseCommissionRate: dto.baseCommissionRate,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Influencer invitation created for ${dto.email} by user ${invitedBy}`);

    // TODO: Send invitation email
    // await this.emailService.sendInfluencerInvitation(invitation);

    return invitation;
  }

  /**
   * List all invitations (admin)
   */
  async findAll(options?: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = options || {};

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [invitations, total] = await Promise.all([
      this.prisma.influencerInvitation.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerInvitation.count({ where }),
    ]);

    return {
      data: invitations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invitation by ID
   */
  async findOne(id: string) {
    const invitation = await this.prisma.influencerInvitation.findUnique({
      where: { id },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  /**
   * Accept invitation and create influencer profile
   */
  async accept(
    token: string,
    userData: { password: string; firstName: string; lastName: string; displayName: string },
  ) {
    const invitation = await this.prisma.influencerInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation has already been used or expired');
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await this.prisma.influencerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    // Use transaction to create user and influencer profile
    const result = await this.prisma.$transaction(async (tx) => {
      if (!user) {
        // Create new user
        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        user = await tx.user.create({
          data: {
            email: invitation.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'INFLUENCER',
          },
        });
      } else {
        // Update existing user to influencer role
        user = await tx.user.update({
          where: { id: user.id },
          data: { role: 'INFLUENCER' },
        });
      }

      // Generate unique referral code
      const referralCode = await this.generateUniqueReferralCode(userData.displayName);

      // Generate slug
      const slug = await this.generateUniqueSlug(userData.displayName);

      // Create influencer profile
      const influencer = await tx.influencer.create({
        data: {
          userId: user.id,
          displayName: userData.displayName,
          slug,
          referralCode,
          baseCommissionRate: invitation.baseCommissionRate || 0.1,
          status: 'ACTIVE',
        },
      });

      // Create default storefront
      await tx.influencerStorefront.create({
        data: {
          influencerId: influencer.id,
        },
      });

      // Mark invitation as accepted
      await tx.influencerInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      return { user, influencer };
    });

    this.logger.log(`Influencer invitation accepted by ${invitation.email}`);

    return result;
  }

  /**
   * Cancel/delete an invitation
   */
  async cancel(id: string) {
    const invitation = await this.prisma.influencerInvitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be cancelled');
    }

    await this.prisma.influencerInvitation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Invitation cancelled successfully' };
  }

  /**
   * Resend invitation email
   */
  async resend(id: string) {
    const invitation = await this.prisma.influencerInvitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be resent');
    }

    // Extend expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.influencerInvitation.update({
      where: { id },
      data: { expiresAt },
    });

    // TODO: Resend invitation email
    // await this.emailService.sendInfluencerInvitation(invitation);

    return { message: 'Invitation resent successfully' };
  }

  /**
   * Get invitation by token (public endpoint for accepting)
   */
  async findByToken(token: string) {
    const invitation = await this.prisma.influencerInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        message: true,
        baseCommissionRate: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  // Helper methods
  private async generateUniqueReferralCode(displayName: string): Promise<string> {
    const base = displayName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    let code =
      base +
      Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, '0');
    let attempts = 0;

    while (attempts < 10) {
      const existing = await this.prisma.influencer.findUnique({
        where: { referralCode: code },
      });
      if (!existing) return code;
      code =
        base +
        Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');
      attempts++;
    }

    // Fallback to random
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private async generateUniqueSlug(displayName: string): Promise<string> {
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let attempts = 0;

    while (attempts < 10) {
      const existing = await this.prisma.influencer.findUnique({
        where: { slug: attempts === 0 ? slug : `${slug}-${attempts}` },
      });
      if (!existing) return attempts === 0 ? slug : `${slug}-${attempts}`;
      attempts++;
    }

    // Fallback with random suffix
    return `${slug}-${randomBytes(3).toString('hex')}`;
  }
}

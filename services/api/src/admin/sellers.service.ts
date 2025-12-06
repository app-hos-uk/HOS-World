import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AdminSellersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {}

  async inviteSeller(
    email: string,
    sellerType: 'WHOLESALER' | 'B2C_SELLER',
    invitedBy: string,
    message?: string,
  ) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await this.prisma.sellerInvitation.findFirst({
      where: {
        email,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('A pending invitation already exists for this email');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const invitation = await this.prisma.sellerInvitation.create({
      data: {
        email,
        sellerType,
        invitedBy,
        token,
        expiresAt,
        message,
        status: 'PENDING',
      },
    });

    // Send invitation email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const invitationLink = `${frontendUrl}/auth/accept-invitation?token=${token}`;

    await this.notificationsService.sendSellerInvitation(email, {
      sellerType,
      invitationLink,
      message,
    });

    return invitation;
  }

  async getInvitations(status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED') {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.sellerInvitation.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async resendInvitation(invitationId: string) {
    const invitation = await this.prisma.sellerInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Can only resend pending invitations');
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      // Generate new token and extend expiry
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await this.prisma.sellerInvitation.update({
        where: { id: invitationId },
        data: {
          token,
          expiresAt,
        },
      });

      invitation.token = token;
      invitation.expiresAt = expiresAt;
    }

    // Resend email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const invitationLink = `${frontendUrl}/auth/accept-invitation?token=${invitation.token}`;

    await this.notificationsService.sendSellerInvitation(invitation.email, {
      sellerType: invitation.sellerType,
      invitationLink,
      message: invitation.message || undefined,
    });

    return invitation;
  }

  async cancelInvitation(invitationId: string) {
    const invitation = await this.prisma.sellerInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel pending invitations');
    }

    return this.prisma.sellerInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.sellerInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await this.prisma.sellerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    return invitation;
  }
}


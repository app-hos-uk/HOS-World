import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { PrismaService } from '../database/prisma.service';

@ApiTags('messaging')
@Controller('messaging')
export class MessagingApiController {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  @Post('push/subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register web push subscription' })
  async subscribePush(
    @Request() req: { user: { id: string } },
    @Body()
    body: { endpoint: string; keys: { p256dh?: string; auth?: string }; platform?: string },
  ): Promise<ApiResponse<unknown>> {
    const existing = await this.prisma.pushSubscription.findFirst({
      where: { userId: req.user.id, endpoint: body.endpoint },
    });
    const row = existing
      ? await this.prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            keys: body.keys as object,
            platform: body.platform || 'WEB',
            isActive: true,
          },
        })
      : await this.prisma.pushSubscription.create({
          data: {
            userId: req.user.id,
            endpoint: body.endpoint,
            keys: body.keys as object,
            platform: body.platform || 'WEB',
            isActive: true,
          },
        });
    return { data: { id: row.id }, message: 'Subscribed' };
  }

  @Delete('push/unsubscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove push subscription(s)' })
  async unsubscribePush(
    @Request() req: { user: { id: string } },
    @Query('endpoint') endpoint?: string,
  ): Promise<ApiResponse<unknown>> {
    if (endpoint) {
      await this.prisma.pushSubscription.deleteMany({
        where: { userId: req.user.id, endpoint },
      });
    } else {
      await this.prisma.pushSubscription.updateMany({
        where: { userId: req.user.id },
        data: { isActive: false },
      });
    }
    return { data: null, message: 'OK' };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Outbound message log for current user' })
  async history(
    @Request() req: { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<unknown>> {
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.messageLog.count({ where: { userId: req.user.id } }),
    ]);
    return { data: { items, total, page, limit: take }, message: 'OK' };
  }

  @Public()
  @Get('unsubscribe')
  @ApiOperation({ summary: 'One-click unsubscribe via signed token' })
  async unsubscribe(
    @Query('token') token: string,
  ): Promise<ApiResponse<{ channel: string; ok: boolean }>> {
    if (!token) return { data: { channel: '', ok: false }, message: 'Missing token' };
    try {
      const payload = this.jwt.verify<{ sub: string; channel: string; typ?: string }>(token);
      if (payload.typ !== 'm_unsub' || !payload.sub || !payload.channel) {
        return { data: { channel: '', ok: false }, message: 'Invalid token' };
      }
      const data: Record<string, boolean> = {};
      const ch = payload.channel.toUpperCase();
      if (ch === 'EMAIL') data.optInEmail = false;
      else if (ch === 'SMS') data.optInSms = false;
      else if (ch === 'WHATSAPP') data.optInWhatsApp = false;
      else if (ch === 'PUSH') data.optInPush = false;
      else return { data: { channel: ch, ok: false }, message: 'Unknown channel' };

      await this.prisma.loyaltyMembership.update({
        where: { userId: payload.sub },
        data,
      });
      await this.prisma.gDPRConsentLog.create({
        data: {
          userId: payload.sub,
          consentType: 'MARKETING',
          granted: false,
          grantedAt: new Date(),
        },
      });
      await this.prisma.journeyEnrollment.updateMany({
        where: { userId: payload.sub, status: 'ACTIVE' },
        data: { status: 'CANCELLED', nextStepAt: null },
      });
      return { data: { channel: ch, ok: true }, message: 'Unsubscribed' };
    } catch {
      return { data: { channel: '', ok: false }, message: 'Invalid or expired token' };
    }
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { PrismaService } from '../database/prisma.service';
import { JourneyService } from './journey.service';
import { MessagingService } from '../messaging/messaging.service';

@ApiTags('admin-journeys')
@ApiBearerAuth('JWT-auth')
@Controller('admin/journeys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class JourneyAdminController {
  constructor(
    private prisma: PrismaService,
    private journeys: JourneyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List marketing journeys' })
  async list(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.marketingJourney.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { enrollments: true } },
      },
    });
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Journey detail' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const journey = await this.prisma.marketingJourney.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true } } },
    });
    const stats = await this.journeys.getJourneyStats(id);
    return { data: { journey, stats }, message: 'OK' };
  }

  @Post()
  @ApiOperation({ summary: 'Create journey' })
  async create(
    @Body()
    body: {
      slug: string;
      name: string;
      description?: string;
      triggerEvent: string;
      triggerConditions?: object;
      steps: unknown[];
      isActive?: boolean;
      regionCodes?: string[];
      channelCodes?: string[];
      segmentId?: string | null;
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.marketingJourney.create({
      data: {
        slug: body.slug,
        name: body.name,
        description: body.description,
        triggerEvent: body.triggerEvent,
        triggerConditions: body.triggerConditions as object | undefined,
        steps: body.steps as object,
        isActive: body.isActive ?? true,
        regionCodes: body.regionCodes ?? [],
        channelCodes: body.channelCodes ?? [],
        segmentId: body.segmentId ?? undefined,
      },
    });
    return { data, message: 'Created' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update journey' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: Partial<{
      name: string;
      description: string;
      triggerEvent: string;
      triggerConditions: object;
      steps: unknown[];
      isActive: boolean;
      regionCodes: string[];
      channelCodes: string[];
      segmentId: string | null;
    }>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.marketingJourney.update({
      where: { id },
      data: {
        ...('name' in body && body.name !== undefined ? { name: body.name } : {}),
        ...('description' in body ? { description: body.description } : {}),
        ...('triggerEvent' in body && body.triggerEvent !== undefined
          ? { triggerEvent: body.triggerEvent }
          : {}),
        ...('triggerConditions' in body ? { triggerConditions: body.triggerConditions as object } : {}),
        ...('steps' in body && body.steps !== undefined ? { steps: body.steps as object } : {}),
        ...('isActive' in body && body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...('regionCodes' in body ? { regionCodes: body.regionCodes } : {}),
        ...('channelCodes' in body ? { channelCodes: body.channelCodes } : {}),
        ...('segmentId' in body ? { segmentId: body.segmentId } : {}),
      },
    });
    return { data, message: 'Updated' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate journey' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.marketingJourney.update({
      where: { id },
      data: { isActive: false },
    });
    return { data, message: 'Deactivated' };
  }

  @Get(':id/enrollments')
  @ApiOperation({ summary: 'List enrollments' })
  async enrollments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const take = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
    const items = await this.prisma.journeyEnrollment.findMany({
      where: { journeyId: id },
      orderBy: { startedAt: 'desc' },
      take,
    });
    return { data: items, message: 'OK' };
  }

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually enroll a user' })
  async trigger(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { userId?: string },
  ): Promise<ApiResponse<unknown>> {
    const journey = await this.prisma.marketingJourney.findUnique({ where: { id } });
    if (!journey) return { data: null, message: 'Not found' };
    if (!body.userId) return { data: null, message: 'userId required' };
    const enrollment = await this.journeys.enrollUser(journey.slug, body.userId, {});
    return { data: enrollment, message: enrollment ? 'Enrolled' : 'Skipped' };
  }
}

@ApiTags('admin-messaging')
@ApiBearerAuth('JWT-auth')
@Controller('admin/messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MessagingAdminController {
  constructor(private prisma: PrismaService, private messaging: MessagingService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Message logs' })
  async logs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<unknown>> {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return { data: { items, total, page: p, limit: take }, message: 'OK' };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Messaging stats (30d)' })
  async stats(): Promise<ApiResponse<unknown>> {
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await this.prisma.messageLog.groupBy({
      by: ['channel', 'status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return { data: { since, breakdown: rows }, message: 'OK' };
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Send template to segment (basic)' })
  async broadcast(
    @Body()
    body: {
      channels: string[];
      templateSlug: string;
      subject?: string;
      templateVars?: Record<string, string>;
      segment?: { tierSlug?: string; regionCode?: string };
    },
  ): Promise<ApiResponse<unknown>> {
    const where: Record<string, unknown> = {};
    if (body.segment?.tierSlug) {
      where.tier = { slug: body.segment.tierSlug };
    }
    if (body.segment?.regionCode) {
      where.regionCode = body.segment.regionCode;
    }
    const members = await this.prisma.loyaltyMembership.findMany({
      where,
      select: { userId: true },
      take: 500,
    });
    let sent = 0;
    for (const m of members) {
      for (const ch of body.channels) {
        const r = await this.messaging.send({
          userId: m.userId,
          channel: ch,
          templateSlug: body.templateSlug,
          templateVars: body.templateVars || {},
          subject: body.subject,
        });
        if (r.success) sent++;
      }
    }
    return { data: { targeted: members.length, attempts: sent }, message: 'OK' };
  }
}

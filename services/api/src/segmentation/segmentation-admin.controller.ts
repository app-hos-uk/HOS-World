import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ConfigService } from '@nestjs/config';
import { SegmentationService } from './segmentation.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { PreviewSegmentDto } from './dto/preview-segment.dto';
import { MessagingService } from '../messaging/messaging.service';
import { QueueService, JobType } from '../queue/queue.service';
import type { SegmentRuleGroup } from './engines/rule-evaluator';

@ApiTags('admin-segments')
@ApiBearerAuth('JWT-auth')
@Controller('admin/segments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SegmentationAdminController {
  constructor(
    private segmentation: SegmentationService,
    private messaging: MessagingService,
    private queue: QueueService,
    private config: ConfigService,
  ) {}

  @Get('templates')
  @ApiOperation({ summary: 'List template segments' })
  async templates(): Promise<ApiResponse<unknown>> {
    const items = await this.segmentation.findTemplates();
    return { data: { items, total: items.length }, message: 'OK' };
  }

  @Get('dimensions')
  @ApiOperation({ summary: 'List segment dimensions' })
  async dimensions(): Promise<ApiResponse<unknown>> {
    const data = this.segmentation.dimensionsCatalog();
    return { data, message: 'OK' };
  }

  @Post('refresh-all')
  @ApiOperation({ summary: 'Queue refresh for all active dynamic segments' })
  async refreshAll(): Promise<ApiResponse<unknown>> {
    const jobId = await this.queue.addJob(JobType.SEGMENT_REFRESH_ALL, {});
    return { data: { jobId }, message: 'Queued' };
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview segment rules' })
  async preview(@Body() body: PreviewSegmentDto): Promise<ApiResponse<unknown>> {
    const rules = body.rules as unknown as SegmentRuleGroup;
    const data = await this.segmentation.previewSegment(rules);
    return { data, message: 'OK' };
  }

  @Get()
  @ApiOperation({ summary: 'List segments' })
  async list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.findAll({
      status,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Post()
  @ApiOperation({ summary: 'Create segment' })
  async create(
    @Body() body: CreateSegmentDto,
    @Request() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.create(body, req.user.id);
    return { data, message: 'OK' };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List segment members' })
  async members(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.getSegmentMembers(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
    return { data, message: 'OK' };
  }

  @Post(':id/broadcast')
  @ApiOperation({ summary: 'Broadcast to segment members' })
  async broadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      channels: string[];
      templateSlug: string;
      subject?: string;
      templateVars?: Record<string, string>;
      limit?: number;
    },
  ): Promise<ApiResponse<unknown>> {
    const max = this.config.get<number>('SEGMENT_BROADCAST_MAX', 5000);
    const defLimit = 1000;
    const limit = Math.min(Math.max(1, body.limit ?? defLimit), max);
    const userIds = (await this.segmentation.getSegmentUserIds(id)).slice(0, limit);
    let sent = 0;
    for (const userId of userIds) {
      const results = await this.messaging.sendMultiChannel({
        userId,
        channels: body.channels,
        templateSlug: body.templateSlug,
        templateVars: body.templateVars ?? {},
        subject: body.subject,
      });
      if (results.some((r) => r.success)) sent++;
    }
    return { data: { targeted: userIds.length, sent }, message: 'OK' };
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh segment membership' })
  async refresh(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.evaluateSegment(id);
    return { data, message: 'OK' };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive segment' })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.archive(id);
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get segment' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.findById(id);
    return { data, message: 'OK' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update segment' })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSegmentDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.segmentation.update(id, body);
    return { data, message: 'OK' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete archived segment' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.segmentation.delete(id);
    return { data: null, message: 'OK' };
  }
}

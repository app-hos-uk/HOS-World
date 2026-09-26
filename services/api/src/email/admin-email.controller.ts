import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { AdminEmailService, type MailboxSource } from './admin-email.service';
import { ResolveAudienceDto } from './dto/resolve-audience.dto';
import { SendCampaignDto } from './dto/send-campaign.dto';

@ApiTags('admin-email')
@ApiBearerAuth('JWT-auth')
@Controller('admin/email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminEmailController {
  constructor(private adminEmail: AdminEmailService) {}

  @Post('resolve-audience')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Resolve audience for admin email compose' })
  async resolveAudience(@Body() body: ResolveAudienceDto): Promise<ApiResponse<unknown>> {
    const data = await this.adminEmail.resolveAudience(body);
    return { data, message: 'OK' };
  }

  @Post('send')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Dry-run or queue an admin email campaign' })
  async send(
    @Body() body: SendCampaignDto,
    @Request() req: { user?: { id?: string } },
  ): Promise<ApiResponse<unknown>> {
    const sentBy = req.user?.id ?? 'unknown';
    const data = await this.adminEmail.sendCampaign(body, sentBy);
    return { data, message: body.dryRun === false ? 'Queued' : 'Dry run' };
  }

  @Get('users')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Autocomplete active users with email' })
  async searchUsers(@Query('search') search?: string): Promise<ApiResponse<unknown>> {
    const data = await this.adminEmail.searchUsers(search);
    return { data, message: 'OK' };
  }

  @Get('mailbox')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Unified admin mailbox list' })
  async mailbox(
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminEmail.getMailbox({
      source: (source as MailboxSource) || 'all',
      status,
      q,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
    return { data, message: 'OK' };
  }

  @Get('mailbox/:source/:id')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Mailbox message or campaign detail' })
  async mailboxDetail(
    @Param('source') source: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminEmail.getMailboxDetail(source, id);
    return { data, message: 'OK' };
  }

  @Get('campaigns')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List admin email campaigns' })
  async listCampaigns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminEmail.listCampaigns(
      page ? Number(page) : 1,
      limit ? Number(limit) : 25,
    );
    return { data, message: 'OK' };
  }

  @Get('campaigns/:id')
  @RequireAccess({ permission: 'marketing.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Admin email campaign detail with message logs' })
  async getCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.adminEmail.getCampaign(id);
    return { data, message: 'OK' };
  }
}

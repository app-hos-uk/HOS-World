import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { PartnerReferralsService } from './partner-referrals.service';
import { PartnerAnalyticsService } from './services/partner-analytics.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { CreatePartnerLinkDto } from './dto/create-partner-link.dto';
import { UpdatePartnerLinkDto } from './dto/update-partner-link.dto';

@ApiTags('Admin - Partner Referrals')
@ApiBearerAuth('JWT-auth')
@Controller('admin/partner-referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PartnerReferralsAdminController {
  constructor(
    private partners: PartnerReferralsService,
    private analytics: PartnerAnalyticsService,
  ) {}

  @Get('dashboard')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Partner referral programme KPIs' })
  async dashboard(): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getDashboard();
    return { data, message: 'OK' };
  }

  @Get()
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List referral partners' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.partners.listPartners({
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Post()
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create a referral partner' })
  async create(@Body() dto: CreatePartnerDto): Promise<ApiResponse<unknown>> {
    const data = await this.partners.createPartner(dto);
    return { data, message: 'Partner created successfully' };
  }

  @Get('links/:id')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Partner link detail' })
  async getLink(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.partners.getLink(id);
    return { data, message: 'OK' };
  }

  @Patch('links/:id')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update a partner link' })
  async updateLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerLinkDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.partners.updateLink(id, dto);
    return { data, message: 'Partner link updated successfully' };
  }

  @Get('links/:id/report')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Partner link report' })
  async linkReport(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getLinkReport(id);
    return { data, message: 'OK' };
  }

  @Get('links/:id/url')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Full tracking URL for a partner link' })
  async linkUrl(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ url: string }>> {
    const url = await this.partners.getLinkFullUrl(id);
    return { data: { url }, message: 'OK' };
  }

  @Get('links/:id/qr')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'QR payload for a partner link' })
  async linkQr(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ qrData: string }>> {
    const qrData = await this.partners.getLinkQrData(id);
    return { data: { qrData }, message: 'OK' };
  }

  @Get(':id')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Referral partner detail' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.partners.getPartner(id);
    return { data, message: 'OK' };
  }

  @Patch(':id')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update a referral partner' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.partners.updatePartner(id, dto);
    return { data, message: 'Partner updated successfully' };
  }

  @Post(':id/archive')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Archive a referral partner' })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.partners.archivePartner(id);
    return { data, message: 'Partner archived successfully' };
  }

  @Get(':id/report')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Referral partner report' })
  async report(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getPartnerReport(id);
    return { data, message: 'OK' };
  }

  @Post(':id/links')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create a referral link for a partner' })
  async createLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePartnerLinkDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.partners.createLink(id, dto);
    return { data, message: 'Partner link created successfully' };
  }

  @Get(':id/links')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List referral links for a partner' })
  async listLinks(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.partners.listLinks(id);
    return { data, message: 'OK' };
  }
}

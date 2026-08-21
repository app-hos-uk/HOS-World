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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { BrandPartnershipsService } from './brand-partnerships.service';
import { CreatePartnershipDto } from './dto/create-partnership.dto';
import { UpdatePartnershipDto } from './dto/update-partnership.dto';
import { CreateBrandCampaignDto } from './dto/create-brand-campaign.dto';
import { UpdateBrandCampaignDto } from './dto/update-brand-campaign.dto';

@ApiTags('admin-brand-partnerships')
@ApiBearerAuth('JWT-auth')
@Controller('admin/brand-partnerships')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BrandPartnershipsAdminController {
  constructor(private brand: BrandPartnershipsService) {}

  @Get('dashboard')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Brand partnership programme KPIs' })
  async dashboard(): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getDashboard();
    return { data, message: 'OK' };
  }

  @Get('campaigns')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List brand campaigns' })
  async listCampaigns(
    @Query('partnershipId') partnershipId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.listCampaigns({
      partnershipId,
      status,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Get('campaigns/:campaignId')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Campaign detail' })
  async getCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Patch('campaigns/:campaignId')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update campaign' })
  async updateCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: UpdateBrandCampaignDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.updateCampaign(campaignId, dto);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/activate')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Activate campaign' })
  async activate(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.activateCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/pause')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Pause campaign' })
  async pause(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.pauseCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/complete')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Complete campaign' })
  async complete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.completeCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/cancel')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Cancel campaign' })
  async cancel(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.cancelCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Get('campaigns/:campaignId/report')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Campaign report' })
  async campaignReport(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getCampaignReport(campaignId);
    return { data, message: 'OK' };
  }

  @Get()
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List partnerships' })
  async list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.listPartnerships({
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Post()
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create partnership' })
  async create(@Body() dto: CreatePartnershipDto): Promise<ApiResponse<unknown>> {
    const data = await this.brand.createPartnership(dto);
    return { data, message: 'OK' };
  }

  @Post(':partnershipId/campaigns')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create campaign under partnership' })
  async createCampaign(
    @Param('partnershipId', ParseUUIDPipe) partnershipId: string,
    @Body() dto: CreateBrandCampaignDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.createCampaign(partnershipId, dto);
    return { data, message: 'OK' };
  }

  @Get(':id/report')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Partnership report' })
  async report(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getPartnershipReport(id);
    return { data, message: 'OK' };
  }

  @Post(':id/archive')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Archive partnership' })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.archivePartnership(id);
    return { data, message: 'OK' };
  }

  @Post(':id/restore')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Restore archived partnership back to active' })
  async restore(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.restorePartnership(id);
    return { data, message: 'Partnership restored successfully' };
  }

  @Get(':id')
  @RequireAccess({ permission: 'promotions.view', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Partnership detail' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getPartnership(id);
    return { data, message: 'OK' };
  }

  @Patch(':id')
  @RequireAccess({ permission: 'promotions.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update partnership' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnershipDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.updatePartnership(id, dto);
    return { data, message: 'OK' };
  }
}

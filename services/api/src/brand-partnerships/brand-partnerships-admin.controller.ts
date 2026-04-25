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
  @ApiOperation({ summary: 'Brand partnership programme KPIs' })
  async dashboard(): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getDashboard();
    return { data, message: 'OK' };
  }

  @Get('campaigns')
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
  @ApiOperation({ summary: 'Campaign detail' })
  async getCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Patch('campaigns/:campaignId')
  @ApiOperation({ summary: 'Update campaign' })
  async updateCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: UpdateBrandCampaignDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.updateCampaign(campaignId, dto);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/activate')
  @ApiOperation({ summary: 'Activate campaign' })
  async activate(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.activateCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/pause')
  @ApiOperation({ summary: 'Pause campaign' })
  async pause(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.pauseCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/complete')
  @ApiOperation({ summary: 'Complete campaign' })
  async complete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.completeCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Post('campaigns/:campaignId/cancel')
  @ApiOperation({ summary: 'Cancel campaign' })
  async cancel(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.cancelCampaign(campaignId);
    return { data, message: 'OK' };
  }

  @Get('campaigns/:campaignId/report')
  @ApiOperation({ summary: 'Campaign report' })
  async campaignReport(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getCampaignReport(campaignId);
    return { data, message: 'OK' };
  }

  @Get()
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
  @ApiOperation({ summary: 'Create partnership' })
  async create(@Body() dto: CreatePartnershipDto): Promise<ApiResponse<unknown>> {
    const data = await this.brand.createPartnership(dto);
    return { data, message: 'OK' };
  }

  @Post(':partnershipId/campaigns')
  @ApiOperation({ summary: 'Create campaign under partnership' })
  async createCampaign(
    @Param('partnershipId', ParseUUIDPipe) partnershipId: string,
    @Body() dto: CreateBrandCampaignDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.createCampaign(partnershipId, dto);
    return { data, message: 'OK' };
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Partnership report' })
  async report(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getPartnershipReport(id);
    return { data, message: 'OK' };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive partnership' })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.archivePartnership(id);
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Partnership detail' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getPartnership(id);
    return { data, message: 'OK' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update partnership' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnershipDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.updatePartnership(id, dto);
    return { data, message: 'OK' };
  }
}

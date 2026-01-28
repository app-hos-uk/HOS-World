import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { InfluencerCampaignsService } from './influencer-campaigns.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('influencer-campaigns')
@Controller()
export class InfluencerCampaignsController {
  constructor(private readonly campaignsService: InfluencerCampaignsService) {}

  // ============================================
  // INFLUENCER ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/campaigns')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my campaigns' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'] })
  @SwaggerApiResponse({ status: 200, description: 'Campaigns retrieved successfully' })
  async getMyCampaigns(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.campaignsService.findByInfluencer(req.user.sub, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Campaigns retrieved successfully',
    };
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencer-campaigns')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all campaigns' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'influencerId', required: false })
  @SwaggerApiResponse({ status: 200, description: 'Campaigns retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('influencerId') influencerId?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.campaignsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      influencerId,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Campaigns retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencer-campaigns/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Campaign retrieved successfully' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const campaign = await this.campaignsService.findOne(id);
    return {
      data: campaign,
      message: 'Campaign retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Post('admin/influencer-campaigns')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create campaign' })
  @SwaggerApiResponse({ status: 201, description: 'Campaign created successfully' })
  async create(
    @Body() body: {
      influencerId: string;
      name: string;
      description?: string;
      startDate: string;
      endDate: string;
      overrideCommissionRate?: number;
      productIds?: string[];
      categoryIds?: string[];
    },
  ): Promise<ApiResponse<any>> {
    const campaign = await this.campaignsService.create({
      influencerId: body.influencerId,
      name: body.name,
      description: body.description,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      overrideCommissionRate: body.overrideCommissionRate,
      productIds: body.productIds,
      categoryIds: body.categoryIds,
    });
    return {
      data: campaign,
      message: 'Campaign created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Put('admin/influencer-campaigns/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Campaign updated successfully' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      name?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      overrideCommissionRate?: number;
      productIds?: string[];
      categoryIds?: string[];
      status?: string;
    },
  ): Promise<ApiResponse<any>> {
    const campaign = await this.campaignsService.update(id, {
      name: body.name,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      overrideCommissionRate: body.overrideCommissionRate,
      productIds: body.productIds,
      categoryIds: body.categoryIds,
      status: body.status,
    });
    return {
      data: campaign,
      message: 'Campaign updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('admin/influencer-campaigns/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Campaign deleted successfully' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const result = await this.campaignsService.delete(id);
    return {
      data: null,
      message: result.message,
    };
  }
}

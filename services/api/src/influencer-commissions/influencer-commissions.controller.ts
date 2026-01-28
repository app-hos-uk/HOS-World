import {
  Controller,
  Get,
  Put,
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
import { InfluencerCommissionsService } from './influencer-commissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('influencer-commissions')
@Controller()
export class InfluencerCommissionsController {
  constructor(private readonly commissionsService: InfluencerCommissionsService) {}

  // ============================================
  // INFLUENCER ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/commissions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my commissions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'] })
  @SwaggerApiResponse({ status: 200, description: 'Commissions retrieved successfully' })
  async getMyCommissions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.commissionsService.findByInfluencer(req.user.sub, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Commissions retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/earnings')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my earnings summary' })
  @SwaggerApiResponse({ status: 200, description: 'Earnings summary retrieved successfully' })
  async getMyEarnings(@Request() req: any): Promise<ApiResponse<any>> {
    const earnings = await this.commissionsService.getEarningsSummary(req.user.sub);
    return {
      data: earnings,
      message: 'Earnings summary retrieved successfully',
    };
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @Get('admin/influencer-commissions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all commissions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'influencerId', required: false })
  @SwaggerApiResponse({ status: 200, description: 'Commissions retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('influencerId') influencerId?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.commissionsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      influencerId,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Commissions retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @Put('admin/influencer-commissions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update commission' })
  @ApiParam({ name: 'id', description: 'Commission UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Commission updated successfully' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: string; notes?: string },
  ): Promise<ApiResponse<any>> {
    const commission = await this.commissionsService.updateStatus(id, body.status!, body.notes);
    return {
      data: commission,
      message: 'Commission updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @Put('admin/influencer-commissions/:id/approve')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Approve commission' })
  @ApiParam({ name: 'id', description: 'Commission UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Commission approved successfully' })
  async approve(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const commission = await this.commissionsService.approve(id);
    return {
      data: commission,
      message: 'Commission approved successfully',
    };
  }
}

import {
  Controller,
  Get,
  Post,
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
import { InfluencerPayoutsService } from './influencer-payouts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('influencer-payouts')
@Controller()
export class InfluencerPayoutsController {
  constructor(private readonly payoutsService: InfluencerPayoutsService) {}

  // ============================================
  // INFLUENCER ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/payouts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my payouts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Payouts retrieved successfully' })
  async getMyPayouts(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.findByInfluencer(req.user.sub, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Payouts retrieved successfully',
    };
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @Get('admin/influencer-payouts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all payouts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PAID', 'CANCELLED'] })
  @ApiQuery({ name: 'influencerId', required: false })
  @SwaggerApiResponse({ status: 200, description: 'Payouts retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('influencerId') influencerId?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      influencerId,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Payouts retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @Post('admin/influencer-payouts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create payout record' })
  @SwaggerApiResponse({ status: 201, description: 'Payout created successfully' })
  async create(
    @Body() body: {
      influencerId: string;
      periodStart: string;
      periodEnd: string;
      notes?: string;
    },
  ): Promise<ApiResponse<any>> {
    const payout = await this.payoutsService.create({
      influencerId: body.influencerId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      notes: body.notes,
    });
    return {
      data: payout,
      message: 'Payout created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @Put('admin/influencer-payouts/:id/mark-paid')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark payout as paid' })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Payout marked as paid' })
  async markPaid(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { paymentMethod?: string; paymentRef?: string },
  ): Promise<ApiResponse<any>> {
    const payout = await this.payoutsService.markPaid(id, req.user.sub, body);
    return {
      data: payout,
      message: 'Payout marked as paid successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('admin/influencer-payouts/:id/cancel')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel payout' })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Payout cancelled successfully' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.cancel(id);
    return {
      data: null,
      message: result.message,
    };
  }
}

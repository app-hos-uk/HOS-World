import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { DiscrepanciesService } from './discrepancies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('discrepancies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DiscrepanciesController {
  constructor(private readonly discrepanciesService: DiscrepanciesService) {}

  @Post()
  async createDiscrepancy(
    @Body()
    body: {
      type: 'INVENTORY' | 'PRICING' | 'SETTLEMENT' | 'ORDER_FULFILLMENT';
      sellerId?: string;
      orderId?: string;
      productId?: string;
      settlementId?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      expectedValue?: any;
      actualValue?: any;
      description: string;
    },
  ): Promise<ApiResponse<any>> {
    const discrepancy = await this.discrepanciesService.createDiscrepancy(body);
    return {
      data: discrepancy,
      message: 'Discrepancy created successfully',
    };
  }

  @Get()
  async getDiscrepancies(
    @Query('sellerId') sellerId?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.discrepanciesService.getDiscrepancies({
      sellerId,
      type: type as any,
      severity: severity as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Discrepancies retrieved successfully',
    };
  }

  @Get(':id')
  async getDiscrepancyById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const discrepancy = await this.discrepanciesService.getDiscrepancyById(id);
    return {
      data: discrepancy,
      message: 'Discrepancy retrieved successfully',
    };
  }

  @Put(':id/resolve')
  async resolveDiscrepancy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { resolution: string },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const discrepancy = await this.discrepanciesService.resolveDiscrepancy(
      id,
      req.user.id,
      body.resolution,
    );
    return {
      data: discrepancy,
      message: 'Discrepancy resolved successfully',
    };
  }

  @Get('seller/:sellerId')
  async getSellerDiscrepancies(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.discrepanciesService.getSellerDiscrepancies(sellerId, {
      type: type as any,
      severity: severity as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Seller discrepancies retrieved successfully',
    };
  }
}


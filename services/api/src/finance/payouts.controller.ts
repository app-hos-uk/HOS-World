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
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('finance/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('schedule')
  async schedulePayout(
    @Body()
    body: {
      sellerId: string;
      amount: number;
      currency?: string;
      paymentMethod?: string;
      scheduledDate?: string;
      description?: string;
    },
  ): Promise<ApiResponse<any>> {
    const payout = await this.payoutsService.schedulePayout({
      ...body,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
    });
    return {
      data: payout,
      message: 'Payout scheduled successfully',
    };
  }

  @Put(':id/process')
  async processPayout(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const payout = await this.payoutsService.processPayout(id);
    return {
      data: payout,
      message: 'Payout processed successfully',
    };
  }

  @Get()
  async getPayouts(
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.getPayouts({
      sellerId,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Payouts retrieved successfully',
    };
  }

  @Get(':sellerId/history')
  async getSellerPayoutHistory(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.getSellerPayoutHistory(sellerId, {
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Seller payout history retrieved successfully',
    };
  }
}


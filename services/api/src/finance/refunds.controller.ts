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
import { RefundsService } from './refunds.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('finance/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  async processRefund(
    @Body()
    body: {
      returnId: string;
      amount: number;
      currency?: string;
      description?: string;
    },
  ): Promise<ApiResponse<any>> {
    const refund = await this.refundsService.processRefund(body);
    return {
      data: refund,
      message: 'Refund processed successfully',
    };
  }

  @Get()
  async getRefunds(
    @Query('customerId') customerId?: string,
    @Query('orderId') orderId?: string,
    @Query('returnId') returnId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.refundsService.getRefunds({
      customerId,
      orderId,
      returnId,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Refunds retrieved successfully',
    };
  }

  @Put(':id/status')
  async updateRefundStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' },
  ): Promise<ApiResponse<any>> {
    const refund = await this.refundsService.updateRefundStatus(id, body.status);
    return {
      data: refund,
      message: 'Refund status updated successfully',
    };
  }
}


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
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('finance/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async createTransaction(
    @Body()
    body: {
      type: 'PAYMENT' | 'PAYOUT' | 'REFUND' | 'FEE' | 'ADJUSTMENT';
      amount: number;
      currency?: string;
      sellerId?: string;
      customerId?: string;
      orderId?: string;
      settlementId?: string;
      returnId?: string;
      description?: string;
      metadata?: any;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    },
  ): Promise<ApiResponse<any>> {
    const transaction = await this.transactionsService.createTransaction(body);
    return {
      data: transaction,
      message: 'Transaction created successfully',
    };
  }

  @Get()
  async getTransactions(
    @Query('sellerId') sellerId?: string,
    @Query('customerId') customerId?: string,
    @Query('orderId') orderId?: string,
    @Query('settlementId') settlementId?: string,
    @Query('returnId') returnId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.transactionsService.getTransactions({
      sellerId,
      customerId,
      orderId,
      settlementId,
      returnId,
      type: type as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Transactions retrieved successfully',
    };
  }

  @Get(':id')
  async getTransactionById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const transaction = await this.transactionsService.getTransactionById(id);
    return {
      data: transaction,
      message: 'Transaction retrieved successfully',
    };
  }

  @Put(':id/status')
  async updateTransactionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' },
  ): Promise<ApiResponse<any>> {
    const transaction = await this.transactionsService.updateTransactionStatus(
      id,
      body.status,
    );
    return {
      data: transaction,
      message: 'Transaction status updated successfully',
    };
  }

  @Get('export')
  async exportTransactions(
    @Query('sellerId') sellerId?: string,
    @Query('customerId') customerId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ApiResponse<any[]>> {
    const transactions = await this.transactionsService.exportTransactions({
      sellerId,
      customerId,
      type: type as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return {
      data: transactions,
      message: 'Transactions exported successfully',
    };
  }
}


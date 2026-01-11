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
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('finance')
@ApiBearerAuth('JWT-auth')
@Controller('finance/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create transaction (Admin only)',
    description: 'Creates a new financial transaction. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'amount'],
      properties: {
        type: {
          type: 'string',
          enum: ['PAYMENT', 'PAYOUT', 'REFUND', 'FEE', 'ADJUSTMENT'],
        },
        amount: { type: 'number' },
        currency: { type: 'string' },
        sellerId: { type: 'string', format: 'uuid' },
        customerId: { type: 'string', format: 'uuid' },
        orderId: { type: 'string', format: 'uuid' },
        settlementId: { type: 'string', format: 'uuid' },
        returnId: { type: 'string', format: 'uuid' },
        description: { type: 'string' },
        metadata: { type: 'object' },
        status: {
          type: 'string',
          enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Transaction created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Get all transactions (Admin only)',
    description: 'Retrieves all financial transactions with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'customerId', required: false, type: String, description: 'Filter by customer ID' })
  @ApiQuery({ name: 'orderId', required: false, type: String, description: 'Filter by order ID' })
  @ApiQuery({ name: 'settlementId', required: false, type: String, description: 'Filter by settlement ID' })
  @ApiQuery({ name: 'returnId', required: false, type: String, description: 'Filter by return ID' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by transaction type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by transaction status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Get transaction by ID (Admin only)',
    description: 'Retrieves a specific transaction by ID. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Transaction not found' })
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
  @ApiOperation({
    summary: 'Update transaction status (Admin only)',
    description: 'Updates the status of a financial transaction. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Transaction status updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid status' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Transaction not found' })
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
  @ApiOperation({
    summary: 'Export transactions (Admin only)',
    description: 'Exports financial transactions as a downloadable file. Admin access required.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'customerId', required: false, type: String, description: 'Filter by customer ID' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by transaction type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by transaction status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @SwaggerApiResponse({ status: 200, description: 'Transactions exported successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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


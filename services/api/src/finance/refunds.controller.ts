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
Version,
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
import { RefundsService } from './refunds.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('finance')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('finance/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @ApiOperation({
    summary: 'Process refund (Admin only)',
    description: 'Processes a refund for a return. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['returnId', 'amount'],
      properties: {
        returnId: { type: 'string', format: 'uuid', description: 'Return request UUID' },
        amount: { type: 'number', description: 'Refund amount' },
        currency: { type: 'string', description: 'Currency code (optional)' },
        description: { type: 'string', description: 'Refund description (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Refund processed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Return request not found' })
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
  @ApiOperation({
    summary: 'Get all refunds (Admin only)',
    description: 'Retrieves all refunds with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'customerId', required: false, type: String, description: 'Filter by customer ID' })
  @ApiQuery({ name: 'orderId', required: false, type: String, description: 'Filter by order ID' })
  @ApiQuery({ name: 'returnId', required: false, type: String, description: 'Filter by return ID' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by refund status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Refunds retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Update refund status (Admin only)',
    description: 'Updates the status of a refund. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Refund UUID', type: String })
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
  @SwaggerApiResponse({ status: 200, description: 'Refund status updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid status' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Refund not found' })
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


import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('returns')
@ApiBearerAuth('JWT-auth')
@Controller('returns')
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create return request',
    description:
      'Creates a new return request for an order. Customers can return items within the return window.',
  })
  @ApiBody({ type: CreateReturnDto })
  @SwaggerApiResponse({ status: 201, description: 'Return request created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data or return window expired' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async create(
    @Request() req: any,
    @Body() createReturnDto: CreateReturnDto,
  ): Promise<ApiResponse<any>> {
    const returnRequest = await this.returnsService.create(req.user.id, createReturnDto);
    return {
      data: returnRequest,
      message: 'Return request created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all return requests',
    description:
      'Retrieves all return requests. Customers see their own returns, sellers see returns for their products, admins see all.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Return requests retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: any): Promise<ApiResponse<any[]>> {
    const returns = await this.returnsService.findAll(req.user.id, req.user.role);
    return {
      data: returns,
      message: 'Return requests retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get return request by ID',
    description:
      'Retrieves a specific return request by ID. Users can only access their own returns unless they are seller/admin.',
  })
  @ApiParam({ name: 'id', description: 'Return request UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Return request retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this return request' })
  @SwaggerApiResponse({ status: 404, description: 'Return request not found' })
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const returnRequest = await this.returnsService.findOne(id, req.user.id, req.user.role);
    return {
      data: returnRequest,
      message: 'Return request retrieved successfully',
    };
  }

  @UseGuards(RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN')
  @Put(':id/status')
  @ApiOperation({
    summary: 'Update return request status (Seller/Admin only)',
    description:
      'Updates the status of a return request. Sellers and admins can approve, reject, or process returns.',
  })
  @ApiParam({ name: 'id', description: 'Return request UUID', type: String })
  @ApiBody({
    description: 'Status update data',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'REFUNDED'],
        },
        refundAmount: { type: 'number', description: 'Refund amount (optional)' },
        refundMethod: { type: 'string', description: 'Refund method (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Return status updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Return request not found' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: { status: string; refundAmount?: number; refundMethod?: string },
  ): Promise<ApiResponse<any>> {
    const returnRequest = await this.returnsService.updateStatus(
      id,
      updateDto.status,
      updateDto.refundAmount,
      updateDto.refundMethod,
    );
    return {
      data: returnRequest,
      message: 'Return status updated successfully',
    };
  }
}

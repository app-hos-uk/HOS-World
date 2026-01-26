import {
  Controller,
  Get,
  Post,
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
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import { ApproveSubmissionDto, RejectSubmissionDto, SelectQuantityDto } from './dto/approve-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { ProductSubmissionStatus } from '@prisma/client';

@ApiTags('procurement')
@ApiBearerAuth('JWT-auth')
@Controller('procurement')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROCUREMENT', 'ADMIN')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('submissions')
  @ApiOperation({
    summary: 'Get all product submissions',
    description: 'Retrieves all product submissions with optional status filtering. Procurement/Admin access required.',
  })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by submission status' })
  @SwaggerApiResponse({ status: 200, description: 'Submissions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  async findAll(
    @Query('status') status?: ProductSubmissionStatus,
  ): Promise<ApiResponse<any[]>> {
    const submissions = await this.procurementService.findAll(status);
    return {
      data: submissions,
      message: 'Submissions retrieved successfully',
    };
  }

  @Get('submissions/:id')
  @ApiOperation({
    summary: 'Get submission by ID',
    description: 'Retrieves a specific product submission by ID. Procurement/Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Submission retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const submission = await this.procurementService.findOne(id);
    return {
      data: submission,
      message: 'Submission retrieved successfully',
    };
  }

  @Post('submissions/:id/approve')
  @ApiOperation({
    summary: 'Approve product submission',
    description: 'Approves a product submission for procurement. Procurement/Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @ApiBody({ type: ApproveSubmissionDto })
  @SwaggerApiResponse({ status: 200, description: 'Submission approved successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async approve(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveSubmissionDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.procurementService.approve(id, req.user.id, approveDto);
    return {
      data: submission,
      message: 'Submission approved successfully',
    };
  }

  @Post('submissions/:id/reject')
  @ApiOperation({
    summary: 'Reject product submission',
    description: 'Rejects a product submission. Procurement/Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @ApiBody({ type: RejectSubmissionDto })
  @SwaggerApiResponse({ status: 200, description: 'Submission rejected' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async reject(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectSubmissionDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.procurementService.reject(id, req.user.id, rejectDto);
    return {
      data: submission,
      message: 'Submission rejected',
    };
  }

  @Post('submissions/:id/select-quantity')
  @ApiOperation({
    summary: 'Select quantity for submission',
    description: 'Selects the quantity to procure for a product submission. Procurement/Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @ApiBody({ type: SelectQuantityDto })
  @SwaggerApiResponse({ status: 200, description: 'Quantity selected successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async selectQuantity(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() selectQuantityDto: SelectQuantityDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.procurementService.selectQuantity(
      id,
      req.user.id,
      selectQuantityDto,
    );
    return {
      data: submission,
      message: 'Quantity selected successfully',
    };
  }

  @Get('duplicates')
  @ApiOperation({
    summary: 'Get duplicate alerts',
    description: 'Retrieves alerts for potential duplicate product submissions. Procurement/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Duplicate alerts retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  async getDuplicates(): Promise<ApiResponse<any[]>> {
    const duplicates = await this.procurementService.getDuplicates();
    return {
      data: duplicates,
      message: 'Duplicate alerts retrieved successfully',
    };
  }

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get procurement dashboard statistics',
    description: 'Retrieves dashboard statistics for procurement operations. Procurement/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.procurementService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}


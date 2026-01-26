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
} from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { SetPricingDto, ApprovePricingDto } from './dto/set-pricing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('finance')
@ApiBearerAuth('JWT-auth')
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANCE', 'ADMIN')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'Get pending finance approvals',
    description: 'Retrieves all product submissions pending finance approval. Finance/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Pending finance approvals retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  async findPending(): Promise<ApiResponse<any[]>> {
    const submissions = await this.financeService.findPending();
    return {
      data: submissions,
      message: 'Pending finance approvals retrieved successfully',
    };
  }

  @Post('pricing/:submissionId')
  @ApiOperation({
    summary: 'Set pricing for submission',
    description: 'Sets pricing for a product submission. Finance/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @ApiBody({ type: SetPricingDto })
  @SwaggerApiResponse({ status: 200, description: 'Pricing set successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async setPricing(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() setPricingDto: SetPricingDto,
  ): Promise<ApiResponse<any>> {
    const pricing = await this.financeService.setPricing(
      submissionId,
      req.user.id,
      setPricingDto,
    );
    return {
      data: pricing,
      message: 'Pricing set successfully',
    };
  }

  @Post('approve/:submissionId')
  @ApiOperation({
    summary: 'Approve submission for publishing',
    description: 'Approves a product submission for publishing after pricing is set. Finance/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @ApiBody({ type: ApprovePricingDto })
  @SwaggerApiResponse({ status: 200, description: 'Submission approved for publishing' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async approve(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() approveDto: ApprovePricingDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.financeService.approve(
      submissionId,
      req.user.id,
      approveDto,
    );
    return {
      data: submission,
      message: 'Submission approved for publishing',
    };
  }

  @Post('reject/:submissionId')
  @ApiOperation({
    summary: 'Reject submission',
    description: 'Rejects a product submission with a reason. Finance/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', description: 'Rejection reason' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Submission rejected' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async reject(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: { reason: string },
  ): Promise<ApiResponse<any>> {
    const submission = await this.financeService.reject(
      submissionId,
      req.user.id,
      body.reason,
    );
    return {
      data: submission,
      message: 'Submission rejected',
    };
  }

  @Get('pricing-history/:submissionId')
  @ApiOperation({
    summary: 'Get pricing history',
    description: 'Retrieves pricing history for a product submission. Finance/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Pricing history retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async getPricingHistory(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const history = await this.financeService.getPricingHistory(submissionId);
    return {
      data: history,
      message: 'Pricing history retrieved successfully',
    };
  }

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get finance dashboard statistics',
    description: 'Retrieves dashboard statistics for finance operations. Finance/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.financeService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}


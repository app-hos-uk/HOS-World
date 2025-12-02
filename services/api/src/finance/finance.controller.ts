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
import { FinanceService } from './finance.service';
import { SetPricingDto, ApprovePricingDto } from './dto/set-pricing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANCE', 'ADMIN')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('pending')
  async findPending(): Promise<ApiResponse<any[]>> {
    const submissions = await this.financeService.findPending();
    return {
      data: submissions,
      message: 'Pending finance approvals retrieved successfully',
    };
  }

  @Post('pricing/:submissionId')
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
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.financeService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}


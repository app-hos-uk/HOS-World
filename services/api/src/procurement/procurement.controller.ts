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
import { ProcurementService } from './procurement.service';
import { ApproveSubmissionDto, RejectSubmissionDto, SelectQuantityDto } from './dto/approve-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { ProductSubmissionStatus } from '@prisma/client';

@Controller('procurement')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROCUREMENT', 'ADMIN')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('submissions')
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
  async getDuplicates(): Promise<ApiResponse<any[]>> {
    const duplicates = await this.procurementService.getDuplicates();
    return {
      data: duplicates,
      message: 'Duplicate alerts retrieved successfully',
    };
  }

  @Get('dashboard/stats')
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.procurementService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}


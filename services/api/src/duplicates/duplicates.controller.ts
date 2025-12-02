import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DuplicatesService } from './duplicates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('duplicates')
export class DuplicatesController {
  constructor(private readonly duplicatesService: DuplicatesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCUREMENT', 'ADMIN')
  @Get('alerts')
  async getAlerts(): Promise<ApiResponse<any[]>> {
    const duplicates = await this.duplicatesService.getSubmissionsWithDuplicates();
    return {
      data: duplicates,
      message: 'Duplicate alerts retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'PROCUREMENT', 'ADMIN')
  @Get('submission/:submissionId')
  async getDuplicatesForSubmission(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any[]>> {
    const duplicates = await this.duplicatesService.getDuplicatesForSubmission(
      submissionId,
    );
    return {
      data: duplicates,
      message: 'Duplicates retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCUREMENT', 'ADMIN')
  @Get('detect/:submissionId')
  async detectDuplicates(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any[]>> {
    const duplicates = await this.duplicatesService.detectDuplicates(submissionId);
    return {
      data: duplicates,
      message: 'Duplicate detection completed',
    };
  }
}


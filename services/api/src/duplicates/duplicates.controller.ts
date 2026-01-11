import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DuplicatesService } from './duplicates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('duplicates')
@Controller('duplicates')
export class DuplicatesController {
  constructor(private readonly duplicatesService: DuplicatesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCUREMENT', 'ADMIN')
  @Get('alerts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get duplicate alerts (Procurement/Admin only)',
    description: 'Retrieves alerts for potential duplicate product submissions. Procurement or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Duplicate alerts retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get duplicates for submission',
    description: 'Retrieves potential duplicate submissions for a specific submission. Seller/Procurement/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Duplicates retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Detect duplicates for submission (Procurement/Admin only)',
    description: 'Runs duplicate detection algorithm for a specific submission. Procurement or Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Duplicate detection completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
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


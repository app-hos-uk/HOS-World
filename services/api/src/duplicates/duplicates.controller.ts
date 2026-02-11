import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
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
    description:
      'Retrieves alerts for potential duplicate product submissions. Procurement or Admin access required.',
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
  @Roles('PROCUREMENT', 'CATALOG', 'ADMIN')
  @Get('cross-seller-groups')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get cross-seller duplicate groups',
    description:
      'Groups of submissions from different sellers/wholesalers that represent the same product. Use to approve only one per product. Procurement, Catalog, or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Duplicate groups retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getCrossSellerGroups(): Promise<ApiResponse<any[]>> {
    const groups = await this.duplicatesService.findCrossSellerDuplicateGroups();
    return {
      data: groups,
      message: 'Cross-seller duplicate groups retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('cross-seller-groups/assign')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Assign persisted cross-seller group ids (Admin only)',
    description:
      'Recomputes cross-seller duplicate groups and persists crossSellerGroupId on each submission for reporting. Run periodically (e.g. cron) or after bulk imports.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Group ids assigned' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden' })
  async assignCrossSellerGroups(): Promise<
    ApiResponse<{ groupsAssigned: number; submissionsUpdated: number }>
  > {
    const result = await this.duplicatesService.assignCrossSellerGroupIds();
    return {
      data: result,
      message: `Assigned ${result.groupsAssigned} group(s), updated ${result.submissionsUpdated} submission(s)`,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCUREMENT', 'CATALOG', 'ADMIN')
  @Post('cross-seller-groups/reject-others')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reject all others in a cross-seller duplicate group',
    description:
      'Rejects all submissions in the group except the one to keep (e.g. after approving one). Procurement, Catalog, or Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['groupId', 'keepSubmissionId'],
      properties: {
        groupId: { type: 'string', description: 'Cross-seller group id from GET /duplicates/cross-seller-groups' },
        keepSubmissionId: { type: 'string', format: 'uuid', description: 'Submission id to keep (approved)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Other submissions in the group rejected' })
  @SwaggerApiResponse({ status: 400, description: 'Bad request - keepSubmissionId not in group' })
  @SwaggerApiResponse({ status: 404, description: 'Group not found' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden' })
  async rejectOthersInGroup(
    @Body('groupId') groupId: string,
    @Body('keepSubmissionId') keepSubmissionId: string,
  ): Promise<ApiResponse<{ rejectedIds: string[] }>> {
    const result = await this.duplicatesService.rejectOthersInGroup(groupId, keepSubmissionId);
    return {
      data: result,
      message: result.rejectedIds.length
        ? `${result.rejectedIds.length} submission(s) rejected as duplicate`
        : 'No submissions to reject',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'PROCUREMENT', 'ADMIN')
  @Get('submission/:submissionId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get duplicates for submission',
    description:
      'Retrieves potential duplicate submissions for a specific submission. Seller/Procurement/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Duplicates retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async getDuplicatesForSubmission(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any[]>> {
    const duplicates = await this.duplicatesService.getDuplicatesForSubmission(submissionId);
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
    description:
      'Runs duplicate detection algorithm for a specific submission. Procurement or Admin access required.',
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

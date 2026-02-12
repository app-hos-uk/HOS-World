import {
  Controller,
  Get,
  Post,
  Put,
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
import { CatalogService } from './catalog.service';
import { CreateCatalogEntryDto, UpdateCatalogEntryDto } from './dto/create-catalog-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('catalog')
@ApiBearerAuth('JWT-auth')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('pending')
  @Public()
  @ApiOperation({
    summary: 'Get pending catalog entries',
    description:
      'Retrieves all pending catalog entries awaiting processing. No authentication required.',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Pending catalog entries retrieved successfully',
  })
  async findPending(): Promise<ApiResponse<any[]>> {
    const submissions = await this.catalogService.findPending();
    return {
      data: submissions,
      message: 'Pending catalog entries retrieved successfully',
    };
  }

  @Get('submissions/:submissionId')
  @Public()
  @ApiOperation({
    summary: 'Get catalog submission/entry by ID (alias for entries/:id)',
    description:
      'Retrieves a catalog entry or submission by ID. Same as GET /catalog/entries/:id. No authentication required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Catalog entry or submission retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Not found' })
  async getSubmissionById(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.findOne(submissionId);
    return {
      data: entry,
      message: 'Catalog submission retrieved successfully',
    };
  }

  @Get('entries')
  @Public()
  @ApiOperation({
    summary: 'Get all catalog entries',
    description:
      'Retrieves all catalog entries with optional status filtering. No authentication required.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    description: 'Filter by status. in_progress returns same as pending (entries not yet completed).',
  })
  @SwaggerApiResponse({ status: 200, description: 'Catalog entries retrieved successfully' })
  async findAll(@Query('status') status?: 'pending' | 'in_progress' | 'completed'): Promise<ApiResponse<any[]>> {
    const entries = await this.catalogService.findAll(status);
    return {
      data: entries,
      message: 'Catalog entries retrieved successfully',
    };
  }

  @Get('entries/:submissionId')
  @Public()
  @ApiOperation({
    summary: 'Get catalog entry by submission ID',
    description:
      'Retrieves a specific catalog entry by submission ID. No authentication required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Catalog entry retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Catalog entry not found' })
  async findOne(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.findOne(submissionId);
    return {
      data: entry,
      message: 'Catalog entry retrieved successfully',
    };
  }

  @Post('entries/:submissionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CATALOG', 'ADMIN')
  @ApiOperation({
    summary: 'Create catalog entry',
    description: 'Creates a new catalog entry from a submission. Catalog/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @ApiBody({ type: CreateCatalogEntryDto })
  @SwaggerApiResponse({ status: 201, description: 'Catalog entry created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Catalog/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async create(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() createDto: CreateCatalogEntryDto,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.create(submissionId, req.user.id, createDto);
    return {
      data: entry,
      message: 'Catalog entry created successfully',
    };
  }

  @Put('entries/:submissionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CATALOG', 'ADMIN')
  @ApiOperation({
    summary: 'Update catalog entry',
    description: 'Updates an existing catalog entry. Catalog/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @ApiBody({ type: UpdateCatalogEntryDto })
  @SwaggerApiResponse({ status: 200, description: 'Catalog entry updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Catalog/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Catalog entry not found' })
  async update(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() updateDto: UpdateCatalogEntryDto,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.update(submissionId, req.user.id, updateDto);
    return {
      data: entry,
      message: 'Catalog entry updated successfully',
    };
  }

  @Post('entries/:submissionId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CATALOG', 'ADMIN')
  @ApiOperation({
    summary: 'Mark catalog entry as complete',
    description: 'Marks a catalog entry as completed. Catalog/Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Catalog entry marked as completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Catalog/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Catalog entry not found' })
  async markComplete(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const entry = await this.catalogService.markComplete(submissionId, req.user.id);
    return {
      data: entry,
      message: 'Catalog entry marked as completed',
    };
  }

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get catalog dashboard statistics',
    description:
      'Retrieves dashboard statistics for catalog operations. Catalog/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Catalog/Admin access required' })
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.catalogService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}

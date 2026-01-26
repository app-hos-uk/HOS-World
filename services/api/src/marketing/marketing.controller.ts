import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
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
import { MarketingService } from './marketing.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/create-material.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { MaterialType } from '@prisma/client';

@ApiTags('marketing')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MARKETING', 'ADMIN')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Get pending marketing submissions', description: 'Retrieves all product submissions pending marketing review. Marketing/Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Pending submissions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  async findPending(): Promise<ApiResponse<any[]>> {
    const submissions = await this.marketingService.findPending();
    return {
      data: submissions,
      message: 'Pending marketing materials retrieved successfully',
    };
  }

  @Get('materials')
  @ApiOperation({ summary: 'Get all marketing materials', description: 'Retrieves all marketing materials with optional filtering. Marketing/Admin access required.' })
  @ApiQuery({ name: 'submissionId', required: false, type: String, description: 'Filter by submission ID' })
  @ApiQuery({ name: 'type', required: false, enum: MaterialType, description: 'Filter by material type' })
  @SwaggerApiResponse({ status: 200, description: 'Marketing materials retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  async findAllMaterials(
    @Query('submissionId') submissionId?: string,
    @Query('type') type?: MaterialType,
  ): Promise<ApiResponse<any[]>> {
    const materials = await this.marketingService.findAllMaterials(submissionId, type);
    return {
      data: materials,
      message: 'Marketing materials retrieved successfully',
    };
  }

  @Get('materials/:id')
  @ApiOperation({ summary: 'Get marketing material by ID', description: 'Retrieves a specific marketing material by ID. Marketing/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Material UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Marketing material retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Material not found' })
  async findOneMaterial(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const material = await this.marketingService.findOneMaterial(id);
    return {
      data: material,
      message: 'Marketing material retrieved successfully',
    };
  }

  @Post('materials')
  @ApiOperation({ summary: 'Create marketing material', description: 'Creates a new marketing material. Marketing/Admin access required.' })
  @ApiBody({ type: CreateMaterialDto })
  @SwaggerApiResponse({ status: 201, description: 'Marketing material created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  async createMaterial(
    @Request() req: any,
    @Body() createDto: CreateMaterialDto,
  ): Promise<ApiResponse<any>> {
    const material = await this.marketingService.createMaterial(
      req.user.id,
      createDto,
    );
    return {
      data: material,
      message: 'Marketing material created successfully',
    };
  }

  @Put('materials/:id')
  @ApiOperation({ summary: 'Update marketing material', description: 'Updates an existing marketing material. Marketing/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Material UUID', type: String })
  @ApiBody({ type: UpdateMaterialDto })
  @SwaggerApiResponse({ status: 200, description: 'Marketing material updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Material not found' })
  async updateMaterial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMaterialDto,
  ): Promise<ApiResponse<any>> {
    const material = await this.marketingService.updateMaterial(id, updateDto);
    return {
      data: material,
      message: 'Marketing material updated successfully',
    };
  }

  @Delete('materials/:id')
  @ApiOperation({ summary: 'Delete marketing material', description: 'Deletes a marketing material. Marketing/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Material UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Marketing material deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Material not found' })
  async deleteMaterial(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.marketingService.deleteMaterial(id);
    return {
      data: result,
      message: result.message,
    };
  }

  @Post('submissions/:submissionId/complete')
  @ApiOperation({ summary: 'Mark submission as complete', description: 'Marks a product submission as marketing complete. Marketing/Admin access required.' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Submission marked as complete' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async markComplete(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const submission = await this.marketingService.markComplete(submissionId);
    return {
      data: submission,
      message: 'Marketing materials marked as completed',
    };
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get marketing dashboard statistics', description: 'Retrieves dashboard statistics for marketing operations. Marketing/Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  async getDashboardStats(): Promise<ApiResponse<any>> {
    const stats = await this.marketingService.getDashboardStats();
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}


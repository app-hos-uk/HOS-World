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
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { ProductSubmissionStatus } from '@prisma/client';

@ApiTags('submissions')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WHOLESALER', 'B2C_SELLER', 'SELLER')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create product submission',
    description: 'Creates a new product submission for review. Seller access required.',
  })
  @ApiBody({ type: CreateSubmissionDto })
  @SwaggerApiResponse({ status: 201, description: 'Product submission created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller access required' })
  async create(
    @Request() req: any,
    @Body() createSubmissionDto: CreateSubmissionDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.submissionsService.create(
      req.user.id,
      createSubmissionDto,
    );
    return {
      data: submission,
      message: 'Product submission created successfully',
    };
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk create product submissions',
    description: 'Creates multiple product submissions at once. Seller access required.',
  })
  @ApiBody({
    description: 'Bulk create submissions',
    schema: {
      type: 'object',
      required: ['submissions'],
      properties: {
        submissions: {
          type: 'array',
          items: { $ref: '#/components/schemas/CreateSubmissionDto' },
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Product submissions created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller access required' })
  async bulkCreate(
    @Request() req: any,
    @Body() body: { submissions: CreateSubmissionDto[] },
  ): Promise<ApiResponse<any>> {
    const result = await this.submissionsService.bulkCreate(
      req.user.id,
      body.submissions,
    );
    return {
      data: result,
      message: `${result.count} product submissions created successfully`,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all product submissions',
    description: 'Retrieves all product submissions for the authenticated seller with optional status filtering.',
  })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by submission status' })
  @SwaggerApiResponse({ status: 200, description: 'Submissions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller access required' })
  async findAll(
    @Request() req: any,
    @Query('status') status?: ProductSubmissionStatus,
  ): Promise<ApiResponse<any[]>> {
    const submissions = await this.submissionsService.findAll(req.user.id, status);
    return {
      data: submissions,
      message: 'Submissions retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get submission by ID',
    description: 'Retrieves a specific product submission by ID. Sellers can only view their own submissions.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Submission retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this submission' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const submission = await this.submissionsService.findOne(id, req.user.id);
    return {
      data: submission,
      message: 'Submission retrieved successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update product submission',
    description: 'Updates an existing product submission. Sellers can only update their own submissions.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @ApiBody({ type: UpdateSubmissionDto })
  @SwaggerApiResponse({ status: 200, description: 'Submission updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot update this submission' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubmissionDto: UpdateSubmissionDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.submissionsService.update(
      id,
      req.user.id,
      updateSubmissionDto,
    );
    return {
      data: submission,
      message: 'Submission updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete product submission',
    description: 'Deletes a product submission. Sellers can only delete their own submissions.',
  })
  @ApiParam({ name: 'id', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Submission deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot delete this submission' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async delete(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.submissionsService.delete(id, req.user.id);
    return {
      data: result,
      message: result.message,
    };
  }
}


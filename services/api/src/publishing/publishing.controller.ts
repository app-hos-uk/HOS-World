import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { PublishingService } from './publishing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('publishing')
@ApiBearerAuth('JWT-auth')
@Controller('publishing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  @Get('ready')
  @ApiOperation({
    summary: 'Get ready to publish submissions (Admin only)',
    description: 'Retrieves all product submissions that are ready to be published. Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Ready to publish submissions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getReadyToPublish(): Promise<ApiResponse<any[]>> {
    const submissions = await this.publishingService.getReadyToPublish();
    return {
      data: submissions,
      message: 'Ready to publish submissions retrieved successfully',
    };
  }

  @Get('published')
  @ApiOperation({
    summary: 'Get published products (Admin only)',
    description: 'Retrieves all published products. Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Published products retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getPublishedProducts(): Promise<ApiResponse<any[]>> {
    const products = await this.publishingService.getPublishedProducts();
    return {
      data: products,
      message: 'Published products retrieved successfully',
    };
  }

  @Post('publish/:submissionId')
  @ApiOperation({
    summary: 'Publish product (Admin only)',
    description: 'Publishes a product submission to the marketplace. Admin access required.',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product published successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Submission not ready for publishing' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Submission not found' })
  async publish(
    @Request() req: any,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.publishingService.publish(submissionId, req.user.id);
    return {
      data: result,
      message: 'Product published successfully',
    };
  }

  @Post('bulk-publish')
  @ApiOperation({
    summary: 'Bulk publish products (Admin only)',
    description: 'Publishes multiple product submissions at once. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['submissionIds'],
      properties: {
        submissionIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Array of submission UUIDs to publish',
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Bulk publish completed' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async bulkPublish(
    @Request() req: any,
    @Body() body: { submissionIds: string[] },
  ): Promise<ApiResponse<any>> {
    const result = await this.publishingService.bulkPublish(
      body.submissionIds,
      req.user.id,
    );
    return {
      data: result,
      message: `Bulk publish completed: ${result.succeeded} succeeded, ${result.failed} failed`,
    };
  }
}


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
import { PublishingService } from './publishing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('publishing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  @Get('ready')
  async getReadyToPublish(): Promise<ApiResponse<any[]>> {
    const submissions = await this.publishingService.getReadyToPublish();
    return {
      data: submissions,
      message: 'Ready to publish submissions retrieved successfully',
    };
  }

  @Get('published')
  async getPublishedProducts(): Promise<ApiResponse<any[]>> {
    const products = await this.publishingService.getPublishedProducts();
    return {
      data: products,
      message: 'Published products retrieved successfully',
    };
  }

  @Post('publish/:submissionId')
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


import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
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
import { SocialSharingService } from './social-sharing.service';
import { ShareItemDto } from './dto/share-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('social-sharing')
@Controller('social-sharing')
export class SocialSharingController {
  constructor(private readonly socialSharingService: SocialSharingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Share item',
    description: 'Shares a product, collection, or other item on social media.',
  })
  @ApiBody({ type: ShareItemDto })
  @SwaggerApiResponse({ status: 201, description: 'Item shared successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async shareItem(
    @Request() req: any,
    @Body() dto: ShareItemDto,
  ): Promise<ApiResponse<any>> {
    const sharedItem = await this.socialSharingService.shareItem(req.user.id, dto);
    return {
      data: sharedItem,
      message: 'Item shared successfully',
    };
  }

  @Public()
  @Get('shared')
  @ApiOperation({
    summary: 'Get shared items',
    description: 'Retrieves shared items. Can filter by user ID. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @SwaggerApiResponse({ status: 200, description: 'Shared items retrieved successfully' })
  async getSharedItems(
    @Query('userId') userId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<ApiResponse<any[]>> {
    const items = await this.socialSharingService.getSharedItems(userId, limit);
    return {
      data: items,
      message: 'Shared items retrieved successfully',
    };
  }

  @Public()
  @Post(':id/view')
  @ApiOperation({
    summary: 'Track share view',
    description: 'Tracks a view of a shared item. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Share ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'View tracked successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Share not found' })
  async trackView(@Param('id') shareId: string): Promise<ApiResponse<{ message: string }>> {
    await this.socialSharingService.trackShareView(shareId);
    return {
      data: { message: 'View tracked successfully' },
      message: 'View tracked successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('share-url')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Generate share URL',
    description: 'Generates a shareable URL for a product, collection, or other item.',
  })
  @ApiQuery({ name: 'type', required: true, type: String, description: 'Item type (product, collection, etc.)' })
  @ApiQuery({ name: 'itemId', required: true, type: String, description: 'Item ID' })
  @SwaggerApiResponse({ status: 200, description: 'Share URL generated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid type or item ID' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getShareUrl(
    @Query('type') type: string,
    @Query('itemId') itemId: string,
  ): Promise<ApiResponse<{ url: string }>> {
    const url = await this.socialSharingService.generateShareUrl(type, itemId);
    return {
      data: { url },
      message: 'Share URL generated successfully',
    };
  }
}


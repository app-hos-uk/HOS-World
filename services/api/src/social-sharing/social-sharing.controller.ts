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
import { SocialSharingService } from './social-sharing.service';
import { ShareItemDto } from './dto/share-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('social-sharing')
export class SocialSharingController {
  constructor(private readonly socialSharingService: SocialSharingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share')
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
  async trackView(@Param('id') shareId: string): Promise<ApiResponse<{ message: string }>> {
    await this.socialSharingService.trackShareView(shareId);
    return {
      data: { message: 'View tracked successfully' },
      message: 'View tracked successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('share-url')
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


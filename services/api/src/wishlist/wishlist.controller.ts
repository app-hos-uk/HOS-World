import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post('products/:productId')
  @HttpCode(HttpStatus.CREATED)
  async addToWishlist(
    @Request() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.wishlistService.addToWishlist(req.user.id, productId);
    return {
      data: { message: 'Product added to wishlist' },
      message: 'Product added to wishlist successfully',
    };
  }

  @Delete('products/:productId')
  @HttpCode(HttpStatus.OK)
  async removeFromWishlist(
    @Request() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.wishlistService.removeFromWishlist(req.user.id, productId);
    return {
      data: { message: 'Product removed from wishlist' },
      message: 'Product removed from wishlist successfully',
    };
  }

  @Get()
  async getWishlist(
    @Request() req: any,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ): Promise<ApiResponse<any>> {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const result = await this.wishlistService.getWishlist(req.user.id, page, limit);
    return {
      data: result,
      message: 'Wishlist retrieved successfully',
    };
  }

  @Public()
  @Get('products/:productId/check')
  async checkInWishlist(
    @Request() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ApiResponse<{ inWishlist: boolean }>> {
    if (!req.user) {
      return {
        data: { inWishlist: false },
        message: 'Not authenticated',
      };
    }

    const inWishlist = await this.wishlistService.isInWishlist(req.user.id, productId);
    return {
      data: { inWishlist },
      message: 'Wishlist status retrieved',
    };
  }
}


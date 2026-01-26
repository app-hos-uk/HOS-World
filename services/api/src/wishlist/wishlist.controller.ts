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
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('wishlist')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post('products/:productId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add product to wishlist',
    description: 'Adds a product to the authenticated user\'s wishlist.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 201, description: 'Product added to wishlist successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
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
  @ApiOperation({
    summary: 'Remove product from wishlist',
    description: 'Removes a product from the authenticated user\'s wishlist.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product removed from wishlist successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Product not in wishlist' })
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
  @ApiOperation({
    summary: 'Get wishlist',
    description: 'Retrieves the authenticated user\'s wishlist with pagination.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @SwaggerApiResponse({ status: 200, description: 'Wishlist retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({
    summary: 'Check if product is in wishlist',
    description: 'Checks if a product is in the user\'s wishlist. Public endpoint, returns false if not authenticated.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Wishlist status retrieved' })
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


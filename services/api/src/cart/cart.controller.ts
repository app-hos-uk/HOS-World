import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse, Cart } from '@hos-marketplace/shared-types';

@ApiTags('cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get user cart', description: 'Retrieves the authenticated user\'s shopping cart with all items' })
  @SwaggerApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getCart(@Request() req: any): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.getCart(req.user.id);
    return {
      data: cart,
      message: 'Cart retrieved successfully',
    };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart', description: 'Adds a product to the user\'s shopping cart. Supports product variations' })
  @ApiBody({ type: AddToCartDto })
  @SwaggerApiResponse({ status: 201, description: 'Item added to cart successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data or product not available' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async addItem(
    @Request() req: any,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.addItem(req.user.id, addToCartDto);
    return {
      data: cart,
      message: 'Item added to cart successfully',
    };
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update cart item', description: 'Updates the quantity or other properties of a cart item' })
  @ApiParam({ name: 'id', description: 'Cart item UUID', type: String })
  @ApiBody({ type: UpdateCartItemDto })
  @SwaggerApiResponse({ status: 200, description: 'Cart item updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Cart item not found' })
  async updateItem(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateCartItemDto,
  ): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.updateItem(req.user.id, id, updateItemDto);
    return {
      data: cart,
      message: 'Cart item updated successfully',
    };
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from cart', description: 'Removes a specific item from the user\'s shopping cart' })
  @ApiParam({ name: 'id', description: 'Cart item UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Item removed from cart successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Cart item not found' })
  async removeItem(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.removeItem(req.user.id, id);
    return {
      data: cart,
      message: 'Item removed from cart successfully',
    };
  }

  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear cart', description: 'Removes all items from the user\'s shopping cart' })
  @SwaggerApiResponse({ status: 200, description: 'Cart cleared successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@Request() req: any): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.clearCart(req.user.id);
    return {
      data: cart,
      message: 'Cart cleared successfully',
    };
  }
}

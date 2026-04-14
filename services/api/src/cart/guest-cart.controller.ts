import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiHeader,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse, Cart } from '@hos-marketplace/shared-types';

@ApiTags('cart')
@Controller('cart/guest')
@Public()
export class GuestCartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Get or create guest cart' })
  @SwaggerApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  async getCart(@Headers('x-guest-session') guestSessionId: string): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.getGuestCart(guestSessionId);
    return { data: cart, message: 'Cart retrieved successfully' };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiBody({ type: AddToCartDto })
  @ApiOperation({ summary: 'Add item to guest cart' })
  async addItem(
    @Headers('x-guest-session') guestSessionId: string,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.addGuestItem(guestSessionId, addToCartDto);
    return { data: cart, message: 'Item added to cart successfully' };
  }

  @Patch('items/:id')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiParam({ name: 'id', description: 'Cart item UUID' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiOperation({ summary: 'Update guest cart item' })
  async updateItem(
    @Headers('x-guest-session') guestSessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateCartItemDto,
  ): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.updateGuestItem(guestSessionId, id, updateItemDto);
    return { data: cart, message: 'Cart item updated successfully' };
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Remove item from guest cart' })
  async removeItem(
    @Headers('x-guest-session') guestSessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.removeGuestItem(guestSessionId, id);
    return { data: cart, message: 'Item removed from cart successfully' };
  }

  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Clear guest cart' })
  async clearCart(@Headers('x-guest-session') guestSessionId: string): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.clearGuestCart(guestSessionId);
    return { data: cart, message: 'Cart cleared successfully' };
  }
}

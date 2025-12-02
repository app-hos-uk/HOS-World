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
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse, Cart } from '@hos-marketplace/shared-types';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req: any): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.getCart(req.user.id);
    return {
      data: cart,
      message: 'Cart retrieved successfully',
    };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
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
  async clearCart(@Request() req: any): Promise<ApiResponse<Cart>> {
    const cart = await this.cartService.clearCart(req.user.id);
    return {
      data: cart,
      message: 'Cart cleared successfully',
    };
  }
}

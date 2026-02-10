import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { GatewayAuthGuard } from '@hos-marketplace/auth-common';

@ApiTags('cart')
@Controller('cart')
@UseGuards(GatewayAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req: any) { return { data: await this.cartService.getCart(req.user.id), message: 'Cart retrieved' }; }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  async addItem(@Request() req: any, @Body() data: { productId: string; variationId?: string; quantity?: number }) {
    return { data: await this.cartService.addItem(req.user.id, data), message: 'Item added to cart' };
  }

  @Put('items/:itemId')
  async updateItem(@Request() req: any, @Param('itemId') itemId: string, @Body() body: { quantity: number }) {
    return { data: await this.cartService.updateItem(req.user.id, itemId, body.quantity), message: 'Cart item updated' };
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  async removeItem(@Request() req: any, @Param('itemId') itemId: string) {
    return { data: await this.cartService.removeItem(req.user.id, itemId), message: 'Item removed' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearCart(@Request() req: any) { return { data: await this.cartService.clearCart(req.user.id), message: 'Cart cleared' }; }
}

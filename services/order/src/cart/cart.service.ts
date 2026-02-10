import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderPrismaService } from '../database/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: OrderPrismaService) {}

  async getCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { userId }, include: { items: true } });
    }
    return cart;
  }

  async addItem(userId: string, data: { productId: string; variationId?: string; quantity?: number }) {
    const cart = await this.getCart(userId);
    const existing = cart.items.find((i) => i.productId === data.productId && i.variationId === (data.variationId || null));
    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + (data.quantity || 1) } });
    } else {
      await this.prisma.cartItem.create({ data: { cartId: cart.id, productId: data.productId, variationId: data.variationId, quantity: data.quantity || 1 } });
    }
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const cart = await this.getCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');
    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }
}

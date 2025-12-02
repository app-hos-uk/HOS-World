import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import type { Cart, CartItem, Product } from '@hos-marketplace/shared-types';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string): Promise<Cart> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cart) {
      // Create empty cart
      cart = await this.prisma.cart.create({
        data: {
          userId,
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    orderBy: { order: 'asc' },
                    take: 1,
                  },
                  seller: {
                    select: {
                      id: true,
                      storeName: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    return this.mapToCartType(cart);
  }

  async addItem(userId: string, addToCartDto: AddToCartDto): Promise<Cart> {
    // Verify product exists and is available
    const product = await this.prisma.product.findUnique({
      where: { id: addToCartDto.productId },
      include: {
        images: {
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('Product is not available');
    }

    if (product.stock < addToCartDto.quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    // Check if item already exists in cart with same variations
    const existingItem = cart.items.find((item) => {
      if (item.productId !== addToCartDto.productId) return false;
      const itemVariations = item.variationOptions as Record<string, string> | null;
      const newVariations = addToCartDto.variationOptions || {};

      if (!itemVariations && !addToCartDto.variationOptions) return true;
      if (!itemVariations || !addToCartDto.variationOptions) return false;

      const itemKeys = Object.keys(itemVariations).sort().join(',');
      const newKeys = Object.keys(newVariations).sort().join(',');
      if (itemKeys !== newKeys) return false;

      return Object.keys(itemVariations).every(
        (key) => itemVariations[key] === newVariations[key],
      );
    });

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + addToCartDto.quantity;
      if (newQuantity > product.stock) {
        throw new BadRequestException('Insufficient stock available');
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          price: product.price, // Update price in case it changed
        },
      });
    } else {
      // Add new item
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity: addToCartDto.quantity,
          variationOptions: addToCartDto.variationOptions || {},
          price: product.price,
        },
      });
    }

    // Recalculate cart totals
    return this.recalculateCart(cart.id);
  }

  async updateItem(
    userId: string,
    itemId: string,
    updateItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.cart.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this item');
    }

    if (item.product.stock < updateItemDto.quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: updateItemDto.quantity,
        price: item.product.price, // Update price in case it changed
      },
    });

    return this.recalculateCart(item.cartId);
  }

  async removeItem(userId: string, itemId: string): Promise<Cart> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.cart.userId !== userId) {
      throw new ForbiddenException('You do not have permission to remove this item');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.recalculateCart(item.cartId);
  }

  async clearCart(userId: string): Promise<Cart> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.recalculateCart(cart.id);
  }

  private async recalculateCart(cartId: string): Promise<Cart> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    let subtotal = new Decimal(0);
    let tax = new Decimal(0);

    for (const item of cart.items) {
      const itemTotal = new Decimal(item.price).mul(item.quantity);
      subtotal = subtotal.add(itemTotal);
      const itemTax = itemTotal.mul(item.product.taxRate);
      tax = tax.add(itemTax);
    }

    const total = subtotal.add(tax);

    const updatedCart = await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        tax,
        total,
        currency: cart.items[0]?.product.currency || 'USD',
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.mapToCartType(updatedCart);
  }

  private mapToCartType(cart: any): Cart {
    return {
      id: cart.id,
      userId: cart.userId || undefined,
      items: cart.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        product: this.mapToProductType(item.product),
        quantity: item.quantity,
        variationOptions: (item.variationOptions as Record<string, string>) || undefined,
        price: Number(item.price),
      })),
      total: Number(cart.total),
      subtotal: Number(cart.subtotal),
      tax: Number(cart.tax),
      currency: cart.currency,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private mapToProductType(product: any): Product {
    return {
      id: product.id,
      sellerId: product.seller.userId || product.sellerId,
      name: product.name,
      description: product.description,
      slug: product.slug,
      sku: product.sku || undefined,
      barcode: product.barcode || undefined,
      ean: product.ean || undefined,
      price: Number(product.price),
      tradePrice: product.tradePrice ? Number(product.tradePrice) : undefined,
      rrp: product.rrp ? Number(product.rrp) : undefined,
      currency: product.currency,
      taxRate: Number(product.taxRate),
      stock: product.stock,
      images: product.images?.map((img: any) => ({
        id: img.id,
        url: img.url,
        alt: img.alt || undefined,
        order: img.order,
        type: img.type.toLowerCase() as any,
      })) || [],
      variations: undefined,
      fandom: product.fandom || undefined,
      category: product.category || undefined,
      tags: product.tags || [],
      status: product.status.toLowerCase() as any,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { ShippingService } from '../shipping/shipping.service';
import { TaxService } from '../tax/tax.service';
import { ProductStatus, ImageType } from '@prisma/client';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import type { Cart, CartItem, Product } from '@hos-marketplace/shared-types';
import { Decimal } from '@prisma/client/runtime/library';

// Valid product status values for the shared types Product interface
type ValidProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock';

const VALID_PRODUCT_STATUSES: Set<string> = new Set([
  'draft',
  'active',
  'inactive',
  'out_of_stock',
]);

/**
 * Normalize and validate a product status from Prisma enum to shared types literal.
 * Prisma uses uppercase (DRAFT, ACTIVE, etc.) while shared types use lowercase.
 * Unknown or invalid statuses default to 'draft' to prevent type mismatches.
 */
function normalizeProductStatus(status: string | null | undefined): ValidProductStatus {
  if (!status) return 'draft';

  const normalized = status.toLowerCase();

  // Only return if it's a known valid status
  if (VALID_PRODUCT_STATUSES.has(normalized)) {
    return normalized as ValidProductStatus;
  }

  // For any unknown status (ARCHIVED, DISCONTINUED, etc.), default to 'inactive'
  // as it's the safest semantic match for non-active products
  return 'inactive';
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(PromotionsService) private promotionsService?: PromotionsService,
    @Optional() @Inject(ShippingService) private shippingService?: ShippingService,
    @Optional() @Inject(TaxService) private taxService?: TaxService,
  ) {}

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
          orderBy: { id: 'desc' },
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

    // Enforce max cart items limit to prevent abuse
    const MAX_CART_ITEMS = 50;
    if (cart.items.length >= MAX_CART_ITEMS) {
      const hasMatchingItem = cart.items.some((item) => item.productId === addToCartDto.productId);
      if (!hasMatchingItem) {
        throw new BadRequestException(
          `Cart cannot contain more than ${MAX_CART_ITEMS} distinct items`,
        );
      }
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

      return Object.keys(itemVariations).every((key) => itemVariations[key] === newVariations[key]);
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

  private assertGuestSession(guestSessionId: string | undefined): string {
    const id = guestSessionId?.trim();
    if (!id || id.length < 8 || id.length > 128) {
      throw new BadRequestException('Valid X-Guest-Session header is required');
    }
    return id;
  }

  async getGuestCart(guestSessionId: string): Promise<Cart> {
    const sid = this.assertGuestSession(guestSessionId);
    let cart = await this.prisma.cart.findUnique({
      where: { guestSessionId: sid },
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
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          guestSessionId: sid,
          userId: null,
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
            orderBy: { id: 'desc' },
          },
        },
      });
    }

    return this.mapToCartType(cart);
  }

  async addGuestItem(guestSessionId: string, addToCartDto: AddToCartDto): Promise<Cart> {
    const sid = this.assertGuestSession(guestSessionId);
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

    let cart = await this.prisma.cart.findUnique({
      where: { guestSessionId: sid },
      include: { items: true },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          guestSessionId: sid,
          userId: null,
        },
        include: { items: true },
      });
    }

    if (cart.userId) {
      throw new BadRequestException('Invalid guest cart');
    }

    const MAX_CART_ITEMS = 50;
    if (cart.items.length >= MAX_CART_ITEMS) {
      const hasMatchingItem = cart.items.some((item) => item.productId === addToCartDto.productId);
      if (!hasMatchingItem) {
        throw new BadRequestException(
          `Cart cannot contain more than ${MAX_CART_ITEMS} distinct items`,
        );
      }
    }

    const existingItem = cart.items.find((item) => {
      if (item.productId !== addToCartDto.productId) return false;
      const itemVariations = item.variationOptions as Record<string, string> | null;
      const newVariations = addToCartDto.variationOptions || {};

      if (!itemVariations && !addToCartDto.variationOptions) return true;
      if (!itemVariations || !addToCartDto.variationOptions) return false;

      const itemKeys = Object.keys(itemVariations).sort().join(',');
      const newKeys = Object.keys(newVariations).sort().join(',');
      if (itemKeys !== newKeys) return false;

      return Object.keys(itemVariations).every((key) => itemVariations[key] === newVariations[key]);
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + addToCartDto.quantity;
      if (newQuantity > product.stock) {
        throw new BadRequestException('Insufficient stock available');
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          price: product.price,
        },
      });
    } else {
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

    return this.recalculateCart(cart.id);
  }

  async updateGuestItem(
    guestSessionId: string,
    itemId: string,
    updateItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const sid = this.assertGuestSession(guestSessionId);
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

    if (item.cart.guestSessionId !== sid) {
      throw new ForbiddenException('You do not have permission to update this item');
    }

    if (item.product.stock < updateItemDto.quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: updateItemDto.quantity,
        price: item.product.price,
      },
    });

    return this.recalculateCart(item.cartId);
  }

  async removeGuestItem(guestSessionId: string, itemId: string): Promise<Cart> {
    const sid = this.assertGuestSession(guestSessionId);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.cart.guestSessionId !== sid) {
      throw new ForbiddenException('You do not have permission to remove this item');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.recalculateCart(item.cartId);
  }

  async clearGuestCart(guestSessionId: string): Promise<Cart> {
    const sid = this.assertGuestSession(guestSessionId);
    const cart = await this.prisma.cart.findUnique({
      where: { guestSessionId: sid },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.recalculateCart(cart.id);
  }

  /**
   * Merge guest cart lines into the authenticated user's cart, then delete the guest cart.
   */
  async mergeGuestCart(guestSessionId: string, userId: string): Promise<Cart> {
    const sid = guestSessionId?.trim();
    if (!sid) {
      return this.getCart(userId);
    }

    const guestCart = await this.prisma.cart.findUnique({
      where: { guestSessionId: sid },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      if (guestCart) {
        await this.prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
      }
      return this.getCart(userId);
    }

    for (const line of guestCart.items) {
      await this.addItem(userId, {
        productId: line.productId,
        quantity: line.quantity,
        variationOptions: (line.variationOptions as Record<string, string>) || undefined,
      });
    }

    await this.prisma.cart.delete({ where: { id: guestCart.id } });

    return this.getCart(userId);
  }

  async recalculateCart(cartId: string): Promise<Cart> {
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
                taxClass: {
                  select: {
                    id: true,
                    name: true,
                  },
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

    // Validate all items reference active products; remove invalid/inactive ones
    const invalidItemIds: string[] = [];
    for (const item of cart.items) {
      if (!item.product || item.product.status !== 'ACTIVE') {
        invalidItemIds.push(item.id);
        this.logger.warn(
          `Removing cart item ${item.id} (product ${item.productId}): product is ${item.product ? item.product.status : 'deleted'}`,
        );
      }
    }

    if (invalidItemIds.length > 0) {
      await this.prisma.cartItem.deleteMany({
        where: { id: { in: invalidItemIds } },
      });
      cart.items = cart.items.filter((item) => !invalidItemIds.includes(item.id));
    }

    // Refresh cart item prices from current product data
    for (const item of cart.items) {
      const currentPrice = item.product.price;
      if (!new Decimal(item.price).equals(currentPrice)) {
        await this.prisma.cartItem.update({
          where: { id: item.id },
          data: { price: currentPrice },
        });
        item.price = currentPrice;
      }
    }

    let subtotal = new Decimal(0);
    let tax = new Decimal(0);

    // Get user's location for tax calculation (default address or user country)
    let userLocation: {
      country: string;
      state?: string;
      city?: string;
      postalCode?: string;
    } | null = null;

    if (cart.userId && this.taxService) {
      try {
        // Try to get default address first
        const defaultAddress = await this.prisma.address.findFirst({
          where: {
            userId: cart.userId,
            isDefault: true,
          },
        });

        if (defaultAddress) {
          userLocation = {
            country: defaultAddress.country,
            state: defaultAddress.state || undefined,
            city: defaultAddress.city || undefined,
            postalCode: defaultAddress.postalCode || undefined,
          };
        } else {
          // Fallback to user's country
          const user = await this.prisma.user.findUnique({
            where: { id: cart.userId },
            select: { country: true },
          });

          if (user?.country) {
            userLocation = {
              country: user.country,
            };
          }
        }
      } catch (error) {
        this.logger.warn('Failed to get user location for tax calculation', error);
      }
    }

    // Calculate tax per item using tax zones if available, otherwise fallback to product.taxRate
    for (const item of cart.items) {
      const itemTotal = new Decimal(item.price).mul(item.quantity);
      subtotal = subtotal.add(itemTotal);

      let itemTax = new Decimal(0);

      // Use TaxService if available and product has taxClassId and user location is known
      if (this.taxService && item.product.taxClassId && userLocation && userLocation.country) {
        try {
          const taxCalculation = await this.taxService.calculateTax(
            Number(itemTotal),
            item.product.taxClassId,
            userLocation,
          );
          itemTax = new Decimal(taxCalculation.tax);
        } catch (error) {
          this.logger.warn(
            `Failed to calculate tax for product ${item.productId}, falling back to product.taxRate`,
            error,
          );
          // Fallback to product taxRate
          itemTax = itemTotal.mul(item.product.taxRate || 0);
        }
      } else {
        // Fallback to product taxRate (legacy behavior)
        itemTax = itemTotal.mul(item.product.taxRate || 0);
      }

      tax = tax.add(itemTax);
    }

    // Apply promotions and discounts
    let discount = new Decimal(0);
    const shipping = new Decimal(0);
    const cartSubtotal = Number(subtotal);
    let promotionFreeShipping = false;

    if (this.promotionsService && cart.userId && cart.items.length > 0) {
      try {
        const promotionResult = await this.promotionsService.applyPromotionsToCart(
          cartId,
          cart.userId,
          cart.items.map((item) => ({
            productId: item.productId,
            price: Number(item.price),
            quantity: item.quantity,
            categoryId: item.product.categoryId,
          })),
          cart.couponCode || undefined,
        );
        discount = new Decimal(promotionResult.discount);
        promotionFreeShipping = promotionResult.freeShipping;
      } catch (error) {
        // Log error but don't fail cart calculation
        console.error('Error applying promotions:', error);
      }
    }

    // Clamp discount so it cannot exceed subtotal
    discount = Decimal.min(discount, subtotal);

    // Calculate total with floor at zero
    const total = Decimal.max(subtotal.add(tax).sub(discount).add(shipping), new Decimal(0));

    const updatedCart = await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        tax,
        discount,
        shipping,
        total,
        currency: cart.items[0]?.product.currency || 'USD',
        promotionFreeShipping,
        ...(cart.userId ? { abandonedEmailSentAt: null } : {}),
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
          orderBy: { id: 'desc' },
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
      discount: cart.discount != null ? Number(cart.discount) : 0,
      couponCode: cart.couponCode || undefined,
      shipping: cart.shipping != null ? Number(cart.shipping) : 0,
      promotionFreeShipping: cart.promotionFreeShipping === true,
      currency: cart.currency,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private mapToProductType(product: any): Product {
    return {
      id: product.id,
      sellerId: product.seller?.userId || product.sellerId || '',
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
      taxClassId: product.taxClassId || undefined,
      stock: product.stock,
      images:
        product.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt: img.alt || undefined,
          order: img.order,
          type: img.type as ImageType,
        })) || [],
      variations: undefined,
      fandom: product.fandom || undefined,
      category: product.category || undefined,
      tags: product.tags || [],
      status: normalizeProductStatus(product.status),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

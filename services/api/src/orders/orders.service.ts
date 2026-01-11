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
import { TaxService } from '../tax/tax.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import type { Order, OrderStatus, PaymentStatus } from '@hos-marketplace/shared-types';
import { OrderStatus as PrismaOrderStatus, PaymentStatus as PrismaPaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(TaxService) private taxService?: TaxService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    // Get user's cart with product tax classes
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                seller: true,
                taxClass: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Verify addresses belong to user
    const [shippingAddress, billingAddress] = await Promise.all([
      this.prisma.address.findFirst({
        where: { id: createOrderDto.shippingAddressId, userId },
      }),
      this.prisma.address.findFirst({
        where: { id: createOrderDto.billingAddressId, userId },
      }),
    ]);

    if (!shippingAddress || !billingAddress) {
      throw new NotFoundException('Address not found');
    }

    // Prepare location for tax calculation (use shipping address for tax calculation)
    const taxLocation = {
      country: shippingAddress.country,
      state: shippingAddress.state || undefined,
      city: shippingAddress.city || undefined,
      postalCode: shippingAddress.postalCode || undefined,
    };

    // Group items by seller
    const itemsBySeller = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const sellerId = item.product.seller.userId;
      if (!itemsBySeller.has(sellerId)) {
        itemsBySeller.set(sellerId, []);
      }
      itemsBySeller.get(sellerId)!.push(item);
    }

    // Create orders for each seller
    const orders: Order[] = [];

    for (const [sellerUserId, items] of itemsBySeller) {
      const seller = await this.prisma.seller.findUnique({
        where: { userId: sellerUserId },
      });

      if (!seller) {
        continue;
      }

      // Calculate totals for this seller's items
      let subtotal = new Decimal(0);
      let tax = new Decimal(0);

      for (const item of items) {
        if (item.product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product: ${item.product.name}`,
          );
        }

        const itemTotal = new Decimal(item.price).mul(item.quantity);
        subtotal = subtotal.add(itemTotal);

        let itemTax = new Decimal(0);

        // Use TaxService if available and product has taxClassId
        if (this.taxService && item.product.taxClassId && taxLocation.country) {
          try {
            const taxCalculation = await this.taxService.calculateTax(
              Number(itemTotal),
              item.product.taxClassId,
              taxLocation,
            );
            itemTax = new Decimal(taxCalculation.tax);
          } catch (error) {
            this.logger.warn(
              `Failed to calculate tax for product ${item.productId} in order creation, falling back to product.taxRate`,
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

      const total = subtotal.add(tax);

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Use transaction to ensure atomicity: order creation + stock decrement + cart clearing
      const order = await this.prisma.$transaction(async (tx) => {
        // Re-check stock availability within transaction (prevent race conditions)
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true, name: true },
          });

          if (!product) {
            throw new NotFoundException(`Product ${item.productId} not found`);
          }

          if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            );
          }
        }

        // Create order
        const createdOrder = await tx.order.create({
          data: {
            userId,
            sellerId: seller.id,
            orderNumber,
            subtotal,
            tax,
            total,
            currency: items[0].product.currency,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            shippingAddressId: createOrderDto.shippingAddressId,
            billingAddressId: createOrderDto.billingAddressId,
            paymentMethod: createOrderDto.paymentMethod,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                variationOptions: item.variationOptions,
              })),
            },
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
                  },
                },
              },
            },
            shippingAddress: true,
            billingAddress: true,
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        });

        // Update product stock atomically within transaction
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }

        return createdOrder;
      });

      orders.push(this.mapToOrderType(order, true)); // Include seller at order creation (payment stage)
    }

    // Clear cart after all orders are created (outside transaction to avoid long locks)
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotal: 0,
        tax: 0,
        total: 0,
      },
    });

    // For now, return the first order (in a real system, you might want to handle multiple orders differently)
    return orders[0];
  }

  async findAll(userId: string, role: string): Promise<Order[]> {
    const where: any = {};

    if (role === 'CUSTOMER') {
      where.userId = userId;
    } else if (role === 'SELLER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      if (seller) {
        where.sellerId = seller.id;
      } else {
        return [];
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
        shippingAddress: true,
        billingAddress: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.mapToOrderType(order));
  }

  async findOne(id: string, userId: string, role: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
        shippingAddress: true,
        billingAddress: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (role === 'CUSTOMER' && order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this order');
    }

    if (role === 'SELLER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      if (!seller || order.sellerId !== seller.id) {
        throw new ForbiddenException('You do not have permission to view this order');
      }
    }

    // Include seller information if order is paid (for invoice) or if it's a seller/admin viewing
    const includeSeller = order.paymentStatus === 'PAID' || role === 'SELLER' || role === 'ADMIN';
    return this.mapToOrderType(order, includeSeller);
  }

  async update(
    id: string,
    userId: string,
    role: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { seller: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions - only seller or admin can update orders
    if (role === 'SELLER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      if (!seller || order.sellerId !== seller.id) {
        throw new ForbiddenException('You do not have permission to update this order');
      }
    } else if (role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to update this order');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateOrderDto.status as PrismaOrderStatus,
        paymentStatus: updateOrderDto.paymentStatus as PrismaPaymentStatus,
        trackingCode: updateOrderDto.trackingCode,
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
              },
            },
          },
        },
        shippingAddress: true,
        billingAddress: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.mapToOrderType(updated);
  }

  async addNote(
    id: string,
    userId: string,
    role: string,
    addNoteDto: AddOrderNoteDto,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { seller: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    const canAddNote =
      order.userId === userId || // Customer can add notes
      (role === 'SELLER' &&
        (await this.prisma.seller.findUnique({ where: { userId } }))?.id ===
          order.sellerId) || // Seller can add notes to their orders
      role === 'ADMIN'; // Admin can add notes

    if (!canAddNote) {
      throw new ForbiddenException('You do not have permission to add notes to this order');
    }

    await this.prisma.orderNote.create({
      data: {
        orderId: id,
        content: addNoteDto.content,
        internal: addNoteDto.internal || false,
        createdBy: userId,
      },
    });

    return this.findOne(id, userId, role);
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `HOS-${timestamp}-${random}`;
  }

  private mapToOrderType(order: any, includeSeller: boolean = false): Order {
    const mapped: any = {
      id: order.id,
      userId: order.userId,
      sellerId: order.seller?.userId || order.sellerId,
      orderNumber: order.orderNumber,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        product: {
          id: item.product.id,
          sellerId: item.product.sellerId,
          name: item.product.name,
          description: item.product.description,
          slug: item.product.slug,
          price: Number(item.product.price),
          currency: item.product.currency,
          images: item.product.images?.map((img: any) => ({
            id: img.id,
            url: img.url,
            order: img.order,
          })) || [],
        } as any,
        quantity: item.quantity,
        price: Number(item.price),
        variationOptions: (item.variationOptions as Record<string, string>) || undefined,
      })),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      total: Number(order.total),
      currency: order.currency,
      status: order.status.toLowerCase() as OrderStatus,
      shippingAddress: {
        id: order.shippingAddress.id,
        userId: order.shippingAddress.userId,
        firstName: order.shippingAddress.firstName,
        lastName: order.shippingAddress.lastName,
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state || undefined,
        postalCode: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
        phone: order.shippingAddress.phone || undefined,
        isDefault: order.shippingAddress.isDefault,
      },
      billingAddress: {
        id: order.billingAddress.id,
        userId: order.billingAddress.userId,
        firstName: order.billingAddress.firstName,
        lastName: order.billingAddress.lastName,
        street: order.billingAddress.street,
        city: order.billingAddress.city,
        state: order.billingAddress.state || undefined,
        postalCode: order.billingAddress.postalCode,
        country: order.billingAddress.country,
        phone: order.billingAddress.phone || undefined,
        isDefault: order.billingAddress.isDefault,
      },
      paymentMethod: order.paymentMethod || undefined,
      paymentStatus: order.paymentStatus.toLowerCase() as PaymentStatus,
      trackingCode: order.trackingCode || undefined,
      notes: order.notes?.map((note: any) => ({
        id: note.id,
        content: note.content,
        internal: note.internal,
        createdAt: note.createdAt,
        createdBy: note.createdBy,
      })) || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    // Include seller information if requested (e.g., at payment page or in invoice)
    if (includeSeller && order.seller) {
      mapped.seller = {
        id: order.seller.id,
        userId: order.seller.userId,
        storeName: order.seller.storeName,
        slug: order.seller.slug,
        logo: order.seller.logo || undefined,
        location: {
          country: order.seller.country,
          city: order.seller.city || undefined,
          region: order.seller.region || undefined,
        },
      };
    }

    return mapped as Order;
  }
}

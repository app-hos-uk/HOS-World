import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TaxService } from '../tax/tax.service';
import { WarehouseRoutingService } from '../inventory/warehouse-routing.service';
import { GeocodingService } from '../inventory/geocoding.service';
import { CartService } from '../cart/cart.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { PaymentProviderService } from '../payments/payment-provider.service';
import type { Order, OrderStatus, PaymentStatus } from '@hos-marketplace/shared-types';
import {
  OrderStatus as PrismaOrderStatus,
  PaymentStatus as PrismaPaymentStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly defaultCommissionRate: number;

  private readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['ACCEPTED', 'REJECTED', 'CONFIRMED', 'CANCELLED'],
    ACCEPTED: ['CONFIRMED', 'CANCELLED'],
    REJECTED: [],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['FULFILLED', 'CANCELLED'],
    FULFILLED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: ['REFUNDED'],
    CANCELLED: [],
    REFUNDED: [],
  };

  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const allowed = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition order from ${currentStatus} to ${newStatus}. Allowed transitions: ${(allowed || []).join(', ') || 'none'}`,
      );
    }
  }

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Optional() @Inject(TaxService) private taxService?: TaxService,
    @Optional() private warehouseRoutingService?: WarehouseRoutingService,
    @Optional() private geocodingService?: GeocodingService,
    @Optional() private cartService?: CartService,
    @Optional() private paymentProviderService?: PaymentProviderService,
  ) {
    this.defaultCommissionRate = this.configService.get<number>('DEFAULT_COMMISSION_RATE', 0.1);
  }

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

    // Group items by seller (use sellerId directly - it's the Seller.id, not userId)
    // Platform-owned products have null sellerId, grouped under 'platform' key
    const itemsBySeller = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      // Use product.sellerId directly (Seller.id) - fallback to 'platform' for platform-owned products
      const groupKey = item.product.sellerId || 'platform';
      if (!itemsBySeller.has(groupKey)) {
        itemsBySeller.set(groupKey, []);
      }
      itemsBySeller.get(groupKey)!.push(item);
    }

    // Calculate per-vendor subtotals and validate stock before creating anything
    const vendorGroups: Array<{
      sellerIdOrPlatform: string;
      seller: { id: string; commissionRate?: any } | null;
      items: typeof cart.items;
      subtotal: Decimal;
      tax: Decimal;
      total: Decimal;
    }> = [];

    for (const [sellerIdOrPlatform, items] of itemsBySeller) {
      let seller: { id: string; commissionRate?: any } | null = null;

      if (sellerIdOrPlatform !== 'platform') {
        seller = await this.prisma.seller.findUnique({
          where: { id: sellerIdOrPlatform },
          select: { id: true, commissionRate: true },
        });
        if (!seller) {
          this.logger.warn(`Seller ${sellerIdOrPlatform} not found, skipping items`);
          continue;
        }
      }

      let subtotal = new Decimal(0);
      let tax = new Decimal(0);

      for (const item of items) {
        if (item.product.stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for product: ${item.product.name}`);
        }

        const itemTotal = new Decimal(item.price).mul(item.quantity);
        subtotal = subtotal.add(itemTotal);

        let itemTax = new Decimal(0);
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
              `Failed to calculate tax for product ${item.productId}, falling back to product.taxRate`,
              error,
            );
            itemTax = itemTotal.mul(item.product.taxRate || 0);
          }
        } else {
          itemTax = itemTotal.mul(item.product.taxRate || 0);
        }
        tax = tax.add(itemTax);
      }

      vendorGroups.push({
        sellerIdOrPlatform,
        seller,
        items,
        subtotal,
        tax,
        total: subtotal.add(tax),
      });
    }

    if (vendorGroups.length === 0) {
      throw new BadRequestException(
        'Unable to create order: cart items reference invalid sellers. Please contact support.',
      );
    }

    // Determine if this is a multi-vendor order
    const isMultiVendor = vendorGroups.length > 1;

    // Grand totals for the parent order (include cart-level shipping & discount)
    const grandSubtotal = vendorGroups.reduce((acc, g) => acc.add(g.subtotal), new Decimal(0));
    const grandTax = vendorGroups.reduce((acc, g) => acc.add(g.tax), new Decimal(0));
    const cartShipping = new Decimal(createOrderDto.shippingCost ?? cart.shipping ?? 0);
    const cartDiscount = new Decimal(cart.discount || 0);
    const grandTotal = grandSubtotal.add(grandTax).add(cartShipping).sub(cartDiscount);

    // Use a single transaction for the entire checkout
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-check stock for all items within transaction
      for (const group of vendorGroups) {
        for (const item of group.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true, name: true },
          });
          if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
          if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            );
          }
        }
      }

      // Create parent order (customer-facing, represents the full checkout)
      const parentOrderNumber = this.generateOrderNumber();
      const parentOrder = await tx.order.create({
        data: {
          userId,
          sellerId: isMultiVendor ? null : vendorGroups[0].seller?.id || null,
          orderNumber: parentOrderNumber,
          subtotal: grandSubtotal,
          tax: grandTax,
          total: grandTotal,
          shippingAmount: cartShipping,
          discountAmount: cartDiscount,
          currency: cart.items[0].product.currency || 'USD',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          shippingAddressId: createOrderDto.shippingAddressId,
          billingAddressId: createOrderDto.billingAddressId,
          paymentMethod: createOrderDto.paymentMethod,
          items: {
            create: cart.items.map((item) => ({
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
                  images: { orderBy: { order: 'asc' }, take: 1 },
                },
              },
            },
          },
          shippingAddress: true,
          billingAddress: true,
          seller: { select: { id: true, storeName: true, slug: true } },
        },
      });

      // Create child orders per vendor (only if multi-vendor)
      if (isMultiVendor) {
        for (const group of vendorGroups) {
          const childOrderNumber = this.generateOrderNumber();

          // Warehouse routing per child order
          let fulfillingWarehouseId: string | null = null;
          let fulfillmentCenterId: string | null = null;
          let estimatedDistance: number | null = null;
          let routingMethod = 'MANUAL';

          if (this.warehouseRoutingService && this.geocodingService) {
            try {
              const customerCoords = await this.geocodingService.getCoordinatesForAddress(
                createOrderDto.shippingAddressId,
              );
              if (customerCoords) {
                const productQuantities = group.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                }));
                const routingResult =
                  await this.warehouseRoutingService.findOptimalFulfillmentSource(
                    customerCoords.latitude,
                    customerCoords.longitude,
                    productQuantities,
                  );
                fulfillingWarehouseId = routingResult.warehouseId;
                fulfillmentCenterId = routingResult.fulfillmentCenterId;
                estimatedDistance = routingResult.distance;
                routingMethod = routingResult.routingMethod;
              }
            } catch (routingError) {
              this.logger.error(
                `Child order routing failed for seller ${group.sellerIdOrPlatform}`,
                routingError,
              );
            }
          }

          const commissionRate = group.seller?.commissionRate
            ? Number(group.seller.commissionRate)
            : this.defaultCommissionRate;
          const platformFee = group.subtotal.mul(commissionRate);

          // Proportionally allocate shipping and discount to child orders
          const subtotalRatio = grandSubtotal.gt(0)
            ? group.subtotal.div(grandSubtotal)
            : new Decimal(0);
          const childShipping = cartShipping.mul(subtotalRatio);
          const childDiscount = cartDiscount.mul(subtotalRatio);
          const childTotal = group.subtotal.add(group.tax).add(childShipping).sub(childDiscount);

          await tx.order.create({
            data: {
              userId,
              sellerId: group.seller?.id || null,
              parentOrderId: parentOrder.id,
              orderNumber: childOrderNumber,
              subtotal: group.subtotal,
              tax: group.tax,
              total: Decimal.max(childTotal, new Decimal(0)),
              shippingAmount: childShipping,
              discountAmount: childDiscount,
              platformFeeAmount: platformFee,
              currency: group.items[0].product.currency || 'USD',
              status: 'PENDING',
              paymentStatus: 'PENDING',
              shippingAddressId: createOrderDto.shippingAddressId,
              billingAddressId: createOrderDto.billingAddressId,
              paymentMethod: createOrderDto.paymentMethod,
              fulfillingWarehouseId,
              fulfillmentCenterId,
              estimatedDistance,
              routingMethod,
              items: {
                create: group.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  price: item.price,
                  variationOptions: item.variationOptions,
                })),
              },
            },
          });
        }
      } else {
        // Single vendor: apply warehouse routing to the parent order itself
        if (this.warehouseRoutingService && this.geocodingService) {
          try {
            const customerCoords = await this.geocodingService.getCoordinatesForAddress(
              createOrderDto.shippingAddressId,
            );
            if (customerCoords) {
              const productQuantities = cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              }));
              const routingResult = await this.warehouseRoutingService.findOptimalFulfillmentSource(
                customerCoords.latitude,
                customerCoords.longitude,
                productQuantities,
              );
              await tx.order.update({
                where: { id: parentOrder.id },
                data: {
                  fulfillingWarehouseId: routingResult.warehouseId,
                  fulfillmentCenterId: routingResult.fulfillmentCenterId,
                  estimatedDistance: routingResult.distance,
                  routingMethod: routingResult.routingMethod,
                },
              });
            }
          } catch (routingError) {
            this.logger.error(`Order routing failed for single-vendor order`, routingError);
          }
        }

        // Set platform fee on the parent order for single vendor
        if (vendorGroups[0].seller) {
          const commissionRate = vendorGroups[0].seller.commissionRate
            ? Number(vendorGroups[0].seller.commissionRate)
            : this.defaultCommissionRate;
          await tx.order.update({
            where: { id: parentOrder.id },
            data: { platformFeeAmount: grandSubtotal.mul(commissionRate) },
          });
        }
      }

      // Decrement stock for all items (both Product.stock and VendorProduct.vendorStock)
      for (const group of vendorGroups) {
        for (const item of group.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });

          // Also decrement vendor stock if this product is fulfilled by a vendor
          if (group.seller) {
            const activeVendorProduct = await tx.vendorProduct.findFirst({
              where: {
                productId: item.productId,
                sellerId: group.seller.id,
                status: 'ACTIVE' as any,
              },
            });
            if (activeVendorProduct) {
              await tx.vendorProduct.update({
                where: { id: activeVendorProduct.id },
                data: { vendorStock: { decrement: item.quantity } },
              });
            }
          }
        }
      }

      // Clear cart inside the transaction to prevent double-order on crash
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { subtotal: 0, tax: 0, total: 0 },
      });

      return parentOrder;
    });

    const parentOrder = this.mapToOrderType(result, true);

    // Process referral on the parent order
    if (createOrderDto.referralCode && parentOrder) {
      try {
        await this.processReferralConversion(
          parentOrder.id,
          userId,
          createOrderDto.referralCode,
          createOrderDto.visitorId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to process referral for order ${parentOrder.id}: ${error.message}`,
        );
      }
    }

    return parentOrder;
  }

  /**
   * Process referral conversion - creates commission for influencer
   */
  private async processReferralConversion(
    orderId: string,
    userId: string,
    referralCode: string,
    visitorId?: string,
  ): Promise<void> {
    // Find influencer by referral code
    const influencer = await this.prisma.influencer.findUnique({
      where: { referralCode },
      include: {
        campaigns: {
          where: {
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        },
      },
    });

    if (!influencer || influencer.status !== 'ACTIVE') {
      this.logger.debug(`Referral code ${referralCode} not found or influencer inactive`);
      return;
    }

    // Get order details with items
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, categoryId: true },
            },
          },
        },
      },
    });

    if (!order) {
      return;
    }

    // Commission: Campaign override (single rate for whole order) > per-item weighted category/base rates.
    // Prisma returns Decimal for @db.Decimal - use directly; category rates from JSON are numbers.
    const baseRate: Decimal = influencer.baseCommissionRate;
    const categoryRates = (influencer.categoryCommissions as Record<string, number>) || {};
    let commissionAmount: Decimal;
    let rateApplied: Decimal;
    let rateSource: string;

    // Campaign override: one rate for entire order
    const campaign = influencer.campaigns?.[0];
    if (campaign?.overrideCommissionRate != null) {
      rateApplied = campaign.overrideCommissionRate;
      rateSource = 'CAMPAIGN';
      commissionAmount = order.total.mul(rateApplied);
    } else if (Object.keys(categoryRates).length > 0 && order.items.length > 0) {
      // Weighted rate by item value: each line uses its category rate (or base), then sum commission per item
      let totalCommission = new Decimal(0);
      let usedCategoryRate = false;
      for (const item of order.items) {
        const itemTotal = item.price.mul(item.quantity);
        const categoryId = item.product?.categoryId;
        const categoryRate = categoryId ? categoryRates[categoryId] : undefined;
        const itemRate = categoryRate !== undefined ? new Decimal(categoryRate) : baseRate;
        if (categoryRate !== undefined) usedCategoryRate = true;
        totalCommission = totalCommission.plus(itemTotal.mul(itemRate));
      }
      commissionAmount = totalCommission;
      rateSource = usedCategoryRate ? 'CATEGORY' : 'BASE';
      // Effective rate for display/storage: total commission / order total
      rateApplied = order.total.gt(0) ? commissionAmount.div(order.total) : baseRate;
    } else {
      rateApplied = baseRate;
      rateSource = 'BASE';
      commissionAmount = order.total.mul(baseRate);
    }

    const orderTotal = order.total;

    // Create referral record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + influencer.cookieDuration);

    const referral = await this.prisma.referral.create({
      data: {
        influencerId: influencer.id,
        visitorId,
        userId,
        orderId,
        orderTotal: order.total,
        convertedAt: new Date(),
        expiresAt,
      },
    });

    // Create commission
    await this.prisma.influencerCommission.create({
      data: {
        influencerId: influencer.id,
        referralId: referral.id,
        orderId,
        orderTotal: order.total,
        rateSource,
        rateApplied,
        amount: commissionAmount,
        status: 'PENDING',
        currency: order.currency,
      },
    });

    // Update influencer stats using Decimal for precision
    await this.prisma.influencer.update({
      where: { id: influencer.id },
      data: {
        totalConversions: { increment: 1 },
        totalSalesAmount: { increment: orderTotal },
        totalCommission: { increment: commissionAmount },
      },
    });

    // Convert to Number only for logging display
    const ratePercent = rateApplied.mul(100).toNumber();
    const amountDisplay = commissionAmount.toFixed(2);
    this.logger.log(
      `Commission created for influencer ${influencer.id}: ${amountDisplay} (${rateSource} rate: ${ratePercent}%)`,
    );
  }

  async findAll(
    userId: string,
    role: string,
    opts?: { page?: number; limit?: number; status?: string },
  ): Promise<{ data: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(500, Math.max(1, opts?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (opts?.status) {
      where.status = opts.status.toUpperCase();
    }

    if (role === 'CUSTOMER') {
      where.userId = userId;
      where.parentOrderId = null;
    } else if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      if (seller) {
        where.sellerId = seller.id;
        // Show both multi-vendor child orders AND single-vendor parent orders
        // Single-vendor: parentOrderId is null, sellerId is set on the parent
        // Multi-vendor: parentOrderId is not null, sellerId is set on the child
      } else {
        return {
          data: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        };
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sellerId: true,
                  name: true,
                  description: true,
                  slug: true,
                  price: true,
                  currency: true,
                  images: {
                    orderBy: { order: 'asc' },
                    take: 1,
                    select: { id: true, url: true, order: true },
                  },
                },
              },
            },
          },
          shippingAddress: true,
          billingAddress: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
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
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: orders.map((order) => this.mapToOrderType(order, false, role)),
      pagination: { page, limit, total, totalPages },
    };
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
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
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
        childOrders: {
          include: {
            seller: {
              select: { id: true, storeName: true, slug: true },
            },
            items: {
              include: {
                product: {
                  include: { images: { orderBy: { order: 'asc' }, take: 1 } },
                },
              },
            },
          },
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

    if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      const isDirectSeller = seller && order.sellerId === seller.id;
      const isChildSeller =
        seller && (order as any).childOrders?.some((co: any) => co.sellerId === seller.id);
      if (!isDirectSeller && !isChildSeller) {
        throw new ForbiddenException('You do not have permission to view this order');
      }
    }

    const isSeller = role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER';
    const includeSeller = order.paymentStatus === 'PAID' || isSeller || role === 'ADMIN';
    return this.mapToOrderType(order, includeSeller, role);
  }

  async update(
    id: string,
    userId: string,
    role: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        seller: true,
        childOrders: { select: { id: true, sellerId: true, status: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions - only seller roles or admin can update orders
    if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      const isDirectSeller = seller && order.sellerId === seller.id;
      const isChildSeller =
        seller && (order as any).childOrders?.some((co: any) => co.sellerId === seller.id);
      if (!isDirectSeller && !isChildSeller) {
        throw new ForbiddenException('You do not have permission to update this order');
      }
    } else if (role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to update this order');
    }

    const previousStatus = order.status;

    if (updateOrderDto.status && updateOrderDto.status !== order.status) {
      this.validateStatusTransition(order.status, updateOrderDto.status);
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

    // Auto-create internal note on status change for audit trail
    if (updateOrderDto.status && updateOrderDto.status !== previousStatus) {
      await this.prisma.orderNote.create({
        data: {
          orderId: id,
          content: `Status changed from ${previousStatus} to ${updateOrderDto.status}`,
          internal: true,
          createdBy: userId,
        },
      });

      // When admin updates a parent order's status, cascade to child orders
      // so sellers (who see child orders) get the updated status.
      if (role === 'ADMIN' && !order.parentOrderId) {
        const childOrders = (order as any).childOrders || [];
        for (const child of childOrders) {
          try {
            this.validateStatusTransition(child.status || previousStatus, updateOrderDto.status);
            await this.prisma.order.update({
              where: { id: child.id },
              data: { status: updateOrderDto.status as PrismaOrderStatus },
            });
            await this.prisma.orderNote.create({
              data: {
                orderId: child.id,
                content: `Status cascaded from parent: ${previousStatus} → ${updateOrderDto.status}`,
                internal: true,
                createdBy: userId,
              },
            });
          } catch (cascadeErr) {
            this.logger.warn(
              `Could not cascade status to child order ${child.id}: ${cascadeErr}`,
            );
          }
        }
      }
    }

    return this.mapToOrderType(updated, false, role);
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
    const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
    const canAddNote =
      order.userId === userId ||
      (sellerRoles.includes(role) &&
        (await this.prisma.seller.findUnique({ where: { userId } }))?.id === order.sellerId) ||
      role === 'ADMIN';

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

  /**
   * Vendor accepts a child order assigned to them.
   */
  async vendorAcceptOrder(orderId: string, userId: string): Promise<Order> {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new ForbiddenException('Seller profile not found');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { seller: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.sellerId !== seller.id) {
      throw new ForbiddenException('This order is not assigned to you');
    }
    if (!order.parentOrderId) {
      throw new BadRequestException('Only child orders (vendor splits) can be accepted');
    }
    this.validateStatusTransition(order.status, 'ACCEPTED');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'ACCEPTED' as PrismaOrderStatus },
    });

    // Auto-confirm parent if all children are accepted
    await this.syncParentOrderStatus(order.parentOrderId);

    return this.findOne(orderId, userId, 'SELLER');
  }

  /**
   * Vendor rejects a child order assigned to them.
   */
  async vendorRejectOrder(orderId: string, userId: string, reason: string): Promise<Order> {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new ForbiddenException('Seller profile not found');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { seller: true, items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.sellerId !== seller.id) {
      throw new ForbiddenException('This order is not assigned to you');
    }
    if (!order.parentOrderId) {
      throw new BadRequestException('Only child orders (vendor splits) can be rejected');
    }
    this.validateStatusTransition(order.status, 'REJECTED');

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'REJECTED' as PrismaOrderStatus, rejectionReason: reason },
      });
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        if (seller) {
          const vp = await tx.vendorProduct.findFirst({
            where: { productId: item.productId, sellerId: seller.id },
          });
          if (vp) {
            await tx.vendorProduct.update({
              where: { id: vp.id },
              data: { vendorStock: { increment: item.quantity } },
            });
          }
        }
      }
    });

    // Auto-create internal note documenting the rejection
    await this.prisma.orderNote.create({
      data: {
        orderId,
        content: `Order rejected by vendor. Reason: ${reason}`,
        internal: true,
        createdBy: userId,
      },
    });

    // Check if ALL siblings are now rejected → cancel parent
    await this.syncParentOrderStatus(order.parentOrderId);

    return this.findOne(orderId, userId, 'SELLER');
  }

  /**
   * Syncs the parent order status based on the aggregate state of its children.
   * - All children ACCEPTED → parent auto-CONFIRMED
   * - All children REJECTED → parent auto-CANCELLED
   */
  private async syncParentOrderStatus(parentOrderId: string): Promise<void> {
    const siblings = await this.prisma.order.findMany({
      where: { parentOrderId },
      select: { status: true },
    });
    if (siblings.length === 0) return;

    const allAccepted = siblings.every((s) => s.status === ('ACCEPTED' as PrismaOrderStatus));
    const allRejected = siblings.every((s) => s.status === ('REJECTED' as PrismaOrderStatus));

    if (allAccepted) {
      await this.prisma.order.update({
        where: { id: parentOrderId },
        data: { status: 'CONFIRMED' as PrismaOrderStatus },
      });
      this.logger.log(`Parent order ${parentOrderId} auto-confirmed: all children accepted`);
    } else if (allRejected) {
      await this.prisma.order.update({
        where: { id: parentOrderId },
        data: { status: 'CANCELLED' as PrismaOrderStatus },
      });
      this.logger.log(`Parent order ${parentOrderId} auto-cancelled: all children rejected`);
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HOS-${timestamp}-${random}`;
  }

  /**
   * Cancel an order and restore stock.
   * Customers can only cancel orders in PENDING or CONFIRMED status.
   * Sellers and admins can cancel orders in any non-final status.
   */
  async cancel(id: string, userId: string, role: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        seller: true,
        childOrders: { include: { items: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Customers can only cancel parent orders, not child orders directly
    if (role === 'CUSTOMER') {
      if (order.userId !== userId) {
        throw new ForbiddenException('You do not have permission to cancel this order');
      }
      if (order.parentOrderId !== null) {
        throw new ForbiddenException(
          'You cannot cancel vendor sub-orders directly. Cancel the parent order instead.',
        );
      }
    }

    if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });
      if (!seller || order.sellerId !== seller.id) {
        throw new ForbiddenException('You do not have permission to cancel this order');
      }
    }

    this.validateStatusTransition(order.status, 'CANCELLED');

    const customerCancellableStatuses = ['PENDING', 'CONFIRMED'];
    if (role === 'CUSTOMER' && !customerCancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Customers can only cancel orders that are PENDING or CONFIRMED. Current status: ${order.status}`,
      );
    }

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      const childOrders = (order as any).childOrders || [];
      const isMultiVendor = childOrders.length > 0;

      if (isMultiVendor) {
        // Multi-vendor: restore stock from child orders only (parent items are duplicates)
        for (const child of childOrders) {
          if (child.status !== 'CANCELLED' && child.status !== 'REFUNDED') {
            for (const childItem of child.items) {
              await tx.product.update({
                where: { id: childItem.productId },
                data: { stock: { increment: childItem.quantity } },
              });

              if (child.sellerId) {
                const vp = await tx.vendorProduct.findFirst({
                  where: { productId: childItem.productId, sellerId: child.sellerId },
                });
                if (vp) {
                  await tx.vendorProduct.update({
                    where: { id: vp.id },
                    data: { vendorStock: { increment: childItem.quantity } },
                  });
                }
              }
            }
            await tx.order.update({
              where: { id: child.id },
              data: {
                status: 'CANCELLED',
                paymentStatus: child.paymentStatus === 'PAID' ? 'REFUNDED' : child.paymentStatus,
              },
            });
          }
        }
      } else {
        // Single-vendor or no children: restore stock from parent items
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });

          if (order.sellerId) {
            const vp = await tx.vendorProduct.findFirst({
              where: { productId: item.productId, sellerId: order.sellerId },
            });
            if (vp) {
              await tx.vendorProduct.update({
                where: { id: vp.id },
                data: { vendorStock: { increment: item.quantity } },
              });
            }
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus,
        },
        include: {
          items: {
            include: {
              product: {
                include: { images: { orderBy: { order: 'asc' }, take: 1 } },
              },
            },
          },
          shippingAddress: true,
          billingAddress: true,
          seller: { select: { id: true, storeName: true, slug: true } },
          notes: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    // Issue actual Stripe refund for paid orders
    if (order.paymentStatus === 'PAID' && order.stripePaymentIntentId) {
      if (this.paymentProviderService?.isProviderAvailable('stripe')) {
        try {
          const provider = this.paymentProviderService.getProvider('stripe');
          const result = await provider.refundPayment({
            paymentId: order.stripePaymentIntentId,
            amount: Number(order.total),
            metadata: { currency: order.currency, reason: 'order_cancelled' },
          });
          if (result?.success) {
            this.logger.log(`Stripe refund succeeded for cancelled order ${order.orderNumber}`);
          } else {
            this.logger.warn(`Stripe refund returned non-success for order ${order.orderNumber}`);
          }
        } catch (err) {
          this.logger.error(`Failed to auto-refund cancelled order ${order.orderNumber}: ${err}`);
        }
      } else {
        this.logger.warn(
          `Stripe provider unavailable — refund for order ${order.orderNumber} must be processed manually`,
        );
      }
    }

    this.logger.log(`Order ${order.orderNumber} cancelled by user ${userId} (role: ${role})`);

    return this.mapToOrderType(cancelledOrder);
  }

  /**
   * Reorder items from a previous order by adding them to the cart.
   */
  async reorder(id: string, userId: string): Promise<{ itemsAdded: number; itemsUpdated: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only allow reordering of own orders
    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to reorder this order');
    }

    // Only allow reordering of completed/delivered orders
    const reorderableStatuses = ['DELIVERED'];
    if (!reorderableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Only delivered orders can be reordered. Current status: ${order.status}`,
      );
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          subtotal: 0,
          tax: 0,
          total: 0,
        },
      });
    }

    let itemsAdded = 0;
    let itemsUpdated = 0;

    for (const item of order.items) {
      // Check if product still exists and has stock
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        this.logger.warn(`Product ${item.productId} no longer exists, skipping reorder`);
        continue;
      }

      if (product.stock <= 0) {
        this.logger.warn(`Product ${item.productId} is out of stock, skipping reorder`);
        continue;
      }

      // Determine quantity to add (limited by available stock)
      const quantityToAdd = Math.min(item.quantity, product.stock);

      // Check if item already exists in cart
      const existingCartItem = await this.prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: item.productId,
        },
      });

      if (existingCartItem) {
        // Update quantity of existing cart item
        const newQuantity = Math.min(existingCartItem.quantity + quantityToAdd, product.stock);
        await this.prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: { quantity: newQuantity },
        });
        itemsUpdated++;
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            quantity: quantityToAdd,
            price: Number(product.price),
            variationOptions: item.variationOptions || {},
          },
        });
        itemsAdded++;
      }
    }

    // Recalculate cart totals using CartService (handles tax, promotions, etc.)
    if (this.cartService) {
      await this.cartService.recalculateCart(cart.id);
    } else {
      // Fallback: manual calculation without tax (should not happen in production)
      const cartItems = await this.prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });

      const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

      await this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          subtotal,
          total: subtotal,
        },
      });

      this.logger.warn(
        `CartService not available, using fallback cart calculation without tax for user ${userId}`,
      );
    }

    this.logger.log(
      `Reorder from order ${order.orderNumber}: ${itemsAdded} items added, ${itemsUpdated} items updated in cart for user ${userId}`,
    );

    return { itemsAdded, itemsUpdated };
  }

  private mapToOrderType(order: any, includeSeller: boolean = false, role?: string): Order {
    const mapped: any = {
      id: order.id,
      userId: order.userId,
      sellerId: order.sellerId,
      orderNumber: order.orderNumber,
      parentOrderId: order.parentOrderId || undefined,
      items:
        order.items?.map((item: any) => ({
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
            images:
              item.product.images?.map((img: any) => ({
                id: img.id,
                url: img.url,
                order: img.order,
              })) || [],
          } as any,
          quantity: item.quantity,
          price: Number(item.price),
          variationOptions: (item.variationOptions as Record<string, string>) || undefined,
        })) || [],
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      total: Number(order.total),
      shippingAmount: order.shippingAmount ? Number(order.shippingAmount) : 0,
      discountAmount: order.discountAmount ? Number(order.discountAmount) : 0,
      platformFeeAmount:
        role === 'ADMIN' || role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER'
          ? order.platformFeeAmount
            ? Number(order.platformFeeAmount)
            : undefined
          : undefined,
      currency: order.currency,
      status: order.status.toLowerCase() as OrderStatus,
      shippingAddress: order.shippingAddress
        ? {
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
          }
        : undefined,
      billingAddress: order.billingAddress
        ? {
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
          }
        : undefined,
      paymentMethod: order.paymentMethod || undefined,
      paymentStatus: order.paymentStatus.toLowerCase() as PaymentStatus,
      trackingCode: order.trackingCode || undefined,
      notes:
        order.notes?.map((note: any) => ({
          id: note.id,
          content: note.content,
          internal: note.internal,
          createdAt: note.createdAt,
          createdBy: note.createdBy,
        })) || [],
      childOrders:
        order.childOrders?.map((child: any) => ({
          id: child.id,
          orderNumber: child.orderNumber,
          sellerId: child.sellerId,
          status: child.status?.toLowerCase(),
          total: Number(child.total),
          seller: child.seller
            ? {
                id: child.seller.id,
                storeName: child.seller.storeName,
                slug: child.seller.slug,
              }
            : undefined,
        })) || undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    if (order.user) {
      mapped.user = {
        email: order.user.email,
        firstName: order.user.firstName || undefined,
        lastName: order.user.lastName || undefined,
      };
    }

    if (includeSeller && order.seller) {
      mapped.seller = {
        id: order.seller.id,
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

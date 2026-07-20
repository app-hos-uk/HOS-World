import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CancellationsService } from '../cancellations/cancellations.service';
import { OrderShippingService } from './order-shipping.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { ShipOrderDto, GetOrderShippingRatesDto } from './dto/ship-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse, Order } from '@hos-marketplace/shared-types';

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly cancellationsService: CancellationsService,
    private readonly orderShippingService: OrderShippingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create a new order',
    description: "Creates a new order from the user's cart",
  })
  @ApiBody({ type: CreateOrderDto })
  @SwaggerApiResponse({ status: 201, description: 'Order created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Request() req: any,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.create(req.user.id, createOrderDto);
    return {
      data: order,
      message: 'Order created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description:
      'Retrieves all orders for the authenticated user. Returns different orders based on user role (customer sees their orders, seller sees their orders, admin sees all orders)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('sellerId') sellerId?: string,
  ): Promise<ApiResponse<Order[]>> {
    const result = await this.ordersService.findAll(req.user.id, req.user.role, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      sellerId,
    });
    return {
      data: result.data,
      message: 'Orders retrieved successfully',
      pagination: result.pagination,
    };
  }

  @Public()
  @Get('track/:orderNumber')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Track order by order number (public)',
    description:
      'Returns order status and line items without PII. Does not expose addresses, email, or payment details.',
  })
  @ApiParam({ name: 'orderNumber', description: 'Human-readable order number', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Order tracking info retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async findByOrderNumber(
    @Param('orderNumber') orderNumber: string,
  ): Promise<ApiResponse<any>> {
    const tracking = await this.ordersService.getPublicOrderTracking(orderNumber);
    return {
      data: tracking,
      message: 'Order tracking retrieved successfully',
    };
  }

  @Public()
  @Get('track/:orderNumber/live-tracking')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Live carrier tracking by order number (public)',
    description:
      'Returns live carrier tracking events for a shipped order. No PII is exposed.',
  })
  @ApiParam({ name: 'orderNumber', description: 'Human-readable order number', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Live tracking retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found or no tracking number' })
  async getPublicLiveTracking(
    @Param('orderNumber') orderNumber: string,
  ): Promise<ApiResponse<any>> {
    const tracking = await this.orderShippingService.trackOrderShipmentByOrderNumber(orderNumber);
    return {
      data: tracking,
      message: 'Live shipment tracking retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Retrieves a specific order by ID. Users can only access their own orders unless they are admin or seller',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this order' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.findOne(id, req.user.id, req.user.role);
    return {
      data: order,
      message: 'Order retrieved successfully',
    };
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN')
  @ApiOperation({
    summary: 'Update order',
    description: 'Updates an order. Only sellers and admins can update orders',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @ApiBody({ type: UpdateOrderDto })
  @SwaggerApiResponse({ status: 200, description: 'Order updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.update(id, req.user.id, req.user.role, updateOrderDto);
    return {
      data: order,
      message: 'Order updated successfully',
    };
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add note to order',
    description: 'Adds a note to an order. Notes can be added by customers, sellers, or admins',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @ApiBody({ type: AddOrderNoteDto })
  @SwaggerApiResponse({ status: 201, description: 'Note added successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async addNote(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addNoteDto: AddOrderNoteDto,
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.addNote(id, req.user.id, req.user.role, addNoteDto);
    return {
      data: order,
      message: 'Note added successfully',
    };
  }

  @Post(':id/accept')
  @UseGuards(RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a vendor order',
    description: 'Vendor accepts a child order assigned to them. Transitions PENDING → ACCEPTED.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Order accepted by vendor' })
  @SwaggerApiResponse({ status: 400, description: 'Order cannot be accepted' })
  @SwaggerApiResponse({ status: 403, description: 'Not your order' })
  async acceptOrder(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.vendorAcceptOrder(id, req.user.id);
    return { data: order, message: 'Order accepted successfully' };
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a vendor order',
    description: 'Vendor rejects a child order assigned to them. Transitions PENDING → REJECTED.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Order rejected by vendor' })
  @SwaggerApiResponse({ status: 400, description: 'Order cannot be rejected' })
  @SwaggerApiResponse({ status: 403, description: 'Not your order' })
  async rejectOrder(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.vendorRejectOrder(id, req.user.id, body.reason);
    return { data: order, message: 'Order rejected' };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel order',
    description:
      'Cancels an order. Customers can only cancel orders that are PENDING or CONFIRMED. Stock is restored on cancellation.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Order cannot be cancelled in current status' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot cancel this order' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async cancel(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { reason?: string },
  ): Promise<ApiResponse<Order>> {
    if (req.user.role === 'CUSTOMER') {
      const order = await this.ordersService.findOne(id, req.user.id, req.user.role);
      if (order.paymentStatus?.toUpperCase() === 'PAID') {
        await this.cancellationsService.requestCancellation(req.user.id, {
          orderId: id,
          reason: body?.reason,
        });
        const updatedOrder = await this.ordersService.findOne(id, req.user.id, req.user.role);
        const isCancelled = updatedOrder.status?.toUpperCase() === 'CANCELLED';
        return {
          data: updatedOrder,
          message: isCancelled
            ? 'Order cancelled successfully'
            : 'Cancellation request submitted for review',
        };
      }
    }

    const order = await this.ordersService.cancel(id, req.user.id, req.user.role, {
      skipApproval: true,
      reason: body?.reason,
    });
    return {
      data: order,
      message: 'Order cancelled successfully',
    };
  }

  @Post(':id/reorder')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Reorder items',
    description:
      'Adds all items from a previous order back to the cart. Only available for completed or delivered orders.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 201, description: 'Items added to cart successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Order not eligible for reorder' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot reorder this order' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async reorder(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ itemsAdded: number; itemsUpdated: number }>> {
    const result = await this.ordersService.reorder(id, req.user.id);
    // Build a descriptive message
    const parts: string[] = [];
    if (result.itemsAdded > 0) {
      parts.push(`${result.itemsAdded} new item(s) added`);
    }
    if (result.itemsUpdated > 0) {
      parts.push(`${result.itemsUpdated} existing item(s) updated`);
    }
    const message =
      parts.length > 0 ? parts.join(', ') + ' in cart' : 'No items were added to cart';
    return {
      data: result,
      message,
    };
  }

  @Get(':id/shipping-rates')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @ApiOperation({
    summary: 'Get carrier shipping rates for an order',
    description: 'Returns live carrier rates (Shippo or other configured providers) for the order shipment.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Shipping rates retrieved successfully' })
  async getShippingRates(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetOrderShippingRatesDto,
  ): Promise<ApiResponse<any>> {
    await this.ordersService.findOne(id, req.user.id, req.user.role);
    const rates = await this.orderShippingService.getOrderShippingRates(id, query.provider);
    return {
      data: rates,
      message: 'Shipping rates retrieved successfully',
    };
  }

  @Post(':id/ship')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Purchase shipping label and ship order',
    description:
      'Creates a carrier shipment via Shippo (or configured provider), stores tracking details, and marks the order as shipped.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @ApiBody({ type: ShipOrderDto })
  @SwaggerApiResponse({ status: 200, description: 'Order shipped successfully' })
  async shipOrder(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() shipOrderDto: ShipOrderDto,
  ): Promise<ApiResponse<any>> {
    await this.ordersService.findOne(id, req.user.id, req.user.role);
    const result = await this.orderShippingService.shipOrder(id, shipOrderDto);
    return {
      data: result,
      message: 'Order shipped successfully',
    };
  }

  @Get(':id/shipment-tracking')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'CUSTOMER')
  @ApiOperation({
    summary: 'Track order shipment',
    description: 'Returns live carrier tracking events for the order tracking number.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Shipment tracking retrieved successfully' })
  async getShipmentTracking(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    await this.ordersService.findOne(id, req.user.id, req.user.role);
    const tracking = await this.orderShippingService.trackOrderShipment(id);
    return {
      data: tracking,
      message: 'Shipment tracking retrieved successfully',
    };
  }
}

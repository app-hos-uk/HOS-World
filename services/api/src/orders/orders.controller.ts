import {
  Controller,
  Get,
  Post,
  Put,
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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse, Order } from '@hos-marketplace/shared-types';

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order', description: 'Creates a new order from the user\'s cart' })
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
  @ApiOperation({ summary: 'Get all orders', description: 'Retrieves all orders for the authenticated user. Returns different orders based on user role (customer sees their orders, seller sees their orders, admin sees all orders)' })
  @SwaggerApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: any): Promise<ApiResponse<Order[]>> {
    const orders = await this.ordersService.findAll(req.user.id, req.user.role);
    return {
      data: orders,
      message: 'Orders retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID', description: 'Retrieves a specific order by ID. Users can only access their own orders unless they are admin or seller' })
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
  @Roles('SELLER', 'ADMIN')
  @ApiOperation({ summary: 'Update order', description: 'Updates an order. Only sellers and admins can update orders' })
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
  @ApiOperation({ summary: 'Add note to order', description: 'Adds a note to an order. Notes can be added by customers, sellers, or admins' })
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

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order', description: 'Cancels an order. Customers can only cancel orders that are PENDING or CONFIRMED. Stock is restored on cancellation.' })
  @ApiParam({ name: 'id', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Order cannot be cancelled in current status' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot cancel this order' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async cancel(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Order>> {
    const order = await this.ordersService.cancel(id, req.user.id, req.user.role);
    return {
      data: order,
      message: 'Order cancelled successfully',
    };
  }

  @Post(':id/reorder')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reorder items', description: 'Adds all items from a previous order back to the cart. Only available for completed or delivered orders.' })
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
    const message = parts.length > 0 ? parts.join(', ') + ' in cart' : 'No items were added to cart';
    return {
      data: result,
      message,
    };
  }
}

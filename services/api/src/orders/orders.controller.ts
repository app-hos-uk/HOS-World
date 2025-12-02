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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse, Order } from '@hos-marketplace/shared-types';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  async findAll(@Request() req: any): Promise<ApiResponse<Order[]>> {
    const orders = await this.ordersService.findAll(req.user.id, req.user.role);
    return {
      data: orders,
      message: 'Orders retrieved successfully',
    };
  }

  @Get(':id')
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
}

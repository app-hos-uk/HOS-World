import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';

@ApiTags('orders')
@Controller('orders')
@UseGuards(GatewayAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    const result = await this.ordersService.findAll(req.user.id, { page, limit, status });
    return { data: result, message: 'Orders retrieved' };
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    const order = await this.ordersService.findOne(id, req.user.id);
    return { data: order, message: 'Order retrieved' };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() data: any) {
    const order = await this.ordersService.create(req.user.id, data);
    return { data: order, message: 'Order created' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER')
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const order = await this.ordersService.updateStatus(id, body.status);
    return { data: order, message: 'Order status updated' };
  }
}

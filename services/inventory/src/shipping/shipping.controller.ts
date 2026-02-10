import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles } from '@hos-marketplace/auth-common';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('methods')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'SELLER')
  createMethod(@Body() body: any) {
    return this.shippingService.createShippingMethod(body);
  }

  @Get('methods')
  findAllMethods(@Query('sellerId') sellerId?: string) {
    return this.shippingService.findAllShippingMethods(sellerId);
  }

  @Get('methods/:id')
  findMethod(@Param('id') id: string) {
    return this.shippingService.findShippingMethodById(id);
  }

  @Post('rules')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'SELLER')
  createRule(@Body() body: any) {
    return this.shippingService.createShippingRule(body);
  }

  @Post('calculate')
  calculateRate(@Body() body: { weight: number; cartValue: number; destination: any; sellerId?: string }) {
    return this.shippingService.calculateShippingRate(body.weight, body.cartValue, body.destination, body.sellerId);
  }
}

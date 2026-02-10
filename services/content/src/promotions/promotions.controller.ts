import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { PromotionsService } from './promotions.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'MARKETING')
  create(@Body() body: any) { return this.promotionsService.create(body); }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) { return this.promotionsService.findAll(activeOnly !== 'false'); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.promotionsService.findOne(id); }

  @Put(':id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'MARKETING')
  update(@Param('id') id: string, @Body() body: any) { return this.promotionsService.update(id, body); }

  @Post('coupons')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'MARKETING')
  createCoupon(@Body() body: any) { return this.promotionsService.createCoupon(body); }

  @Post('coupons/validate')
  @UseGuards(GatewayAuthGuard)
  validateCoupon(@Body('code') code: string, @CurrentUser() user: AuthUser) {
    return this.promotionsService.validateCoupon(code, user.id);
  }

  @Post('coupons/apply')
  @UseGuards(GatewayAuthGuard)
  applyCoupon(@Body() body: { code: string; orderId?: string }, @CurrentUser() user: AuthUser) {
    return this.promotionsService.applyCoupon(body.code, user.id, body.orderId);
  }
}

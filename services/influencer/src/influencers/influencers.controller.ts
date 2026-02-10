import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { InfluencersService } from './influencers.service';

@ApiTags('influencers')
@Controller('influencers')
export class InfluencersController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Get('me')
  @UseGuards(GatewayAuthGuard)
  findMe(@CurrentUser() user: AuthUser) { return this.influencersService.findByUserId(user.id); }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) { return this.influencersService.findAll(activeOnly !== 'false'); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.influencersService.findById(id); }

  @Put('me')
  @UseGuards(GatewayAuthGuard)
  update(@CurrentUser() user: AuthUser, @Body() body: any) { return this.influencersService.update(user.id, body); }

  @Post('me/product-links')
  @UseGuards(GatewayAuthGuard)
  createLink(@CurrentUser() user: AuthUser, @Body('productId') productId: string) {
    return this.influencersService.findByUserId(user.id).then((inf) => this.influencersService.createProductLink(inf.id, productId));
  }

  @Get('me/product-links')
  @UseGuards(GatewayAuthGuard)
  getLinks(@CurrentUser() user: AuthUser) {
    return this.influencersService.findByUserId(user.id).then((inf) => this.influencersService.getProductLinks(inf.id));
  }

  @Get('me/commissions')
  @UseGuards(GatewayAuthGuard)
  getCommissions(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.influencersService.findByUserId(user.id).then((inf) => this.influencersService.getCommissions(inf.id, status));
  }

  @Get('me/payouts')
  @UseGuards(GatewayAuthGuard)
  getPayouts(@CurrentUser() user: AuthUser) {
    return this.influencersService.findByUserId(user.id).then((inf) => this.influencersService.getPayouts(inf.id));
  }
}

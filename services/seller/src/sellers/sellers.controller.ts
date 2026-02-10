import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayAuthGuard, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { SellersService } from './sellers.service';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  findAll() {
    return this.sellersService.findAllPublic();
  }

  @Get('me')
  @UseGuards(GatewayAuthGuard)
  @ApiBearerAuth('JWT-auth')
  findMe(@CurrentUser() user: AuthUser) {
    return this.sellersService.findOne(user.id);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.sellersService.findBySlug(slug);
  }

  @Put('me')
  @UseGuards(GatewayAuthGuard)
  update(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.sellersService.update(user.id, body);
  }

  @Put('me/domain')
  @UseGuards(GatewayAuthGuard)
  updateDomain(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.sellersService.updateDomain(user.id, body.customDomain, body.subDomain, body.domainPackagePurchased);
  }
}

import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { StorefrontsService } from './storefronts.service';

@ApiTags('storefronts')
@Controller('storefronts')
export class StorefrontsController {
  constructor(private readonly storefrontsService: StorefrontsService) {}

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) { return this.storefrontsService.findBySlug(slug); }

  @Put('me')
  @UseGuards(GatewayAuthGuard)
  update(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.storefrontsService.update(user.id, body);
  }
}

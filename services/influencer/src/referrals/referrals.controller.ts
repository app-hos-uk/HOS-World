import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { ReferralsService } from './referrals.service';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get(':code')
  findByCode(@Param('code') code: string) { return this.referralsService.findByCode(code); }

  @Post(':code/convert')
  @UseGuards(GatewayAuthGuard)
  convert(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.referralsService.convert(code, user.id);
  }
}

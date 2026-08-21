import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { StripeConnectService } from './stripe-connect.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

import { RequireAccess } from '../../access-control/decorators/require-access.decorator';
type ConnectResponse = ApiResponse<any>;

@Controller('stripe-connect')
export class StripeConnectController {
  constructor(private readonly connectService: StripeConnectService) {}

  @RequireAccess({ permission: 'finance.manage', scope: 'MARKET' })
  @Post('account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async createAccount(@Request() req): Promise<ConnectResponse> {
    const result = await this.connectService.createConnectedAccount(req.user.id);
    return { data: result, message: 'Stripe Connect account created' };
  }

  @RequireAccess({ permission: 'finance.view', scope: 'MARKET' })
  @Get('onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getOnboardingLink(@Request() req): Promise<ConnectResponse> {
    const result = await this.connectService.getOnboardingLink(req.user.id);
    return { data: result, message: 'Onboarding link generated' };
  }

  @RequireAccess({ permission: 'finance.view', scope: 'MARKET' })
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getStatus(@Request() req): Promise<ConnectResponse> {
    const result = await this.connectService.getAccountStatus(req.user.id);
    return { data: result, message: 'Account status retrieved' };
  }

  @RequireAccess({ permission: 'finance.view', scope: 'MARKET' })
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getDashboardLink(@Request() req): Promise<ConnectResponse> {
    const result = await this.connectService.getDashboardLink(req.user.id);
    return { data: result, message: 'Dashboard link generated' };
  }
}

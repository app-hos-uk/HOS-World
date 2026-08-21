import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Request,
  Req,
  Param,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { LoyaltyService } from './loyalty.service';
import { EnrollLoyaltyDto } from './dto/enroll.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { LoyaltyCheckInDto } from './dto/check-in.dto';
import { LoyaltyPreferencesDto } from './dto/loyalty-preferences.dto';
import { RedeemInStoreDto } from './dto/redeem-in-store.dto';
import { PosVoucherService } from './services/pos-voucher.service';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';

@ApiTags('loyalty')
@ApiBearerAuth('JWT-auth')
@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyController {
  constructor(
    private loyalty: LoyaltyService,
    private posVouchers: PosVoucherService,
  ) {}

  @Post('enroll')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Join The Enchanted Circle' })
  @SwaggerApiResponse({ status: 201, description: 'Enrolled' })
  async enroll(
    @Request() req: { user: { id: string } },
    @Body() dto: EnrollLoyaltyDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.enroll(req.user.id, dto);
    return { data, message: 'Welcome to The Enchanted Circle' };
  }

  @Get('membership')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Current membership' })
  async membership(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getMembership(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('preferences')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Marketing channel opt-ins' })
  async preferences(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getPreferences(req.user.id);
    return { data, message: 'OK' };
  }

  @Patch('preferences')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update marketing channel opt-ins' })
  async patchPreferences(
    @Req() req: ExpressRequest & { user: { id: string } },
    @Body() body: LoyaltyPreferencesDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.updatePreferences(req.user.id, body, {
      ipAddress: (req.ip || req.socket?.remoteAddress || undefined) as string | undefined,
      userAgent: (req.headers['user-agent'] as string | undefined) || undefined,
    });
    return { data, message: 'Updated' };
  }

  @Get('transactions')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Points history' })
  async transactions(
    @Request() req: { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getTransactions(req.user.id, { page, limit });
    return { data, message: 'OK' };
  }

  @Get('tier-progress')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Progress to next tier' })
  async tierProgress(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.tierProgress(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('redemption-options')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Reward catalogue' })
  async redemptionOptions(
    @Request() req: { user: { id: string } },
    @Query('region') region?: string,
  ): Promise<ApiResponse<unknown>> {
    const m = await this.loyalty.getMembership(req.user.id);
    const data = await this.loyalty.getRedemptionOptions(region || m?.regionCode || undefined);
    return { data, message: 'OK' };
  }

  @Post('redeem')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Redeem points for a reward',
    description:
      'Send an `idempotencyKey` to make retries safe — a repeat call with the same key returns the original redemption instead of burning the points again.',
  })
  async redeem(
    @Request() req: { user: { id: string } },
    @Body() body: RedeemPointsDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.redeem(req.user.id, body);
    return { data, message: 'Redeemed' };
  }

  @Get('referral')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Referral code and stats' })
  async referral(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.referralInfo(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('fandom-profile')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Fandom affinity scores' })
  async fandomProfile(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getFandomProfile(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('referral/generate')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Ensure referral code exists' })
  async referralGenerate(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.referralInfo(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('card')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Digital card / QR payload' })
  async card(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.cardPayload(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('check-in')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Store QR check-in' })
  async checkIn(
    @Request() req: { user: { id: string } },
    @Body() body: LoyaltyCheckInDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.checkIn(req.user.id, body.storeId);
    return { data, message: 'Checked in' };
  }

  @Post('redeem-in-store')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Burn points and issue an in-store gift card voucher (Flow A1)' })
  async redeemInStore(
    @Request() req: { user: { id: string } },
    @Body() body: RedeemInStoreDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.posVouchers.redeemInStoreForCustomer(req.user.id, body);
    return { data, message: 'Voucher issued' };
  }

  @Get('pos-vouchers/active')
  @RequireAccess({ permission: 'loyalty.view', scope: 'SELF' })
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Active in-store vouchers for the logged-in member' })
  async activeVouchers(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.posVouchers.listActiveVouchersForUser(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('pos-vouchers/:id/cancel')
  @RequireAccess({ permission: 'loyalty.manage', scope: 'SELF' })
  @Roles('CUSTOMER', 'ADMIN', 'STORE_STAFF')
  @ApiOperation({ summary: 'Cancel an unused ISSUED voucher and restore points (Flow A5)' })
  async cancelVoucher(
    @Request() req: { user: { id: string; role: string } },
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.posVouchers.cancelVoucher({
      voucherId: id,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      reason: body?.reason,
    });
    return { data, message: 'Voucher cancelled' };
  }
}

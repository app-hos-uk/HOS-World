import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Request,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
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

@ApiTags('loyalty')
@ApiBearerAuth('JWT-auth')
@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyController {
  constructor(private loyalty: LoyaltyService) {}

  @Post('enroll')
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
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Current membership' })
  async membership(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getMembership(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('preferences')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Marketing channel opt-ins' })
  async preferences(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getPreferences(req.user.id);
    return { data, message: 'OK' };
  }

  @Patch('preferences')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update marketing channel opt-ins' })
  async patchPreferences(
    @Request() req: { user: { id: string } },
    @Body() body: LoyaltyPreferencesDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.updatePreferences(req.user.id, body);
    return { data, message: 'Updated' };
  }

  @Get('transactions')
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
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Progress to next tier' })
  async tierProgress(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.tierProgress(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('redemption-options')
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
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Redeem points for a reward' })
  async redeem(
    @Request() req: { user: { id: string } },
    @Body() body: RedeemPointsDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.redeem(req.user.id, body);
    return { data, message: 'Redeemed' };
  }

  @Get('referral')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Referral code and stats' })
  async referral(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.referralInfo(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('fandom-profile')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Fandom affinity scores' })
  async fandomProfile(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.getFandomProfile(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('referral/generate')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Ensure referral code exists' })
  async referralGenerate(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.referralInfo(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('card')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Digital card / QR payload' })
  async card(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.cardPayload(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('check-in')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Store QR check-in' })
  async checkIn(
    @Request() req: { user: { id: string } },
    @Body() body: LoyaltyCheckInDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.checkIn(req.user.id, body.storeId);
    return { data, message: 'Checked in' };
  }
}

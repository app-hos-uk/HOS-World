import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Public()
  @Post('track')
  @ApiOperation({
    summary: 'Track referral click',
    description: 'Track a referral click/visit. Called when user visits with ?ref=CODE',
  })
  @SwaggerApiResponse({ status: 201, description: 'Referral tracked successfully' })
  async track(
    @Body() body: {
      referralCode: string;
      visitorId?: string;
      landingPage?: string;
      productId?: string;
      campaignId?: string;
      utmParams?: Record<string, string>;
    },
  ): Promise<ApiResponse<any>> {
    const result = await this.referralsService.track(body);
    return {
      data: result,
      message: result ? 'Referral tracked successfully' : 'Invalid referral code',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my referrals' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'converted', required: false, type: Boolean })
  @SwaggerApiResponse({ status: 200, description: 'Referrals retrieved successfully' })
  async getMyReferrals(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('converted') converted?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.referralsService.findByInfluencer(req.user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      converted: converted !== undefined ? converted === 'true' : undefined,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Referrals retrieved successfully',
    };
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOperation,
  ApiParam,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { Public } from '../common/decorators/public.decorator';
import { PartnerReferralsService } from './partner-referrals.service';

@ApiTags('partner-referrals')
@Controller('partner-referrals')
@Public()
export class PartnerReferralsController {
  constructor(private readonly partners: PartnerReferralsService) {}

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('resolve/:code')
  @ApiOperation({
    summary: 'Resolve a partner referral code',
    description:
      'Look up an active partner link by code, increment the click count, and return partner/offer details for the landing page.',
  })
  @ApiParam({ name: 'code', description: 'Partner referral code, e.g. PARTNER-HOTELS-NYC' })
  @SwaggerApiResponse({ status: 200, description: 'Partner link resolved' })
  @SwaggerApiResponse({ status: 404, description: 'Partner link not found' })
  async resolve(@Param('code') code: string): Promise<ApiResponse<unknown>> {
    const data = await this.partners.resolveLink(code);
    return { data, message: 'OK' };
  }
}

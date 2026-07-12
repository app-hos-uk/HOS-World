import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Public } from '../common/decorators/public.decorator';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

/**
 * Lightweight public controller that exposes the shopEnabled flag.
 * No authentication required — consumed by the Next.js middleware and
 * landing-page client components to decide whether to gate shop routes.
 */
@ApiTags('config')
@Controller('config')
@Public()
export class PublicConfigController {
  constructor(
    private readonly adminService: AdminService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Get('site')
  @ApiOperation({ summary: 'Public site branding and contact settings' })
  @Header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  async getSiteSettings() {
    const data = await this.adminService.getPublicSiteSettings();
    return { data, message: 'Site settings retrieved successfully' };
  }

  @Get('shop-enabled')
  @ApiOperation({ summary: 'Check if the online shop is enabled (public)' })
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
  async getShopEnabled(): Promise<{ enabled: boolean }> {
    const enabled = await this.adminService.isShopEnabled();
    return { enabled };
  }

  @Get('founding-members-enabled')
  @ApiOperation({ summary: 'Check if founding member registration is open (public)' })
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
  getFoundingMembersEnabled(): { enabled: boolean } {
    return { enabled: this.featureFlagsService.isEnabled(FeatureFlag.FOUNDING_MEMBERS) };
  }

  @Get('loyalty-enabled')
  @ApiOperation({ summary: 'Check if the loyalty programme is enabled (public)' })
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
  getLoyaltyEnabled(): { enabled: boolean } {
    return { enabled: this.loyaltyService.isEnabled() };
  }
}

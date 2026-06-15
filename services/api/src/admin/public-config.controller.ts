import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

/**
 * Lightweight public controller that exposes the shopEnabled flag.
 * No authentication required — consumed by the Next.js middleware and
 * landing-page client components to decide whether to gate shop routes.
 */
@ApiTags('config')
@Controller('config')
export class PublicConfigController {
  constructor(private readonly adminService: AdminService) {}

  @Get('shop-enabled')
  @ApiOperation({ summary: 'Check if the online shop is enabled (public)' })
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
  async getShopEnabled(): Promise<{ enabled: boolean }> {
    const enabled = await this.adminService.isShopEnabled();
    return { enabled };
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BrandPartnershipsService } from './brand-partnerships.service';
import { PrismaService } from '../database/prisma.service';

@ApiTags('loyalty-brand-campaigns')
@ApiBearerAuth('JWT-auth')
@Controller('loyalty/brand-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class BrandPartnershipsController {
  constructor(
    private brand: BrandPartnershipsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Active brand-funded campaigns for the current member' })
  async list(@Request() req: { user?: { id: string } }): Promise<ApiResponse<unknown>> {
    const userId = req.user?.id;
    if (!userId) return { data: [], message: 'OK' };
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    const tierLevel = m?.tier?.level ?? 0;
    const data = await this.brand.getActivePublicCampaigns(userId, tierLevel);
    return { data, message: 'OK' };
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Products qualifying for a brand campaign' })
  async products(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.brand.getCampaignProducts(
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data, message: 'OK' };
  }
}

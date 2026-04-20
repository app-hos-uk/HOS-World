import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { PrismaService } from '../database/prisma.service';
import { LoyaltyService } from './loyalty.service';
import { AdminLoyaltyAdjustDto } from './dto/admin-adjust.dto';
import { FandomProfileService } from './services/fandom-profile.service';

@ApiTags('admin-loyalty')
@ApiBearerAuth('JWT-auth')
@Controller('admin/loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LoyaltyAdminController {
  constructor(
    private loyalty: LoyaltyService,
    private prisma: PrismaService,
    private fandomProfiles: FandomProfileService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Loyalty programme KPIs' })
  async dashboard(): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.adminDashboard();
    return { data, message: 'OK' };
  }

  // ── Tiers ──────────────────────────────────────────────

  @Get('tiers')
  async tiers(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTier.findMany({ orderBy: { level: 'asc' } });
    return { data, message: 'OK' };
  }

  @Get('tiers/:id')
  async tier(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTier.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    return { data, message: 'OK' };
  }

  @Put('tiers/:id')
  async updateTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTier.update({
      where: { id },
      data: body as any,
    });
    return { data, message: 'Updated' };
  }

  // ── Earn Rules ─────────────────────────────────────────

  @Get('earn-rules')
  async earnRules(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyEarnRule.findMany({ orderBy: { action: 'asc' } });
    return { data, message: 'OK' };
  }

  @Post('earn-rules')
  async createEarnRule(@Body() body: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyEarnRule.create({ data: body as any });
    return { data, message: 'Created' };
  }

  @Put('earn-rules/:id')
  async updateEarnRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyEarnRule.update({ where: { id }, data: body as any });
    return { data, message: 'Updated' };
  }

  @Delete('earn-rules/:id')
  async deleteEarnRule(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.prisma.loyaltyEarnRule.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  // ── Redemption Options ─────────────────────────────────

  @Get('redemption-options')
  async redemptionOptions(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyRedemptionOption.findMany({ orderBy: { pointsCost: 'asc' } });
    return { data, message: 'OK' };
  }

  @Post('redemption-options')
  async createRedemptionOption(@Body() body: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyRedemptionOption.create({ data: body as any });
    return { data, message: 'Created' };
  }

  @Put('redemption-options/:id')
  async updateRedemptionOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyRedemptionOption.update({ where: { id }, data: body as any });
    return { data, message: 'Updated' };
  }

  @Delete('redemption-options/:id')
  async deleteRedemptionOption(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const redeemed = await this.prisma.loyaltyRedemption.count({ where: { optionId: id } });
    if (redeemed > 0) {
      await this.prisma.loyaltyRedemptionOption.update({
        where: { id },
        data: { isActive: false },
      });
      return { data: null, message: 'Deactivated (has redemption history)' };
    }
    await this.prisma.loyaltyRedemptionOption.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  // ── Campaigns ──────────────────────────────────────────

  @Get('campaigns')
  async campaigns(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyBonusCampaign.findMany({ orderBy: { startsAt: 'desc' } });
    return { data, message: 'OK' };
  }

  @Post('campaigns')
  async createCampaign(@Body() body: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyBonusCampaign.create({ data: body as any });
    return { data, message: 'Created' };
  }

  @Put('campaigns/:id')
  async updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyBonusCampaign.update({ where: { id }, data: body as any });
    return { data, message: 'Updated' };
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.prisma.loyaltyBonusCampaign.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  // ── Members ────────────────────────────────────────────

  @Get('members')
  async members(@Query('q') q?: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyMembership.findMany({
      where: q
        ? {
            OR: [
              { user: { email: { contains: q, mode: 'insensitive' } } },
              { cardNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: 50,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, tier: true },
      orderBy: { enrolledAt: 'desc' },
    });
    return { data, message: 'OK' };
  }

  @Get('members/:userId')
  async member(@Param('userId', ParseUUIDPipe) userId: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true, user: { select: { email: true, firstName: true, lastName: true } } },
    });
    return { data, message: 'OK' };
  }

  @Get('fandom-profile/:userId')
  @ApiOperation({ summary: 'Member fandom affinity profile (JSON)' })
  async fandomProfile(@Param('userId', ParseUUIDPipe) userId: string): Promise<ApiResponse<unknown>> {
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { fandomProfile: true, userId: true },
    });
    return { data: m?.fandomProfile ?? {}, message: 'OK' };
  }

  @Post('fandom-profiles/recompute')
  @ApiOperation({ summary: 'Recompute all member fandom profiles' })
  async recomputeFandom(): Promise<ApiResponse<unknown>> {
    const count = await this.fandomProfiles.batchUpdateProfiles();
    return { data: { count }, message: 'OK' };
  }

  @Post('adjust')
  async adjust(@Body() body: AdminLoyaltyAdjustDto): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.adminAdjustPoints(body.userId, body.pointsDelta, body.reason);
    return { data, message: 'Adjusted' };
  }

  @Get('transactions')
  async transactions(@Query('membershipId') membershipId?: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTransaction.findMany({
      where: membershipId ? { membershipId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { data, message: 'OK' };
  }
}

import { Controller, Get, Query, Request, UseGuards, Param } from '@nestjs/common';
import { VendorLedgerService } from './vendor-ledger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

type LedgerResponse = ApiResponse<any>;

@Controller('vendor-ledger')
export class VendorLedgerController {
  constructor(private readonly ledgerService: VendorLedgerService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getMyLedger(
    @Request() req,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<LedgerResponse> {
    const seller = await this.ledgerService['prisma'].seller.findUnique({
      where: { userId: req.user.id },
    });
    if (!seller) {
      return {
        data: { data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        message: 'No seller profile',
      };
    }

    const result = await this.ledgerService.getLedgerEntries(seller.id, {
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { data: result, message: 'Ledger entries retrieved' };
  }

  @Get('me/balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getMyBalance(@Request() req): Promise<LedgerResponse> {
    const seller = await this.ledgerService['prisma'].seller.findUnique({
      where: { userId: req.user.id },
    });
    if (!seller) {
      return { data: { balance: 0 }, message: 'No seller profile' };
    }

    const balance = await this.ledgerService.getBalance(seller.id);
    return { data: { balance }, message: 'Balance retrieved' };
  }

  @Get('me/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getMySummary(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<LedgerResponse> {
    const seller = await this.ledgerService['prisma'].seller.findUnique({
      where: { userId: req.user.id },
    });
    if (!seller) {
      return { data: { balance: 0, breakdown: {} }, message: 'No seller profile' };
    }

    const result = await this.ledgerService.getSummary(
      seller.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return { data: result, message: 'Ledger summary retrieved' };
  }

  // Admin: view any vendor's ledger
  @Get(':sellerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  async getVendorLedger(
    @Param('sellerId') sellerId: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<LedgerResponse> {
    const result = await this.ledgerService.getLedgerEntries(sellerId, {
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { data: result, message: 'Vendor ledger retrieved' };
  }

  @Get(':sellerId/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  async getVendorSummary(
    @Param('sellerId') sellerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<LedgerResponse> {
    const result = await this.ledgerService.getSummary(
      sellerId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return { data: result, message: 'Vendor summary retrieved' };
  }
}

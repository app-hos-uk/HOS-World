import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { LoyaltyStaffAuthGuard } from '../loyalty/guards/loyalty-staff-auth.guard';
import { StoreShipmentService } from './store-shipment.service';
import { SkuCustomsService } from './sku-customs.service';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('store-shipment')
@Controller('store-shipment')
export class StoreShipmentController {
  constructor(private shipments: StoreShipmentService) {}

  @Public()
  @Post('staff/create-claim')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Staff: capture shipping consent and issue claim link (B1)' })
  async createClaim(
    @Body()
    body: {
      storeId: string;
      invoiceNumber: string;
      email: string;
      shippingConsent: boolean;
    },
    @Req() req: { user?: { id?: string }; ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<ApiResponse<unknown>> {
    const ua = req.headers?.['user-agent'];
    const data = await this.shipments.createClaimFromTill({
      ...body,
      staffUserId: req.user?.id,
      ipAddress: req.ip,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    });
    return { data, message: 'Claim link created' };
  }

  @Public()
  @Get('claim/:token')
  @ApiOperation({ summary: 'Public claim page context' })
  async claimContext(@Param('token') token: string): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.getClaimContext(token);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'SELF' })
  @Post('claim/:token/attach')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Attach logged-in user to claim after email verification' })
  async attachClaim(
    @Param('token') token: string,
    @Req() req: { user: { id: string; email: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.attachUserToClaim(token, req.user.id, req.user.email);
    return { data, message: 'Claim attached' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'SELF' })
  @Post(':id/resolve-sale')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async resolveSale(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.resolveSaleForShipment(id, req.user.id);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipping.manage', scope: 'SELF' })
  @Post(':id/address')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async setAddress(
    @Param('id') id: string,
    @Body() body: { addressId: string },
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.setDestinationAddress(id, req.user.id, body.addressId);
    return { data, message: 'Address set' };
  }

  @RequireAccess({ permission: 'shipping.view', scope: 'SELF' })
  @Get(':id/rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async rates(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.getShippingRates(id, req.user.id);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipping.manage', scope: 'SELF' })
  @Post(':id/authorize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async authorize(
    @Param('id') id: string,
    @Body() body: { carrier: string; service: string; amount: number; currency?: string },
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.authorizeShipping(id, req.user.id, body);
    return { data, message: 'Payment authorized' };
  }

  @RequireAccess({ permission: 'shipping.manage', scope: 'SELF' })
  @Post(':id/purchase-label')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async purchaseLabel(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.purchaseLabel(id, req.user.id);
    return { data, message: 'Label purchased' };
  }
}

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/store-shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StoreShipmentAdminController {
  constructor(
    private shipments: StoreShipmentService,
    private skuCustoms: SkuCustomsService,
  ) {}

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get()
  @ApiOperation({ summary: 'List store shipment requests' })
  async list(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.listAdmin(status, page, limit);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get('sku-customs/pending')
  @ApiOperation({ summary: 'SKU customs enrichment queue' })
  async pendingSku(): Promise<ApiResponse<unknown>> {
    const data = await this.skuCustoms.listPending();
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Post('sku-customs/:id')
  @ApiOperation({ summary: 'Update SKU customs attributes' })
  async updateSku(
    @Param('id') id: string,
    @Body()
    body: {
      hsCode?: string;
      countryOfOrigin?: string;
      weightKg?: number;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
      status?: 'PENDING' | 'READY' | 'BLOCKED';
      restrictedCountries?: string[];
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.skuCustoms.update(id, body);
    return { data, message: 'Updated' };
  }
}

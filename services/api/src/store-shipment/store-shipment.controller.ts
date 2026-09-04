import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { LoyaltyStaffAuthGuard } from '../loyalty/guards/loyalty-staff-auth.guard';
import { StoreShipmentService } from './store-shipment.service';
import { SkuCustomsService } from './sku-customs.service';
import { BoxSizeService } from './box-size.service';
import { ShippingWorkflowService } from './shipping-workflow.service';
import type { ApiResponse } from '@hos-marketplace/shared-types';

type StaffReq = {
  user?: { id?: string; role?: string; storeId?: string };
  storeId?: string;
};

@ApiTags('store-shipment')
@Controller('store-shipment')
export class StoreShipmentController {
  constructor(
    private shipments: StoreShipmentService,
    private workflow: ShippingWorkflowService,
  ) {}

  @Public()
  @Post('staff/create-claim')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Staff: scan invoice, create HOS shipping order, send magic link' })
  async createClaim(
    @Body()
    body: {
      storeId?: string;
      invoiceNumber: string;
      email?: string;
      shippingConsent: boolean;
    },
    @Req() req: StaffReq & { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<ApiResponse<unknown>> {
    const ua = req.headers?.['user-agent'];
    const staffStoreId =
      req.storeId ||
      (req.user && 'storeId' in req.user ? req.user.storeId : undefined);
    const data = await this.shipments.createClaimFromTill({
      storeId: body.storeId,
      assignedStoreId: staffStoreId,
      invoiceNumber: body.invoiceNumber,
      email: body.email,
      shippingConsent: body.shippingConsent,
      staffUserId: req.user?.id,
      ipAddress: req.ip,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    });
    return { data, message: data.resent ? 'Claim link resent' : 'Shipping order created' };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Get('lookup')
  @ApiOperation({ summary: 'Customer: find a shipping order by HOS number, invoice, or email' })
  async lookup(
    @Query('q') q: string,
    @Query('storeId') storeId?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.lookupPublic(q, storeId);
    return { data, message: 'OK' };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('claim/:token')
  @ApiOperation({ summary: 'Public claim page context' })
  async claimContext(
    @Param('token') token: string,
    @Req() req: { user?: { email?: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.getClaimContext(token, req.user?.email);
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

  @Public()
  @Get('staff/orders')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async staffList(
    @Req() req: StaffReq,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.listStaffOrders(
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      { status, page, limit },
    );
    return { data, message: 'OK' };
  }

  @Public()
  @Get('staff/backoffice')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async backoffice(
    @Req() req: StaffReq,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.listBackoffice(
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      status,
      { page, limit },
    );
    return { data, message: 'OK' };
  }

  @Public()
  @Get('staff/orders/:id')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async staffOrder(@Param('id') id: string, @Req() req: StaffReq): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.getProgress(id, {
      userId: req.user?.id,
      role: 'STAFF',
    });
    if (req.user?.role !== 'ADMIN' && (req.storeId || req.user?.storeId) && data.store.id !== (req.storeId || req.user?.storeId)) {
      throw new ForbiddenException('This order belongs to another store');
    }
    return { data, message: 'OK' };
  }

  @Public()
  @Post('staff/orders/:id/box-sizes')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async setBoxes(
    @Param('id') id: string,
    @Body() body: { groups: Array<{ groupId: string; boxSizeId: string; customPrice?: number }> },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.setBoxSizes(
      id,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Quote ready' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('staff/orders/:id/confirm-payment')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Staff: confirm cash or standalone card-machine payment at the counter' })
  async staffConfirmPayment(
    @Param('id') id: string,
    @Body() body: { method?: string },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.staffConfirmPayment(
      id,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Payment confirmed' };
  }

  @Public()
  @Post('staff/orders/:id/receive')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async receive(
    @Param('id') id: string,
    @Body() body: { employeeName: string },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.receiveByLogistics(
      id,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Received by logistics' };
  }

  @Public()
  @Post('staff/orders/:id/carrier-pickup')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async pickup(@Param('id') id: string, @Req() req: StaffReq): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.carrierPickup(id, {
      id: req.user?.id,
      storeId: req.storeId || req.user?.storeId,
      role: req.user?.role,
    });
    return { data, message: 'Handed to carrier' };
  }

  @Public()
  @Post('staff/groups/:groupId/verify-items')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async verifyItems(
    @Param('groupId') groupId: string,
    @Body() body: { verifiedItemIds: string[]; packedBy?: string },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.verifyItems(
      groupId,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Items verified' };
  }

  @Public()
  @Post('staff/groups/:groupId/set-weight')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async setWeight(
    @Param('groupId') groupId: string,
    @Body() body: { weightKg: number; lengthCm?: number; widthCm?: number; heightCm?: number },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.setWeight(
      groupId,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Weight saved' };
  }

  @Public()
  @Post('staff/groups/:groupId/generate-label')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async generateLabel(
    @Param('groupId') groupId: string,
    @Body() body: { serviceCode?: string },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.generateLabel(
      groupId,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Label created' };
  }

  @Public()
  @Post('staff/groups/:groupId/verify-label')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async verifyLabel(
    @Param('groupId') groupId: string,
    @Body() body: { hosOrderNumber: string; carrierTrackingNumber: string },
    @Req() req: StaffReq,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.verifyLabel(
      groupId,
      { id: req.user?.id, storeId: req.storeId || req.user?.storeId, role: req.user?.role },
      body,
    );
    return { data, message: 'Label verified' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'SELF' })
  @Post(':id/attach-login')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async attachLogin(
    @Param('id') id: string,
    @Req() req: { user: { id: string; email: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.attachByLogin(id, req.user.id, req.user.email);
    return { data, message: 'Attached' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'SELF' })
  @Get(':id/progress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async progress(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.getProgress(id, { userId: req.user.id, role: 'CUSTOMER' });
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipping.manage', scope: 'SELF' })
  @Post(':id/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async profile(
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; phone?: string },
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.updateCustomerProfile(id, req.user.id, body);
    return { data, message: 'Profile saved' };
  }

  @RequireAccess({ permission: 'shipping.manage', scope: 'SELF' })
  @Post(':id/assign-items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async assignItems(
    @Param('id') id: string,
    @Body()
    body: {
      assignments: Array<{
        addressId: string;
        recipientName?: string;
        recipientEmail?: string;
        recipientPhone?: string;
        items: Array<{ posSaleItemId: string; quantity: number }>;
      }>;
      carryInHand?: Array<{ posSaleItemId: string; quantity: number }>;
    },
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.assignItems(id, req.user.id, body);
    return { data, message: 'Items assigned' };
  }

  @RequireAccess({ permission: 'shipping.manage', scope: 'SELF' })
  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('JWT-auth')
  async confirmPayment(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.confirmPayment(id, req.user.id);
    return { data, message: 'Payment recorded' };
  }

  @Public()
  @Get(':id/slip')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Content-Type', 'application/pdf')
  async slip(@Param('id') id: string, @Req() req: StaffReq, @Res() res: Response) {
    const buf = await this.workflow.slipPdf(id, {
      storeId: req.storeId || req.user?.storeId,
      role: req.user?.role,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="shipping-slip-${id}.pdf"`);
    res.send(buf);
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
    @Body() body: { carrier?: string; service?: string; amount?: number; currency?: string },
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
    private workflow: ShippingWorkflowService,
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
  @Get('pending-customer-queue')
  @ApiOperation({ summary: 'Shipments awaiting customer registration or data completion' })
  async pendingCustomerQueue(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.shipments.listPendingCustomerQueue(page, limit);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get('dashboard/summary')
  async summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.dashboardSummary(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get('dashboard/financials')
  async financials(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.dashboardFinancials(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get('dashboard/operations')
  async operations(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflow.dashboardOperations(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
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

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/box-sizes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BoxSizeAdminController {
  constructor(private boxes: BoxSizeService) {}

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get()
  async list(
    @Query('storeId') storeId?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.list(storeId, includeInactive === 'true');
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Post()
  async create(
    @Body()
    body: {
      storeId?: string;
      name: string;
      label: string;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
      customerPrice: number;
      packagingCost?: number;
      currency?: string;
      sortOrder?: number;
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.create(body);
    return { data, message: 'Created' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      label?: string;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
      customerPrice?: number;
      packagingCost?: number;
      currency?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.update(id, body);
    return { data, message: 'Updated' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.deactivate(id);
    return { data, message: 'Deactivated' };
  }
}

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/shipping-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ShippingRatesAdminController {
  constructor(private boxes: BoxSizeService) {}

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Get()
  @ApiOperation({ summary: 'Box size × destination tier rate matrix' })
  async matrix(): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.rateMatrix();
    return { data, message: 'OK' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Put('tiers/:id')
  async updateTier(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      countryCodes?: string[];
      isActive?: boolean;
      currency?: string;
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.updateTier(id, body);
    return { data, message: 'Tier updated' };
  }

  @RequireAccess({ permission: 'shipments.verify', scope: 'GLOBAL' })
  @Put('matrix')
  async saveMatrix(
    @Body() body: { rates: Array<{ boxSizeId: string; tierId: string; customerPrice: number }> },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.boxes.saveRates(body.rates || []);
    return { data, message: 'Rates saved' };
  }
}

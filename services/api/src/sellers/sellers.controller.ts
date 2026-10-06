import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { SellerMarketService } from './seller-market.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SELLER_ROLES } from '../common/roles';
import { Public } from '../common/decorators/public.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { VendorApplicationDto } from './dto/vendor-application.dto';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly sellersService: SellersService,
    private readonly sellerMarketService: SellerMarketService,
  ) {}

  @Public()
  @Get('directory')
  @ApiOperation({
    summary: 'List all sellers (public)',
    description: 'Returns a public listing of all active sellers. No authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Sellers listed successfully' })
  async listPublicSellers(): Promise<ApiResponse<any[]>> {
    const sellers = await this.sellersService.findAllPublic();
    return {
      data: sellers,
      message: 'Sellers listed successfully',
    };
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get seller by slug',
    description: 'Retrieves a seller profile by slug. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Seller slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async findBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.findBySlug(slug);
    return {
      data: seller,
      message: 'Seller retrieved successfully',
    };
  }

  @Public()
  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Apply as a vendor',
    description:
      'Public endpoint for vendor applications. Creates a user account + seller profile with PENDING status for Marketing/Admin review.',
  })
  @ApiBody({ type: VendorApplicationDto })
  @SwaggerApiResponse({ status: 201, description: 'Vendor application submitted' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid data or email already exists' })
  async applyAsVendor(@Body() body: VendorApplicationDto): Promise<ApiResponse<any>> {
    const result = await this.sellersService.applyAsVendor(body);
    return { data: result, message: 'Vendor application submitted successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', ...SELLER_ROLES)
  @RequireAccess({ permission: 'sellers.view', scope: 'SELF' })
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my seller profile',
    description: "Retrieves the authenticated seller's profile. Requires seller role.",
  })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async getMyProfile(@Request() req: any): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.findOne(req.user.id);
    return {
      data: seller,
      message: 'Seller profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', ...SELLER_ROLES)
  @RequireAccess({ permission: 'products.view', scope: 'SELF' })
  @Get('me/products')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my products (all statuses)',
    description:
      'Returns all products for the authenticated seller (DRAFT, ACTIVE, INACTIVE, etc.). Use this for seller dashboard "My Products" list.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async getMyProducts(@Request() req: any): Promise<ApiResponse<any[]>> {
    const products = await this.sellersService.findMyProducts(req.user.id);
    return {
      data: products,
      message: 'Products retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', ...SELLER_ROLES)
  @RequireAccess({ permission: 'sellers.operate', scope: 'SELF' })
  @Put('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update my seller profile',
    description: "Updates the authenticated seller's profile. Requires seller role.",
  })
  @ApiBody({ type: UpdateSellerDto })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async updateMyProfile(
    @Request() req: any,
    @Body() updateSellerDto: UpdateSellerDto,
  ): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.update(req.user.id, updateSellerDto);
    return {
      data: seller,
      message: 'Seller profile updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.view', scope: 'GLOBAL' })
  @Get(':userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get seller profile by user ID (Admin only)',
    description: 'Retrieves a seller profile by user ID. Admin access required.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.findOne(userId);
    return {
      data: seller,
      message: 'Seller profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Put(':userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update seller profile by user ID (Admin only)',
    description: 'Updates a seller profile by user ID. Admin access required.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', type: String })
  @ApiBody({ type: UpdateSellerDto })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async updateSellerProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateSellerDto: UpdateSellerDto,
  ): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.update(userId, updateSellerDto);
    return {
      data: seller,
      message: 'Seller profile updated successfully',
    };
  }

  // === Seller market assignments (Admin) ===

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Post('bulk-assign-market')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Bulk assign sellers to a market',
    description: 'Assigns many sellers to one market with ACTIVE status. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sellerIds', 'marketId'],
      properties: {
        sellerIds: { type: 'array', items: { type: 'string' } },
        marketId: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Sellers assigned to market' })
  @SwaggerApiResponse({ status: 404, description: 'Market not found' })
  async bulkAssignMarket(
    @Body() body: { sellerIds: string[]; marketId: string },
  ): Promise<ApiResponse<any[]>> {
    const results = await this.sellerMarketService.bulkAssign(body.sellerIds ?? [], body.marketId);
    return { data: results, message: 'Sellers assigned to market' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.view', scope: 'GLOBAL' })
  @Get(':id/markets')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get a seller's market assignments",
    description: 'Returns market assignments for a seller. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Seller UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller markets retrieved' })
  async getSellerMarkets(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any[]>> {
    const markets = await this.sellerMarketService.findBySeller(id);
    return { data: markets, message: 'Seller markets retrieved' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Post(':id/markets')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Assign seller to a market',
    description: 'Creates or reactivates a seller market assignment. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Seller UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['marketId'],
      properties: { marketId: { type: 'string' } },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Seller assigned to market' })
  @SwaggerApiResponse({ status: 404, description: 'Seller or market not found' })
  async assignSellerMarket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { marketId: string },
  ): Promise<ApiResponse<any>> {
    const assignment = await this.sellerMarketService.assign(id, body.marketId);
    return { data: assignment, message: 'Seller assigned to market' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Delete(':id/markets/:marketId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Remove seller from a market',
    description: 'Deletes a seller market assignment. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Seller UUID', type: String })
  @ApiParam({ name: 'marketId', description: 'Market UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller removed from market' })
  @SwaggerApiResponse({ status: 404, description: 'Seller market assignment not found' })
  async removeSellerMarket(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('marketId', ParseUUIDPipe) marketId: string,
  ): Promise<ApiResponse<any>> {
    const removed = await this.sellerMarketService.remove(id, marketId);
    return { data: removed, message: 'Seller removed from market' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Put(':id/markets/:marketId/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update seller market status',
    description: 'Sets a seller market assignment to ACTIVE, PENDING, or SUSPENDED.',
  })
  @ApiParam({ name: 'id', description: 'Seller UUID', type: String })
  @ApiParam({ name: 'marketId', description: 'Market UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'SUSPENDED'] } },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Seller market status updated' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid status' })
  @SwaggerApiResponse({ status: 404, description: 'Seller market assignment not found' })
  async updateSellerMarketStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Body() body: { status: string },
  ): Promise<ApiResponse<any>> {
    const updated = await this.sellerMarketService.updateStatus(id, marketId, body.status);
    return { data: updated, message: 'Seller market status updated' };
  }

  // === Vendor Management Endpoints (Admin) ===

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PROCUREMENT', 'MARKETING', 'SALES')
  @RequireAccess({ permission: 'sellers.view', scope: 'GLOBAL' })
  @Get('admin/vendors')
  async listVendors(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.sellersService.findAllVendors({
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { data: result, message: 'Vendors retrieved' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING', 'SALES')
  @RequireAccess({ permission: 'sellers.approve', scope: 'GLOBAL' })
  @Post('admin/vendors/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveVendor(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { notes?: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.sellersService.approveVendor(id, req.user.id, body.notes);
    return { data: result, message: 'Vendor approved' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING', 'SALES')
  @RequireAccess({ permission: 'sellers.approve', scope: 'GLOBAL' })
  @Post('admin/vendors/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectVendor(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.sellersService.rejectVendor(id, body.reason);
    return { data: result, message: 'Vendor rejected' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.suspend', scope: 'GLOBAL' })
  @Post('admin/vendors/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendVendor(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.sellersService.suspendVendor(id, body.reason);
    return { data: result, message: 'Vendor suspended' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'sellers.approve', scope: 'GLOBAL' })
  @Post('admin/vendors/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateVendor(@Param('id') id: string): Promise<ApiResponse<any>> {
    const result = await this.sellersService.activateVendor(id);
    return { data: result, message: 'Vendor activated' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Put('admin/vendors/:id/commission')
  async updateCommission(
    @Param('id') id: string,
    @Body() body: { rate: number },
  ): Promise<ApiResponse<any>> {
    const result = await this.sellersService.updateCommissionRate(id, body.rate);
    return { data: result, message: 'Commission rate updated' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @RequireAccess({ permission: 'sellers.operate', scope: 'GLOBAL' })
  @Put('admin/vendors/:id/subscription')
  async updateSubscription(
    @Param('id') id: string,
    @Body() body: { plan: string; fee: number; expiresAt?: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.sellersService.updateSubscription(
      id,
      body.plan,
      body.fee,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
    return { data: result, message: 'Subscription updated' };
  }

  // === Vendor Dashboard Endpoint ===

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SELLER_ROLES)
  @RequireAccess({ permission: 'sellers.view', scope: 'SELF' })
  @Get('me/dashboard')
  async getMyDashboard(@Request() req): Promise<ApiResponse<any>> {
    const result = await this.sellersService.getVendorDashboardStats(req.user.id);
    return { data: result, message: 'Dashboard stats retrieved' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', ...SELLER_ROLES)
  @RequireAccess({ permission: 'sellers.operate', scope: 'SELF' })
  @Post('verification/documents')
  async submitVerificationDocument(
    @Request() req: any,
    @Body() body: { documentType: string; fileUrl: string; fileName?: string },
  ): Promise<ApiResponse<any>> {
    const doc = await this.sellersService.submitVerificationDocument(req.user.id, body);
    return { data: doc, message: 'Verification document submitted' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', ...SELLER_ROLES, 'FINANCE')
  @RequireAccess({ permission: 'sellers.view', scope: 'SELF' })
  @Get('verification/documents')
  async listVerificationDocuments(@Request() req: any): Promise<ApiResponse<any[]>> {
    const docs = await this.sellersService.listVerificationDocuments(req.user.id, req.user.role);
    return { data: docs, message: 'Verification documents retrieved' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
  @RequireAccess({ permission: 'sellers.approve', scope: 'GLOBAL' })
  @Put('verification/documents/:id/review')
  async reviewVerificationDocument(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string },
  ): Promise<ApiResponse<any>> {
    const doc = await this.sellersService.reviewVerificationDocument(id, req.user.id, body);
    return { data: doc, message: 'Document reviewed' };
  }
}

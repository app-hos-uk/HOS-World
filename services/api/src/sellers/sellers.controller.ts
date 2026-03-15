import {
  Controller,
  Get,
  Post,
  Put,
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
import { UpdateSellerDto } from './dto/update-seller.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { VendorApplicationDto } from './dto/vendor-application.dto';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

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
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
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
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
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
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
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

  // === Vendor Management Endpoints (Admin) ===

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PROCUREMENT', 'MARKETING', 'SALES')
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
  @Post('admin/vendors/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateVendor(@Param('id') id: string): Promise<ApiResponse<any>> {
    const result = await this.sellersService.activateVendor(id);
    return { data: result, message: 'Vendor activated' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FINANCE')
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
  @Roles('SELLER', 'B2C_SELLER')
  @Get('me/dashboard')
  async getMyDashboard(@Request() req): Promise<ApiResponse<any>> {
    const result = await this.sellersService.getVendorDashboardStats(req.user.id);
    return { data: result, message: 'Dashboard stats retrieved' };
  }
}

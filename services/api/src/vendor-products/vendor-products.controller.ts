import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VendorProductsService } from './vendor-products.service';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';
import { UpdateVendorProductDto } from './dto/update-vendor-product.dto';
import { ApproveVendorProductDto, RejectVendorProductDto } from './dto/approve-vendor-product.dto';
import { QueryVendorProductsDto } from './dto/query-vendor-products.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

type VendorProductResponse = ApiResponse<any>;

@Controller('vendor-products')
export class VendorProductsController {
  constructor(private readonly vendorProductsService: VendorProductsService) {}

  // === VENDOR ENDPOINTS ===

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async create(
    @Request() req,
    @Body() dto: CreateVendorProductDto,
  ): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.create(req.user.id, dto);
    return { data: result, message: 'Vendor product listing created' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async findMyListings(
    @Request() req,
    @Query() query: QueryVendorProductsDto,
  ): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.findBySeller(req.user.id, query);
    return { data: result, message: 'Vendor product listings retrieved' };
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async getMyStats(@Request() req): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.getVendorStats(req.user.id);
    return { data: result, message: 'Vendor stats retrieved' };
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  @HttpCode(HttpStatus.OK)
  async submitForApproval(@Param('id') id: string, @Request() req): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.submitForApproval(id, req.user.id);
    return { data: result, message: 'Listing submitted for approval' };
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string, @Request() req): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.deactivate(id, req.user.id);
    return { data: result, message: 'Listing deactivated' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateVendorProductDto,
  ): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.update(id, req.user.id, dto);
    return { data: result, message: 'Vendor product listing updated' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER')
  async delete(@Param('id') id: string, @Request() req): Promise<VendorProductResponse> {
    await this.vendorProductsService.delete(id, req.user.id);
    return { data: null, message: 'Vendor product listing deleted' };
  }

  // === ADMIN ENDPOINTS ===

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG', 'PROCUREMENT')
  async findAll(@Query() query: QueryVendorProductsDto): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.findAll(query);
    return { data: result, message: 'Vendor products retrieved' };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG', 'PROCUREMENT', 'SELLER', 'B2C_SELLER')
  async findOne(@Param('id') id: string): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.findOne(id);
    return { data: result, message: 'Vendor product retrieved' };
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ApproveVendorProductDto,
  ): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.approve(id, req.user.id, dto);
    return { data: result, message: 'Vendor product approved' };
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectVendorProductDto,
  ): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.reject(id, dto);
    return { data: result, message: 'Vendor product rejected' };
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string): Promise<VendorProductResponse> {
    const result = await this.vendorProductsService.activate(id);
    return { data: result, message: 'Vendor product activated' };
  }
}

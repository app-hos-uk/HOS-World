import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Post()
  async createProduct(
    @Body()
    body: {
      name: string;
      description: string;
      price: number;
      currency?: string;
      stock?: number;
      category?: string;
      tags?: string[];
      sellerId?: string | null;
      isPlatformOwned?: boolean;
      status?: 'DRAFT' | 'PUBLISHED';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      fandom?: string;
    },
  ): Promise<ApiResponse<any>> {
    const product = await this.productsService.createProduct(body);
    return {
      data: product,
      message: 'Product created successfully',
    };
  }

  @Put(':id')
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      category?: string;
      tags?: string[];
      sellerId?: string | null;
      status?: 'DRAFT' | 'PUBLISHED';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      fandom?: string;
    },
  ): Promise<ApiResponse<any>> {
    const product = await this.productsService.updateProduct(id, body);
    return {
      data: product,
      message: 'Product updated successfully',
    };
  }

  @Get()
  async getAllProducts(
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.productsService.getAllProducts({
      sellerId: sellerId === 'null' ? null : sellerId,
      status,
      category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Products retrieved successfully',
    };
  }
}


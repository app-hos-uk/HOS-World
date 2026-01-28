import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create product (Admin only)',
    description: 'Creates a new product. Admin can create platform-owned products or assign to sellers.',
  })
  @ApiBody({
    description: 'Product creation data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        currency: { type: 'string' },
        stock: { type: 'number' },
        categoryId: { type: 'string', format: 'uuid' },
        tagIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        sellerId: { type: 'string', format: 'uuid', nullable: true },
        isPlatformOwned: { type: 'boolean' },
        status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'] },
        sku: { type: 'string' },
        fandom: { type: 'string' },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              alt: { type: 'string' },
              order: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Product created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async createProduct(
    @Body()
    body: {
      name: string;
      description: string;
      price: number;
      currency?: string;
      stock?: number;
      category?: string; // Keep for backward compatibility
      tags?: string[]; // Keep for backward compatibility
      categoryId?: string; // New: taxonomy category ID
      tagIds?: string[]; // New: taxonomy tag IDs
      attributes?: Array<{
        attributeId: string;
        attributeValueId?: string;
        textValue?: string;
        numberValue?: number;
        booleanValue?: boolean;
        dateValue?: string;
      }>; // New: product attributes
      sellerId?: string | null;
      isPlatformOwned?: boolean;
      status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      taxClassId?: string;
      fandom?: string;
      images?: Array<{ url: string; alt?: string; order?: number }>;
    },
  ): Promise<ApiResponse<any>> {
    const product = await this.productsService.createProduct(body);
    return {
      data: product,
      message: 'Product created successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update product (Admin only)',
    description: 'Updates an existing product. Admin can update any product regardless of seller.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID', type: String })
  @ApiBody({
    description: 'Product update data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        stock: { type: 'number' },
        categoryId: { type: 'string', format: 'uuid' },
        tagIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        sellerId: { type: 'string', format: 'uuid', nullable: true },
        status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'] },
        sku: { type: 'string' },
        fandom: { type: 'string' },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              alt: { type: 'string' },
              order: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Product updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      category?: string; // Keep for backward compatibility
      tags?: string[]; // Keep for backward compatibility
      categoryId?: string; // New: taxonomy category ID
      tagIds?: string[]; // New: taxonomy tag IDs
      attributes?: Array<{
        attributeId: string;
        attributeValueId?: string;
        textValue?: string;
        numberValue?: number;
        booleanValue?: boolean;
        dateValue?: string;
      }>; // New: product attributes
      sellerId?: string | null;
      status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      taxClassId?: string;
      fandom?: string;
      images?: Array<{ url: string; alt?: string; order?: number }>;
    },
  ): Promise<ApiResponse<any>> {
    const product = await this.productsService.updateProduct(id, body);
    return {
      data: product,
      message: 'Product updated successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all products (Admin only)',
    description: 'Retrieves a paginated list of all products with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID (use "null" for platform-owned)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by product status' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by product name or description' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @SwaggerApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllProducts(
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<ApiResponse<any>> {
    const result = await this.productsService.getAllProducts({
      sellerId: sellerId === 'null' ? null : sellerId,
      status,
      category,
      search,
      page,
      limit: Math.min(limit, 100), // Max 100 per page
    });
    return {
      data: result,
      message: 'Products retrieved successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete product (Admin only)',
    description: 'Deletes a product. Admin can delete any product regardless of seller. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ message: string }>> {
    const result = await this.productsService.deleteProduct(id);
    return {
      data: result,
      message: 'Product deleted successfully',
    };
  }
}


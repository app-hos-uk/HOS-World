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
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { verify } from 'jsonwebtoken';
import { isUuid } from '../common/utils/uuid';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductsBulkService } from './products-bulk.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AUTH_COOKIE_NAME } from '../auth/cookie.utils';
import type { ApiResponse, PaginatedResponse, Product } from '@hos-marketplace/shared-types';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsBulkService: ProductsBulkService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description: 'Retrieve a paginated list of products with optional filters',
  })
  @SwaggerApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async findAll(
    @Query() searchDto: SearchProductsDto,
  ): Promise<ApiResponse<PaginatedResponse<Product>>> {
    const result = await this.productsService.findAll(searchDto);
    return {
      data: result,
      message: 'Products retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID or slug',
    description: 'Retrieve a single product by UUID or slug',
  })
  @ApiParam({ name: 'id', description: 'Product UUID or slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<Product>> {
    const product = isUuid(id)
      ? await this.productsService.findOne(id)
      : await this.productsService.findBySlugOnly(id);
    return {
      data: product,
      message: 'Product retrieved successfully',
    };
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get product by slug',
    description: 'Retrieve a single product by its slug',
  })
  @ApiParam({ name: 'slug', description: 'Product slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async findBySlug(@Param('slug') slug: string): Promise<ApiResponse<Product>> {
    const product = await this.productsService.findBySlugOnly(slug);
    return {
      data: product,
      message: 'Product retrieved successfully',
    };
  }

  @Post(':id/view')
  @Public()
  @ApiOperation({
    summary: 'Track product view',
    description: 'Record a product view event for analytics',
  })
  @ApiParam({ name: 'id', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 201, description: 'View tracked successfully' })
  async trackView(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    // Best-effort extraction of userId from JWT on this @Public() endpoint
    let userId: string | undefined;
    try {
      const token = req.cookies?.[AUTH_COOKIE_NAME]
        || req.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        const secret = this.configService.get<string>('JWT_SECRET');
        const payload = verify(token, secret!) as any;
        userId = payload?.sub;
      }
    } catch {
      // Token missing or invalid — anonymous view
    }

    await this.productsService.trackProductView(id, {
      userId,
      sessionId: req.headers['x-session-id'],
      ipHash: req.ip ? createHash('sha256').update(req.ip).digest('hex').substring(0, 16) : undefined,
      userAgent: req.headers['user-agent']?.substring(0, 200),
      referrer: req.headers['referer']?.substring(0, 500),
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG')
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new product in the centralized catalog',
    description:
      'Creates a product in the centralized catalog. Admin/Catalog only. Vendors must submit products through the vendor-products endpoint.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Product created successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Catalog role required. Vendors must use POST /vendor-products.',
  })
  async create(
    @Request() req: any,
    @Body() createProductDto: CreateProductDto,
  ): Promise<ApiResponse<Product>> {
    const product = await this.productsService.create(req.user.id, createProductDto);
    return {
      data: product,
      message: 'Product created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CATALOG', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update product in centralized catalog',
    description:
      'Update an existing product (Admin/Catalog only). Vendors update through vendor-products.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID', type: String })
  @ApiBody({ type: UpdateProductDto })
  @SwaggerApiResponse({ status: 200, description: 'Product updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ApiResponse<Product>> {
    const product = await this.productsService.update(req.user.id, id, updateProductDto);
    return {
      data: product,
      message: 'Product updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete product', description: 'Delete a product (Seller only)' })
  @ApiParam({ name: 'id', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Product deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async delete(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.productsService.delete(req.user.id, id);
    return {
      data: { message: 'Product deleted successfully' },
      message: 'Product deleted successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Post('bulk-update')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Bulk update seller products',
    description: 'Update status, stock, or apply price adjustment to multiple products (Seller only)',
  })
  async bulkUpdate(
    @Request() req: any,
    @Body() dto: BulkUpdateProductsDto,
  ): Promise<ApiResponse<{ updated: number; failed: number; errors: string[] }>> {
    const result = await this.productsService.bulkUpdate(req.user.id, dto.productIds, {
      status: dto.status,
      stock: dto.stock,
      priceAdjustmentPercent: dto.priceAdjustmentPercent,
    });
    return {
      data: result,
      message: `Bulk update completed: ${result.updated} updated, ${result.failed} failed`,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Post('import/validate')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Validate product import (dry-run)',
    description: 'Preview import validation without creating products (Seller only)',
  })
  async validateImport(
    @Request() req: any,
    @Body() body: { products: any[] },
  ): Promise<ApiResponse<any>> {
    const result = await this.productsBulkService.validateImport(req.user.id, body.products);
    return {
      data: result,
      message: `Validation complete: ${result.valid} valid, ${result.invalid} invalid`,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Get('export/csv')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Export products to CSV',
    description: 'Export all seller products to CSV format (Seller only)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Products exported successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async exportProducts(@Request() req: any): Promise<ApiResponse<any[]>> {
    const products = await this.productsBulkService.exportProducts(req.user.id);
    return {
      data: products,
      message: 'Products exported successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Post('import')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Import products',
    description: 'Import products from JSON array (Seller only)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['products'],
      properties: {
        products: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of product objects to import',
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Products imported successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid input data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async importProducts(
    @Request() req: any,
    @Body() body: { products: any[] },
  ): Promise<ApiResponse<any>> {
    const products = body.products;

    if (products.length > 10) {
      const jobId = await this.productsBulkService.queueBulkImport(req.user.id, products);
      return {
        data: { jobId, status: 'queued', totalItems: products.length },
        message: `Bulk import of ${products.length} products has been queued for background processing`,
      };
    }

    const result = await this.productsBulkService.importProducts(req.user.id, products);
    return {
      data: result,
      message: `Import completed: ${result.success} succeeded, ${result.failed} failed`,
    };
  }
}

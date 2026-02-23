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
} from '@nestjs/common';
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
import { SearchProductsDto } from './dto/search-products.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse, PaginatedResponse, Product } from '@hos-marketplace/shared-types';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsBulkService: ProductsBulkService,
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Create a new product (Seller only)',
  })
  @SwaggerApiResponse({ status: 201, description: 'Product created successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
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
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update product',
    description: 'Update an existing product (Seller only)',
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

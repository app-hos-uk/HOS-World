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

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsBulkService: ProductsBulkService,
  ) {}

  @Public()
  @Get()
  async findAll(@Query() searchDto: SearchProductsDto): Promise<ApiResponse<PaginatedResponse<Product>>> {
    const result = await this.productsService.findAll(searchDto);
    return {
      data: result,
      message: 'Products retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Product>> {
    const product = await this.productsService.findOne(id);
    return {
      data: product,
      message: 'Product retrieved successfully',
    };
  }

  @Public()
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<ApiResponse<Product>> {
    const product = await this.productsService.findBySlugOnly(slug);
    return {
      data: product,
      message: 'Product retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Post()
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
  @Roles('SELLER')
  @Put(':id')
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
  @Roles('SELLER')
  @Delete(':id')
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
  @Roles('SELLER')
  @Get('export/csv')
  async exportProducts(@Request() req: any): Promise<ApiResponse<any[]>> {
    const products = await this.productsBulkService.exportProducts(req.user.id);
    return {
      data: products,
      message: 'Products exported successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Post('import')
  async importProducts(
    @Request() req: any,
    @Body() body: { products: any[] },
  ): Promise<ApiResponse<any>> {
    const result = await this.productsBulkService.importProducts(req.user.id, body.products);
    return {
      data: result,
      message: `Import completed: ${result.success} succeeded, ${result.failed} failed`,
    };
  }
}

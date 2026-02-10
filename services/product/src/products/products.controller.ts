import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { Public, GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sellerId') sellerId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('fandom') fandom?: string,
  ) {
    const result = await this.productsService.findAll({ page, limit, sellerId, categoryId, status, fandom });
    return { data: result, message: 'Products retrieved' };
  }

  @Public()
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlug(slug);
    return { data: product, message: 'Product retrieved' };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return { data: product, message: 'Product retrieved' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  async create(@Body() data: any) {
    const product = await this.productsService.create(data);
    return { data: product, message: 'Product created' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  async update(@Param('id') id: string, @Body() data: any) {
    const product = await this.productsService.update(id, data);
    return { data: product, message: 'Product updated' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  async delete(@Param('id') id: string) {
    await this.productsService.delete(id);
    return { data: null, message: 'Product deleted' };
  }
}

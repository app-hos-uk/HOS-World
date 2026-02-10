import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from '../products/products.service';
import { Public } from '@hos-marketplace/auth-common';

@ApiTags('taxonomy')
@Controller()
export class TaxonomyController {
  constructor(private readonly productsService: ProductsService) {}

  @Public() @Get('taxonomy/categories')
  async getCategories() { return { data: await this.productsService.getCategories(), message: 'Categories retrieved' }; }

  @Public() @Get('fandoms')
  async getFandoms() { return { data: await this.productsService.getFandoms(), message: 'Fandoms retrieved' }; }

  @Public() @Get('characters')
  async getCharacters() { return { data: await this.productsService.getCharacters(), message: 'Characters retrieved' }; }

  @Public() @Get('taxonomy/attributes')
  async getAttributes() { return { data: await this.productsService.getAttributes(), message: 'Attributes retrieved' }; }
}

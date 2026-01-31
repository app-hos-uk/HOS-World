import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('products')
@Controller('products/bundles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BundleController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiOperation({
    summary: 'Create bundle product',
    description: 'Creates a new bundled product containing multiple products.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Bundle product created successfully' })
  async createBundle(
    @Request() req: any,
    @Body() createDto: CreateBundleDto,
  ): Promise<ApiResponse<any>> {
    const sellerId = req.user.role === 'ADMIN' ? createDto.sellerId : req.user.id;

    // Create bundle product
    const bundle = await this.productsService.createBundle(sellerId, createDto);

    return {
      data: bundle,
      message: 'Bundle product created successfully',
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get bundle product',
    description: 'Retrieves a bundle product with all its items.',
  })
  @ApiParam({ name: 'id', description: 'Bundle product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Bundle product retrieved successfully' })
  async getBundle(@Param('id') id: string): Promise<ApiResponse<any>> {
    const bundle = await this.productsService.findOne(id, undefined, true); // Include bundle items

    return {
      data: bundle,
      message: 'Bundle product retrieved successfully',
    };
  }
}

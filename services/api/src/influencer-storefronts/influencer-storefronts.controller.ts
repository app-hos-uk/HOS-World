import {
  Controller,
  Get,
  Put,
  Param,
  Body,
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
import { InfluencerStorefrontsService } from './influencer-storefronts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('influencer-storefronts')
@Controller()
export class InfluencerStorefrontsController {
  constructor(private readonly storefrontsService: InfluencerStorefrontsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/storefront')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my storefront settings' })
  @SwaggerApiResponse({ status: 200, description: 'Storefront retrieved successfully' })
  async getMyStorefront(@Request() req: any): Promise<ApiResponse<any>> {
    const storefront = await this.storefrontsService.findByUserId(req.user.id);
    return {
      data: storefront,
      message: 'Storefront retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Put('influencers/me/storefront')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update my storefront settings' })
  @SwaggerApiResponse({ status: 200, description: 'Storefront updated successfully' })
  async updateMyStorefront(
    @Request() req: any,
    @Body() dto: any,
  ): Promise<ApiResponse<any>> {
    const storefront = await this.storefrontsService.update(req.user.id, dto);
    return {
      data: storefront,
      message: 'Storefront updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Put('influencers/me/storefront/content-blocks')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update storefront content blocks' })
  @SwaggerApiResponse({ status: 200, description: 'Content blocks updated successfully' })
  async updateContentBlocks(
    @Request() req: any,
    @Body() body: { contentBlocks: any[] },
  ): Promise<ApiResponse<any>> {
    const storefront = await this.storefrontsService.updateContentBlocks(req.user.id, body.contentBlocks);
    return {
      data: storefront,
      message: 'Content blocks updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Put('influencers/me/storefront/featured-products')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update featured products' })
  @SwaggerApiResponse({ status: 200, description: 'Featured products updated successfully' })
  async updateFeaturedProducts(
    @Request() req: any,
    @Body() body: { productIds: string[] },
  ): Promise<ApiResponse<any>> {
    const storefront = await this.storefrontsService.updateFeaturedProducts(req.user.id, body.productIds);
    return {
      data: storefront,
      message: 'Featured products updated successfully',
    };
  }
}

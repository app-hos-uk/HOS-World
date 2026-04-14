import { Controller, Get, Post, Param, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DigitalProductsService, DigitalProduct, DownloadResult } from './digital-products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('digital-products')
@ApiBearerAuth('JWT-auth')
@Controller('digital-products')
@UseGuards(JwtAuthGuard)
export class DigitalProductsController {
  constructor(private readonly digitalProductsService: DigitalProductsService) {}

  @Get('my-purchases')
  @ApiOperation({
    summary: 'Get user digital product purchases',
    description: 'Retrieves all digital products purchased by the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Digital products retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyDigitalProducts(@Request() req: any): Promise<ApiResponse<DigitalProduct[]>> {
    const products = await this.digitalProductsService.getUserDigitalProducts(req.user.id);
    return {
      data: products,
      message: 'Digital products retrieved successfully',
    };
  }

  @Get(':id/file')
  @ApiOperation({
    summary: 'Download digital product file',
    description:
      'Redirects to a time-limited signed URL for the asset. Call POST .../download first to register the download.',
  })
  @ApiParam({ name: 'id', description: 'Digital product composite id (orderId-productId)', type: String })
  @SwaggerApiResponse({ status: 302, description: 'Redirect to file URL' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Download not allowed' })
  @SwaggerApiResponse({ status: 404, description: 'Product or file not found' })
  async serveFile(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.digitalProductsService.getSignedFileRedirectUrl(id, req.user.id);
    res.redirect(302, url);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get digital product details',
    description: 'Retrieves details of a specific digital product purchase.',
  })
  @ApiParam({ name: 'id', description: 'Digital product ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Digital product retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Access denied' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async getDigitalProduct(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<ApiResponse<DigitalProduct>> {
    const product = await this.digitalProductsService.getDigitalProduct(id, req.user.id);
    return {
      data: product,
      message: 'Digital product retrieved successfully',
    };
  }

  @Post(':id/download')
  @ApiOperation({
    summary: 'Download digital product',
    description:
      'Generates a secure download URL for the digital product. Increments download counter.',
  })
  @ApiParam({ name: 'id', description: 'Digital product ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Download URL generated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Download limit reached or expired' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
  async downloadDigitalProduct(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<ApiResponse<DownloadResult>> {
    const result = await this.digitalProductsService.downloadDigitalProduct(id, req.user.id);
    return {
      data: result,
      message: 'Download URL generated successfully',
    };
  }
}

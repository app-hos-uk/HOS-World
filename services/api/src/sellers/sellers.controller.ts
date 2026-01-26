import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('sellers')
@Version('1')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Public()
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get seller by slug',
    description: 'Retrieves a seller profile by slug. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Seller slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async findBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.findBySlug(slug);
    return {
      data: seller,
      message: 'Seller retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my seller profile',
    description: 'Retrieves the authenticated seller\'s profile. Requires seller role.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async getMyProfile(@Request() req: any): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.findOne(req.user.id);
    return {
      data: seller,
      message: 'Seller profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Put('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update my seller profile',
    description: 'Updates the authenticated seller\'s profile. Requires seller role.',
  })
  @ApiBody({ type: UpdateSellerDto })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller role required' })
  async updateMyProfile(
    @Request() req: any,
    @Body() updateSellerDto: UpdateSellerDto,
  ): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.update(req.user.id, updateSellerDto);
    return {
      data: seller,
      message: 'Seller profile updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get seller profile by user ID (Admin only)',
    description: 'Retrieves a seller profile by user ID. Admin access required.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.findOne(userId);
    return {
      data: seller,
      message: 'Seller profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update seller profile by user ID (Admin only)',
    description: 'Updates a seller profile by user ID. Admin access required.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID', type: String })
  @ApiBody({ type: UpdateSellerDto })
  @SwaggerApiResponse({ status: 200, description: 'Seller profile updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async updateSellerProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateSellerDto: UpdateSellerDto,
  ): Promise<ApiResponse<any>> {
    const seller = await this.sellersService.update(userId, updateSellerDto);
    return {
      data: seller,
      message: 'Seller profile updated successfully',
    };
  }
}


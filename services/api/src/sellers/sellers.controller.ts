import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SellersService } from './sellers.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Public()
  @Get('slug/:slug')
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


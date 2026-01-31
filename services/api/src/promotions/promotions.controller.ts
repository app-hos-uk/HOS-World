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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new promotion',
    description:
      'Creates a new promotion with specified conditions and actions. Requires ADMIN or MARKETING role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Promotion created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid promotion data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createDto: CreatePromotionDto): Promise<ApiResponse<any>> {
    const promotion = await this.promotionsService.create(createDto);
    return {
      data: promotion,
      message: 'Promotion created successfully',
    };
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all active promotions',
    description: 'Retrieves all active promotions. Public endpoint.',
  })
  @ApiQuery({ name: 'sellerId', required: false, description: 'Filter by seller ID' })
  @SwaggerApiResponse({ status: 200, description: 'Promotions retrieved successfully' })
  async findAll(@Query('sellerId') sellerId?: string): Promise<ApiResponse<any[]>> {
    const promotions = await this.promotionsService.findAll(sellerId);
    return {
      data: promotions,
      message: 'Promotions retrieved successfully',
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get promotion by ID',
    description: 'Retrieves a specific promotion by ID. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Promotion UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Promotion retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Promotion not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const promotion = await this.promotionsService.findOne(id);
    return {
      data: promotion,
      message: 'Promotion retrieved successfully',
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update promotion',
    description: 'Updates an existing promotion. Requires ADMIN or MARKETING role.',
  })
  @ApiParam({ name: 'id', description: 'Promotion UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Promotion updated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Promotion not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreatePromotionDto>,
  ): Promise<ApiResponse<any>> {
    const promotion = await this.promotionsService.update(id, updateDto);
    return {
      data: promotion,
      message: 'Promotion updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete promotion',
    description: 'Deletes a promotion by ID. Requires ADMIN or MARKETING role.',
  })
  @ApiParam({ name: 'id', description: 'Promotion UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Promotion deleted successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Promotion not found' })
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.promotionsService.delete(id);
    return {
      data: null,
      message: 'Promotion deleted successfully',
    };
  }

  @Post('coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a coupon',
    description: 'Creates a new coupon for a promotion. Requires ADMIN or MARKETING role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Coupon created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid coupon data' })
  async createCoupon(@Body() createDto: CreateCouponDto): Promise<ApiResponse<any>> {
    const coupon = await this.promotionsService.createCoupon(createDto);
    return {
      data: coupon,
      message: 'Coupon created successfully',
    };
  }

  @Post('coupons/validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Validate coupon code',
    description: 'Validates a coupon code and returns discount information.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Coupon validated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid or expired coupon' })
  @SwaggerApiResponse({ status: 404, description: 'Coupon not found' })
  async validateCoupon(
    @Request() req: any,
    @Body() body: { code: string; cartValue: number },
  ): Promise<ApiResponse<any>> {
    const result = await this.promotionsService.validateCoupon(
      body.code,
      req.user.id,
      body.cartValue,
    );
    return {
      data: result,
      message: 'Coupon validated successfully',
    };
  }

  @Post('coupons/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Apply coupon to cart',
    description: "Applies a coupon code to the user's cart.",
  })
  @SwaggerApiResponse({ status: 200, description: 'Coupon applied successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid or expired coupon' })
  async applyCoupon(
    @Request() req: any,
    @Body() body: { cartId: string; code: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.promotionsService.applyCouponToCart(
      body.cartId,
      req.user.id,
      body.code,
    );
    return {
      data: result,
      message: 'Coupon applied successfully',
    };
  }

  @Post('coupons/remove')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Remove coupon from cart',
    description: "Removes the applied coupon from the user's cart.",
  })
  @SwaggerApiResponse({ status: 200, description: 'Coupon removed successfully' })
  async removeCoupon(
    @Request() req: any,
    @Body() body: { cartId: string },
  ): Promise<ApiResponse<any>> {
    await this.promotionsService.removeCouponFromCart(body.cartId, req.user.id);
    return {
      data: null,
      message: 'Coupon removed successfully',
    };
  }
}

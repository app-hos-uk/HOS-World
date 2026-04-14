import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { InfluencersService } from './influencers.service';
import { InfluencerStorefrontsService } from '../influencer-storefronts/influencer-storefronts.service';
import {
  UpdateInfluencerDto,
  UpdateInfluencerCommissionDto,
  CreateProductLinkDto,
} from './dto/update-influencer.dto';
import { CreateCommissionRuleDto, UpdateCommissionRuleDto } from './dto/commission-rule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('influencers')
@Controller()
export class InfluencersController {
  constructor(
    private readonly influencersService: InfluencersService,
    private readonly storefrontsService: InfluencerStorefrontsService,
  ) {}

  // ============================================
  // INFLUENCER SELF-SERVICE ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my influencer profile',
    description: "Get the authenticated influencer's profile. Requires INFLUENCER role.",
  })
  @SwaggerApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getMyProfile(@Request() req: any): Promise<ApiResponse<any>> {
    const influencer = await this.influencersService.findByUserId(req.user.id);
    return {
      data: influencer,
      message: 'Profile retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Put('influencers/me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update my influencer profile',
    description: "Update the authenticated influencer's profile.",
  })
  @ApiBody({ type: UpdateInfluencerDto })
  @SwaggerApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMyProfile(
    @Request() req: any,
    @Body() dto: UpdateInfluencerDto,
  ): Promise<ApiResponse<any>> {
    const influencer = await this.influencersService.update(req.user.id, dto);
    return {
      data: influencer,
      message: 'Profile updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/analytics')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my analytics',
    description: 'Get analytics for the authenticated influencer.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getMyAnalytics(@Request() req: any): Promise<ApiResponse<any>> {
    const analytics = await this.influencersService.getAnalytics(req.user.id);
    return {
      data: analytics,
      message: 'Analytics retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Get('influencers/me/product-links')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my product links',
    description: 'Get all product links for the authenticated influencer.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Product links retrieved successfully' })
  async getMyProductLinks(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.influencersService.getProductLinks(req.user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Product links retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Post('influencers/me/product-links')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create product link',
    description: 'Create a new product link for tracking.',
  })
  @ApiBody({ type: CreateProductLinkDto })
  @SwaggerApiResponse({ status: 201, description: 'Product link created successfully' })
  async createProductLink(
    @Request() req: any,
    @Body() dto: CreateProductLinkDto,
  ): Promise<ApiResponse<any>> {
    const link = await this.influencersService.createProductLink(req.user.id, dto);
    return {
      data: link,
      message: 'Product link created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INFLUENCER')
  @Delete('influencers/me/product-links/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete product link',
    description: 'Delete a product link.',
  })
  @ApiParam({ name: 'id', description: 'Product link UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Product link deleted successfully' })
  async deleteProductLink(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.influencersService.deleteProductLink(req.user.id, id);
    return {
      data: null,
      message: result.message,
    };
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencers')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List all influencers',
    description: 'Get paginated list of all influencers. Admin/Marketing access required.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'] })
  @ApiQuery({ name: 'tier', required: false, enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Influencers retrieved successfully' })
  async findAll(
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.influencersService.findAll({
      status,
      tier,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Influencers retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencers/:id/commission-rules')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List commission rules for an influencer' })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Rules retrieved' })
  async listCommissionRules(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const data = await this.influencersService.listCommissionRules(id);
    return { data, message: 'Commission rules retrieved successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Post('admin/influencers/:id/commission-rules')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a commission rule (product, category, or brand scope)' })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @SwaggerApiResponse({ status: 201, description: 'Rule created' })
  async createCommissionRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommissionRuleDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.influencersService.createCommissionRule(id, dto);
    return { data, message: 'Commission rule created successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Put('admin/influencers/:id/commission-rules/:ruleId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a commission rule' })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Rule updated' })
  async updateCommissionRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateCommissionRuleDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.influencersService.updateCommissionRule(id, ruleId, dto);
    return { data, message: 'Commission rule updated successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Delete('admin/influencers/:id/commission-rules/:ruleId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a commission rule' })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Rule deleted' })
  async deleteCommissionRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<ApiResponse<any>> {
    const data = await this.influencersService.deleteCommissionRule(id, ruleId);
    return { data, message: data.message };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Get('admin/influencers/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get influencer by ID',
    description: 'Get influencer details. Admin/Marketing access required.',
  })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Influencer retrieved successfully' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const influencer = await this.influencersService.findOne(id);
    return {
      data: influencer,
      message: 'Influencer retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Put('admin/influencers/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update influencer',
    description: 'Update influencer profile fields, status, and tier. Admin and marketing access.',
  })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Influencer updated successfully' })
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInfluencerDto & { status?: string; tier?: string },
  ): Promise<ApiResponse<any>> {
    const influencer = await this.influencersService.adminUpdate(id, dto);
    return {
      data: influencer,
      message: 'Influencer updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING')
  @Put('admin/influencers/:id/commission')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update influencer commission config',
    description: 'Update commission rates and settings. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Influencer UUID' })
  @ApiBody({ type: UpdateInfluencerCommissionDto })
  @SwaggerApiResponse({ status: 200, description: 'Commission config updated successfully' })
  async updateCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInfluencerCommissionDto,
  ): Promise<ApiResponse<any>> {
    const influencer = await this.influencersService.updateCommission(id, dto);
    return {
      data: influencer,
      message: 'Commission config updated successfully',
    };
  }

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  @Public()
  @Get('i/:slug')
  @ApiOperation({
    summary: 'Get public storefront by slug',
    description:
      'Get public influencer profile, storefront and featured products. Matches frontend GetInfluencerStorefrontResponse.',
  })
  @ApiParam({ name: 'slug', description: 'Influencer slug' })
  @SwaggerApiResponse({ status: 200, description: 'Storefront retrieved successfully' })
  async getPublicStorefrontBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const data = await this.storefrontsService.getPublicStorefront(slug);
    return {
      data,
      message: 'Storefront retrieved successfully',
    };
  }
}

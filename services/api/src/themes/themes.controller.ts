import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThemesService } from './themes.service';
import { ThemeUploadService } from './theme-upload.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateSellerThemeDto } from './dto/update-seller-theme.dto';
import { UpdateCustomerThemePreferenceDto } from './dto/customer-theme-preference.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('themes')
@Controller('themes')
export class ThemesController {
  constructor(
    private readonly themesService: ThemesService,
    private readonly themeUploadService: ThemeUploadService,
  ) {}

  // Theme CRUD (Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create theme (Admin only)',
    description: 'Creates a new theme. Admin access required.',
  })
  @ApiBody({ type: CreateThemeDto })
  @SwaggerApiResponse({ status: 201, description: 'Theme created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async create(@Body() createThemeDto: CreateThemeDto): Promise<ApiResponse<any>> {
    const theme = await this.themesService.create(createThemeDto);
    return {
      data: theme,
      message: 'Theme created successfully',
    };
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all themes',
    description: 'Retrieves all available themes. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by theme type' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @SwaggerApiResponse({ status: 200, description: 'Themes retrieved successfully' })
  async findAll(
    @Query('type') type?: string,
    @Query('sellerId') sellerId?: string,
  ): Promise<ApiResponse<any[]>> {
    const themes = await this.themesService.findAll(type, sellerId);
    return {
      data: themes,
      message: 'Themes retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get theme by ID',
    description: 'Retrieves a specific theme by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Theme UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Theme retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Theme not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const theme = await this.themesService.findOne(id);
    return {
      data: theme,
      message: 'Theme retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update theme (Admin only)',
    description: 'Updates an existing theme. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Theme UUID', type: String })
  @ApiBody({ type: UpdateThemeDto })
  @SwaggerApiResponse({ status: 200, description: 'Theme updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Theme not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateThemeDto: UpdateThemeDto,
  ): Promise<ApiResponse<any>> {
    const theme = await this.themesService.update(id, updateThemeDto);
    return {
      data: theme,
      message: 'Theme updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete theme (Admin only)',
    description: 'Deletes a theme. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Theme UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Theme deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Theme not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ message: string }>> {
    await this.themesService.delete(id);
    return {
      data: { message: 'Theme deleted successfully' },
      message: 'Theme deleted successfully',
    };
  }

  // Seller Theme Customization
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Get('seller/my-theme')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my seller theme',
    description: "Retrieves the authenticated seller's theme. Seller access required.",
  })
  @SwaggerApiResponse({ status: 200, description: 'Seller theme retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller access required' })
  async getMySellerTheme(@Request() req: any): Promise<ApiResponse<any>> {
    const theme = await this.themesService.getSellerTheme(req.user.id);
    return {
      data: theme,
      message: 'Seller theme retrieved successfully',
    };
  }

  @Public()
  @Get('seller/:sellerId')
  @ApiOperation({
    summary: 'Get seller theme',
    description:
      "Retrieves a seller's theme by seller ID. Public endpoint, no authentication required.",
  })
  @ApiParam({ name: 'sellerId', description: 'Seller ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller theme retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Seller theme not found' })
  async getSellerTheme(@Param('sellerId') sellerId: string): Promise<ApiResponse<any>> {
    const theme = await this.themesService.getSellerTheme(sellerId);
    return {
      data: theme,
      message: 'Seller theme retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Put('seller/my-theme')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update my seller theme',
    description: "Updates the authenticated seller's theme. Seller access required.",
  })
  @ApiBody({ type: UpdateSellerThemeDto })
  @SwaggerApiResponse({ status: 200, description: 'Seller theme updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller access required' })
  async updateMySellerTheme(
    @Request() req: any,
    @Body() updateDto: UpdateSellerThemeDto,
  ): Promise<ApiResponse<any>> {
    const theme = await this.themesService.updateSellerTheme(req.user.id, updateDto);
    return {
      data: theme,
      message: 'Seller theme updated successfully',
    };
  }

  // Customer Theme Preferences
  @UseGuards(JwtAuthGuard)
  @Get('customer/preference')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get customer theme preference',
    description:
      "Retrieves the authenticated customer's theme preference (light/dark/accessibility).",
  })
  @SwaggerApiResponse({ status: 200, description: 'Theme preference retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getCustomerPreference(@Request() req: any): Promise<ApiResponse<any>> {
    const preference = await this.themesService.getCustomerThemePreference(req.user.id);
    return {
      data: { themePreference: preference },
      message: 'Theme preference retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('customer/preference')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update customer theme preference',
    description:
      "Updates the authenticated customer's theme preference (light/dark/accessibility).",
  })
  @ApiBody({ type: UpdateCustomerThemePreferenceDto })
  @SwaggerApiResponse({ status: 200, description: 'Theme preference updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCustomerPreference(
    @Request() req: any,
    @Body() updateDto: UpdateCustomerThemePreferenceDto,
  ): Promise<ApiResponse<any>> {
    await this.themesService.updateCustomerThemePreference(req.user.id, updateDto);
    return {
      data: { themePreference: updateDto.themePreference },
      message: 'Theme preference updated successfully',
    };
  }

  // Theme Templates
  @Public()
  @Get('templates/list')
  @ApiOperation({
    summary: 'Get theme templates',
    description:
      'Retrieves all available theme templates. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Theme templates retrieved successfully' })
  async getTemplates(): Promise<ApiResponse<any[]>> {
    const templates = await this.themesService.getThemeTemplates();
    return {
      data: templates,
      message: 'Theme templates retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @Post('templates/:templateId/apply')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Apply theme template (Seller only)',
    description:
      'Creates a new theme from a template for the authenticated seller. Seller access required.',
  })
  @ApiParam({ name: 'templateId', description: 'Template UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional custom theme name' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Theme created from template successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller access required' })
  @SwaggerApiResponse({ status: 404, description: 'Template not found' })
  async createFromTemplate(
    @Request() req: any,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() body: { name?: string },
  ): Promise<ApiResponse<any>> {
    const theme = await this.themesService.createThemeFromTemplate(
      req.user.id,
      templateId,
      body.name,
    );
    return {
      data: theme,
      message: 'Theme created from template successfully',
    };
  }

  // Theme Upload
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } })) // 50MB limit
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Upload theme (Admin only)',
    description: 'Uploads a theme file (ZIP). Admin access required. Maximum file size: 50MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Theme ZIP file',
        },
        name: { type: 'string', description: 'Theme name (optional)' },
        description: { type: 'string', description: 'Theme description (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Theme uploaded successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async uploadTheme(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata?: { name?: string; description?: string },
  ): Promise<ApiResponse<any>> {
    const theme = await this.themeUploadService.uploadTheme(file, req.user.id, metadata);
    return {
      data: theme,
      message: 'Theme uploaded successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/generate-preview')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Generate theme preview (Admin only)',
    description: 'Generates preview images for a theme. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Theme UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Preview generated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Theme not found' })
  async generatePreview(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ previewImages: string[] }>> {
    const previewImages = await this.themeUploadService.generatePreview(id);
    return {
      data: { previewImages },
      message: 'Preview generated successfully',
    };
  }
}

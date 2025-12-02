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
  async create(@Body() createThemeDto: CreateThemeDto): Promise<ApiResponse<any>> {
    const theme = await this.themesService.create(createThemeDto);
    return {
      data: theme,
      message: 'Theme created successfully',
    };
  }

  @Public()
  @Get()
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
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ message: string }>> {
    await this.themesService.delete(id);
    return {
      data: { message: 'Theme deleted successfully' },
      message: 'Theme deleted successfully',
    };
  }

  // Seller Theme Customization
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Get('seller/my-theme')
  async getMySellerTheme(@Request() req: any): Promise<ApiResponse<any>> {
    const theme = await this.themesService.getSellerTheme(req.user.id);
    return {
      data: theme,
      message: 'Seller theme retrieved successfully',
    };
  }

  @Public()
  @Get('seller/:sellerId')
  async getSellerTheme(@Param('sellerId') sellerId: string): Promise<ApiResponse<any>> {
    const theme = await this.themesService.getSellerTheme(sellerId);
    return {
      data: theme,
      message: 'Seller theme retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Put('seller/my-theme')
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
  async getCustomerPreference(@Request() req: any): Promise<ApiResponse<any>> {
    const preference = await this.themesService.getCustomerThemePreference(req.user.id);
    return {
      data: { themePreference: preference },
      message: 'Theme preference retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('customer/preference')
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
  async getTemplates(): Promise<ApiResponse<any[]>> {
    const templates = await this.themesService.getThemeTemplates();
    return {
      data: templates,
      message: 'Theme templates retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Post('templates/:templateId/apply')
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
  async uploadTheme(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata?: { name?: string; description?: string },
  ): Promise<ApiResponse<any>> {
    const theme = await this.themeUploadService.uploadTheme(
      file,
      req.user.id,
      metadata,
    );
    return {
      data: theme,
      message: 'Theme uploaded successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/generate-preview')
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

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CategoriesService, CreateCategoryDto, UpdateCategoryDto } from './categories.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('taxonomy/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  async findAll(): Promise<ApiResponse<any[]>> {
    const categories = await this.categoriesService.findAll();
    return {
      data: categories,
      message: 'Categories retrieved successfully',
    };
  }

  @Public()
  @Get('tree')
  async getCategoryTree(): Promise<ApiResponse<any[]>> {
    const tree = await this.categoriesService.getCategoryTree();
    return {
      data: tree,
      message: 'Category tree retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const category = await this.categoriesService.findOne(id);
    return {
      data: category,
      message: 'Category retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createCategory(@Body() createDto: CreateCategoryDto): Promise<ApiResponse<any>> {
    const category = await this.categoriesService.createCategory(createDto);
    return {
      data: category,
      message: 'Category created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCategoryDto,
  ): Promise<ApiResponse<any>> {
    const category = await this.categoriesService.updateCategory(id, updateDto);
    return {
      data: category,
      message: 'Category updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.categoriesService.deleteCategory(id);
    return {
      data: { id },
      message: 'Category deleted successfully',
    };
  }
}


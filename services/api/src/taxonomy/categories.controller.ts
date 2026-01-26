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
import { CategoriesService, CreateCategoryDto, UpdateCategoryDto } from './categories.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('taxonomy')
@Version('1')
@Controller('taxonomy/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Retrieves all categories. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async findAll(): Promise<ApiResponse<any[]>> {
    const categories = await this.categoriesService.findAll();
    return {
      data: categories,
      message: 'Categories retrieved successfully',
    };
  }

  @Public()
  @Get('tree')
  @ApiOperation({
    summary: 'Get category tree',
    description: 'Retrieves categories in a hierarchical tree structure. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Category tree retrieved successfully' })
  async getCategoryTree(): Promise<ApiResponse<any[]>> {
    const tree = await this.categoriesService.getCategoryTree();
    return {
      data: tree,
      message: 'Category tree retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get category by ID',
    description: 'Retrieves a specific category by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Category not found' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create category (Admin only)',
    description: 'Creates a new category. Admin access required.',
  })
  @ApiBody({
    description: 'Category creation data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        parentId: { type: 'string', format: 'uuid' },
        slug: { type: 'string' },
        imageUrl: { type: 'string' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Category created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update category (Admin only)',
    description: 'Updates an existing category. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID', type: String })
  @ApiBody({
    description: 'Category update data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        parentId: { type: 'string', format: 'uuid' },
        slug: { type: 'string' },
        imageUrl: { type: 'string' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Category updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Category not found' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete category (Admin only)',
    description: 'Deletes a category. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Category deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Category not found' })
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.categoriesService.deleteCategory(id);
    return {
      data: { id },
      message: 'Category deleted successfully',
    };
  }
}


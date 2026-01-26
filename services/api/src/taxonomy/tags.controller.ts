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
import { TagsService, CreateTagDto, UpdateTagDto } from './tags.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { TagCategory } from '@prisma/client';

@ApiTags('taxonomy')
@Controller('taxonomy/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all tags',
    description: 'Retrieves all tags with optional filtering. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by tag category' })
  @ApiQuery({ name: 'isActive', required: false, type: String, description: 'Filter by active status (true/false)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search tags by name' })
  @SwaggerApiResponse({ status: 200, description: 'Tags retrieved successfully' })
  async findAll(
    @Query('category') category?: TagCategory,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ): Promise<ApiResponse<any[]>> {
    const tags = await this.tagsService.findAll({
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });
    return {
      data: tags,
      message: 'Tags retrieved successfully',
    };
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search tags',
    description: 'Searches tags by query string. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @SwaggerApiResponse({ status: 200, description: 'Tags search completed successfully' })
  async searchTags(@Query('q') query: string): Promise<ApiResponse<any[]>> {
    const tags = await this.tagsService.searchTags(query);
    return {
      data: tags,
      message: 'Tags search completed successfully',
    };
  }

  @Public()
  @Get('category/:category')
  @ApiOperation({
    summary: 'Get tags by category',
    description: 'Retrieves all tags for a specific category. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'category', description: 'Tag category', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tags retrieved successfully' })
  async getTagsByCategory(@Param('category') category: TagCategory): Promise<ApiResponse<any[]>> {
    const tags = await this.tagsService.getTagsByCategory(category);
    return {
      data: tags,
      message: 'Tags retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get tag by ID',
    description: 'Retrieves a specific tag by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Tag UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tag retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Tag not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const tag = await this.tagsService.findOne(id);
    return {
      data: tag,
      message: 'Tag retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create tag (Admin only)',
    description: 'Creates a new tag. Admin access required.',
  })
  @ApiBody({
    description: 'Tag creation data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        slug: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Tag created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async createTag(@Body() createDto: CreateTagDto): Promise<ApiResponse<any>> {
    const tag = await this.tagsService.createTag(createDto);
    return {
      data: tag,
      message: 'Tag created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update tag (Admin only)',
    description: 'Updates an existing tag. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Tag UUID', type: String })
  @ApiBody({
    description: 'Tag update data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        slug: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Tag updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Tag not found' })
  async updateTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTagDto,
  ): Promise<ApiResponse<any>> {
    const tag = await this.tagsService.updateTag(id, updateDto);
    return {
      data: tag,
      message: 'Tag updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete tag (Admin only)',
    description: 'Deletes a tag. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Tag UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tag deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Tag not found' })
  async deleteTag(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.tagsService.deleteTag(id);
    return {
      data: { id },
      message: 'Tag deleted successfully',
    };
  }
}


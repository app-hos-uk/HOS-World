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
import { TagsService, CreateTagDto, UpdateTagDto } from './tags.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { TagCategory } from '@prisma/client';

@Controller('taxonomy/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Public()
  @Get()
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
  async searchTags(@Query('q') query: string): Promise<ApiResponse<any[]>> {
    const tags = await this.tagsService.searchTags(query);
    return {
      data: tags,
      message: 'Tags search completed successfully',
    };
  }

  @Public()
  @Get('category/:category')
  async getTagsByCategory(@Param('category') category: TagCategory): Promise<ApiResponse<any[]>> {
    const tags = await this.tagsService.getTagsByCategory(category);
    return {
      data: tags,
      message: 'Tags retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
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
  async deleteTag(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    await this.tagsService.deleteTag(id);
    return {
      data: { id },
      message: 'Tag deleted successfully',
    };
  }
}


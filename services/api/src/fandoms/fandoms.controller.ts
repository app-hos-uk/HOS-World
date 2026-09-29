import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FandomsService } from './fandoms.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('fandoms')
@Controller('fandoms')
export class FandomsController {
  constructor(private readonly fandomsService: FandomsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all fandoms',
    description: 'Retrieves all fandoms. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Fandoms retrieved successfully' })
  async findAll(): Promise<ApiResponse<any[]>> {
    const fandoms = await this.fandomsService.findAll();
    return {
      data: fandoms,
      message: 'Fandoms retrieved successfully',
    };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Get fandom by slug',
    description:
      'Retrieves a specific fandom by slug. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Fandom slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Fandom retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Fandom not found' })
  async findBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const fandom = await this.fandomsService.findBySlug(slug);
    return {
      data: fandom,
      message: 'Fandom retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'catalog.manage', scope: 'GLOBAL' })
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create fandom (Admin only)' })
  @SwaggerApiResponse({ status: 201, description: 'Fandom created successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async create(
    @Body() body: { name: string; slug: string; description?: string; imageUrl?: string },
  ): Promise<ApiResponse<any>> {
    const fandom = await this.fandomsService.create(body);
    return { data: fandom, message: 'Fandom created successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'catalog.manage', scope: 'GLOBAL' })
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update fandom (Admin only)' })
  @SwaggerApiResponse({ status: 200, description: 'Fandom updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Fandom not found' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string; description?: string; imageUrl?: string },
  ): Promise<ApiResponse<any>> {
    const fandom = await this.fandomsService.update(id, body);
    return { data: fandom, message: 'Fandom updated successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @RequireAccess({ permission: 'catalog.manage', scope: 'GLOBAL' })
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete fandom (Admin only)' })
  @SwaggerApiResponse({ status: 200, description: 'Fandom deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Fandom not found' })
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.fandomsService.remove(id);
    return { data: null, message: 'Fandom deleted successfully' };
  }
}

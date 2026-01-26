import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FandomsService } from './fandoms.service';
import { Public } from '../common/decorators/public.decorator';
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
    description: 'Retrieves a specific fandom by slug. Public endpoint, no authentication required.',
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
}


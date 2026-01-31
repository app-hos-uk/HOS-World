import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CharactersService } from './characters.service';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('characters')
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all characters',
    description:
      'Retrieves all characters. Can filter by fandom ID. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'fandomId', required: false, type: String, description: 'Filter by fandom ID' })
  @SwaggerApiResponse({ status: 200, description: 'Characters retrieved successfully' })
  async findAll(@Query('fandomId') fandomId?: string): Promise<ApiResponse<any[]>> {
    const characters = await this.charactersService.findAll(fandomId);
    return {
      data: characters,
      message: 'Characters retrieved successfully',
    };
  }

  @Public()
  @Get('fandom/:fandomSlug')
  @ApiOperation({
    summary: 'Get characters by fandom slug',
    description:
      'Retrieves all characters for a specific fandom by slug. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'fandomSlug', description: 'Fandom slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Characters retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Fandom not found' })
  async findByFandom(@Param('fandomSlug') fandomSlug: string): Promise<ApiResponse<any[]>> {
    const characters = await this.charactersService.findByFandom(fandomSlug);
    return {
      data: characters,
      message: 'Characters retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get character by ID',
    description:
      'Retrieves a specific character by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Character ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Character retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Character not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const character = await this.charactersService.findOne(id);
    return {
      data: character,
      message: 'Character retrieved successfully',
    };
  }
}

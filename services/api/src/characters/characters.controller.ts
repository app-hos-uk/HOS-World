import { Controller, Get, Param, Query } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Public()
  @Get()
  async findAll(@Query('fandomId') fandomId?: string): Promise<ApiResponse<any[]>> {
    const characters = await this.charactersService.findAll(fandomId);
    return {
      data: characters,
      message: 'Characters retrieved successfully',
    };
  }

  @Public()
  @Get('fandom/:fandomSlug')
  async findByFandom(@Param('fandomSlug') fandomSlug: string): Promise<ApiResponse<any[]>> {
    const characters = await this.charactersService.findByFandom(fandomSlug);
    return {
      data: characters,
      message: 'Characters retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const character = await this.charactersService.findOne(id);
    return {
      data: character,
      message: 'Character retrieved successfully',
    };
  }
}


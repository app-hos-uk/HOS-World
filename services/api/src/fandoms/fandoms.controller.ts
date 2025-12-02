import { Controller, Get, Param } from '@nestjs/common';
import { FandomsService } from './fandoms.service';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('fandoms')
export class FandomsController {
  constructor(private readonly fandomsService: FandomsService) {}

  @Public()
  @Get()
  async findAll(): Promise<ApiResponse<any[]>> {
    const fandoms = await this.fandomsService.findAll();
    return {
      data: fandoms,
      message: 'Fandoms retrieved successfully',
    };
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const fandom = await this.fandomsService.findBySlug(slug);
    return {
      data: fandom,
      message: 'Fandom retrieved successfully',
    };
  }
}


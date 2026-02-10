import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FandomsService } from './fandoms.service';

@ApiTags('fandoms')
@Controller('fandoms')
export class FandomsController {
  constructor(private readonly fandomsService: FandomsService) {}

  @Get() findAll() { return this.fandomsService.findAll(); }
  @Get(':slug') findBySlug(@Param('slug') slug: string) { return this.fandomsService.findBySlug(slug); }
  @Get(':slug/characters') getCharacters(@Param('slug') slug: string) {
    return this.fandomsService.findBySlug(slug).then((f) => this.fandomsService.getCharacters(f.id));
  }
}

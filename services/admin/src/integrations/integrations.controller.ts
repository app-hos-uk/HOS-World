import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles } from '@hos-marketplace/auth-common';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(GatewayAuthGuard)
@Roles('ADMIN')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post() create(@Body() body: any) { return this.integrationsService.create(body); }
  @Get() findAll() { return this.integrationsService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.integrationsService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.integrationsService.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.integrationsService.delete(id); }
}

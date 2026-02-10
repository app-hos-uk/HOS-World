import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles } from '@hos-marketplace/auth-common';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(GatewayAuthGuard)
@Roles('ADMIN', 'SELLER')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post() create(@Body() body: any) { return this.webhooksService.create(body); }
  @Get() findAll(@Query('sellerId') sellerId?: string) { return this.webhooksService.findAll(sellerId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.webhooksService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.webhooksService.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.webhooksService.delete(id); }
}

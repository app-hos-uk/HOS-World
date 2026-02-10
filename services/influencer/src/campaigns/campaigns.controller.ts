import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { CampaignsService } from './campaigns.service';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'MARKETING', 'INFLUENCER')
  create(@Body() body: any) { return this.campaignsService.create(body.influencerId, body); }

  @Get()
  findAll(@Query('influencerId') influencerId?: string, @Query('status') status?: string) {
    return this.campaignsService.findAll(influencerId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.campaignsService.findOne(id); }

  @Put(':id')
  @UseGuards(GatewayAuthGuard)
  update(@Param('id') id: string, @Body() body: any) { return this.campaignsService.update(id, body); }
}

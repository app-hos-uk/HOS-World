import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles } from '@hos-marketplace/auth-common';
import { CmsService } from './cms.service';

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages') getPages() { return this.cmsService.getPages(); }
  @Get('pages/:id') getPage(@Param('id') id: string) { return this.cmsService.getPage(id); }

  @Post('pages')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'CMS_EDITOR')
  createPage(@Body() body: any) { return this.cmsService.createPage(body); }

  @Put('pages/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'CMS_EDITOR')
  updatePage(@Param('id') id: string, @Body() body: any) { return this.cmsService.updatePage(id, body); }

  @Delete('pages/:id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  deletePage(@Param('id') id: string) { return this.cmsService.deletePage(id); }

  @Get('banners') getBanners(@Query('type') type?: string) { return this.cmsService.getBanners(type); }

  @Post('banners')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'MARKETING')
  createBanner(@Body() body: any) { return this.cmsService.createBanner(body); }

  @Get('blog') getBlogPosts(@Query('limit') limit?: string) { return this.cmsService.getBlogPosts(limit ? parseInt(limit) : undefined); }
  @Get('blog/:id') getBlogPost(@Param('id') id: string) { return this.cmsService.getBlogPost(id); }

  @Post('blog')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN', 'CMS_EDITOR')
  createBlogPost(@Body() body: any) { return this.cmsService.createBlogPost(body); }
}

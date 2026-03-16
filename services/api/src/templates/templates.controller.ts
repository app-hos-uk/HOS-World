import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { TemplatesService, TemplateChannel } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('templates')
@ApiBearerAuth('JWT-auth')
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all notification templates' })
  @ApiQuery({ name: 'channel', required: false, enum: ['EMAIL', 'WHATSAPP', 'SMS', 'IN_APP'] })
  @SwaggerApiResponse({ status: 200, description: 'Template list returned' })
  async listTemplates(
    @Query('channel') channel?: string,
  ): Promise<ApiResponse<any>> {
    const templates = await this.templatesService.listTemplates(channel as TemplateChannel);
    return { data: templates, message: 'Templates retrieved' };
  }

  @Get(':slug/preview')
  @ApiOperation({ summary: 'Preview a template rendered with sample data' })
  @ApiParam({ name: 'slug', description: 'Template slug' })
  @SwaggerApiResponse({ status: 200, description: 'Preview rendered' })
  async previewTemplate(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const preview = await this.templatesService.preview(slug);
    return { data: preview, message: 'Template preview rendered' };
  }

  @Post(':slug/render')
  @ApiOperation({ summary: 'Render a template with provided variables' })
  @ApiParam({ name: 'slug', description: 'Template slug' })
  @SwaggerApiResponse({ status: 200, description: 'Template rendered' })
  async renderTemplate(
    @Param('slug') slug: string,
    @Body() body: { variables: Record<string, string> },
  ): Promise<ApiResponse<any>> {
    const rendered = await this.templatesService.render(slug, body.variables);
    return { data: rendered, message: 'Template rendered' };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single template definition by slug' })
  @ApiParam({ name: 'slug', description: 'Template slug, e.g. order_confirmation' })
  @SwaggerApiResponse({ status: 200, description: 'Template returned' })
  async getTemplate(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const template = await this.templatesService.getTemplate(slug);
    return { data: template, message: 'Template retrieved' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom template override (stored in DB)' })
  @SwaggerApiResponse({ status: 201, description: 'Template created' })
  async createTemplate(
    @Body()
    body: {
      name: string;
      category: string;
      content: string;
      variables?: string[];
    },
  ): Promise<ApiResponse<any>> {
    const template = await this.templatesService.createTemplate(body);
    return { data: template, message: 'Template created' };
  }

  @Put(':slug')
  @ApiOperation({ summary: 'Update a custom template override' })
  @ApiParam({ name: 'slug', description: 'Template slug / name' })
  @SwaggerApiResponse({ status: 200, description: 'Template updated' })
  async updateTemplate(
    @Param('slug') slug: string,
    @Body()
    body: {
      content?: string;
      variables?: string[];
      isActive?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    const template = await this.templatesService.updateTemplate(slug, body);
    return { data: template, message: 'Template updated' };
  }

  @Put(':slug/activate')
  @ApiOperation({ summary: 'Activate a template' })
  @SwaggerApiResponse({ status: 200, description: 'Template activated' })
  async activateTemplate(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const template = await this.templatesService.updateTemplate(slug, { isActive: true });
    return { data: template, message: 'Template activated' };
  }

  @Put(':slug/deactivate')
  @ApiOperation({ summary: 'Deactivate a template' })
  @SwaggerApiResponse({ status: 200, description: 'Template deactivated' })
  async deactivateTemplate(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const template = await this.templatesService.updateTemplate(slug, { isActive: false });
    return { data: template, message: 'Template deactivated' };
  }
}

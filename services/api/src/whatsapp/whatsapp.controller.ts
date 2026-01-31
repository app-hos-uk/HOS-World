import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('send')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send WhatsApp message (Admin only)',
    description: 'Sends a WhatsApp message to a phone number. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'message'],
      properties: {
        to: { type: 'string', description: 'Phone number (E.164 format)' },
        message: { type: 'string', description: 'Message text' },
        mediaUrl: { type: 'string', description: 'Optional media URL' },
        userId: { type: 'string', format: 'uuid', description: 'Optional user ID' },
        sellerId: { type: 'string', format: 'uuid', description: 'Optional seller ID' },
        ticketId: { type: 'string', format: 'uuid', description: 'Optional ticket ID' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'WhatsApp message sent successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async sendMessage(
    @Body()
    body: {
      to: string;
      message: string;
      mediaUrl?: string;
      userId?: string;
      sellerId?: string;
      ticketId?: string;
    },
  ): Promise<ApiResponse<any>> {
    const message = await this.whatsappService.sendMessage(body);
    return {
      data: message,
      message: 'WhatsApp message sent successfully',
    };
  }

  @Public()
  @Post('webhook')
  @ApiOperation({
    summary: 'Handle WhatsApp webhook',
    description: 'Receives webhook events from WhatsApp API',
  })
  @ApiBody({ description: 'Webhook payload from WhatsApp' })
  @SwaggerApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() body: any): Promise<ApiResponse<any>> {
    const message = await this.whatsappService.handleWebhook(body);
    return {
      data: message,
      message: 'Webhook processed successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('conversations')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get conversations (Admin only)',
    description: 'Retrieves WhatsApp conversations with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'ticketId', required: false, type: String, description: 'Filter by ticket ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by conversation status',
  })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Conversations retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getConversations(
    @Query('userId') userId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('ticketId') ticketId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.whatsappService.getConversations({
      userId,
      sellerId,
      ticketId,
      status: status as any,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Conversations retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('conversations/:id/messages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get conversation messages (Admin only)',
    description: 'Retrieves messages for a specific conversation. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversationMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.whatsappService.getConversationMessages(id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Messages retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('templates')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create WhatsApp template (Admin only)',
    description: 'Creates a new WhatsApp message template. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'category', 'content'],
      properties: {
        name: { type: 'string', description: 'Template name' },
        category: { type: 'string', description: 'Template category' },
        content: { type: 'string', description: 'Template content' },
        variables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional variable names',
        },
        approvedBy: { type: 'string', description: 'Approver name (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Template created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid template data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async createTemplate(
    @Body()
    body: {
      name: string;
      category: string;
      content: string;
      variables?: string[];
      approvedBy?: string;
    },
  ): Promise<ApiResponse<any>> {
    const template = await this.whatsappService.createTemplate(body);
    return {
      data: template,
      message: 'Template created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('templates')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get WhatsApp templates (Admin only)',
    description: 'Retrieves WhatsApp message templates. Admin access required.',
  })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: String,
    description: 'Filter by active status (true/false)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getTemplates(
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ): Promise<ApiResponse<any[]>> {
    const templates = await this.whatsappService.getTemplates({
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    return {
      data: templates,
      message: 'Templates retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('send-template')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send template message (Admin only)',
    description: 'Sends a WhatsApp message using a template. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'templateName', 'variables'],
      properties: {
        to: { type: 'string', description: 'Phone number (E.164 format)' },
        templateName: { type: 'string', description: 'Template name' },
        variables: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Template variables',
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Template message sent successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid template or variables' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async sendTemplateMessage(
    @Body()
    body: {
      to: string;
      templateName: string;
      variables: Record<string, string>;
    },
  ): Promise<ApiResponse<any>> {
    const message = await this.whatsappService.sendTemplateMessage(body);
    return {
      data: message,
      message: 'Template message sent successfully',
    };
  }
}

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
import {
  GatewayAuthGuard,
  RolesGuard,
  Roles,
  Public,
} from '@hos-marketplace/auth-common';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('send')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send WhatsApp message (Admin only)',
    description: 'Sends a WhatsApp message to a phone number.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'message'],
      properties: {
        to: { type: 'string', description: 'Phone number (E.164 format)' },
        message: { type: 'string', description: 'Message text' },
        mediaUrl: { type: 'string', description: 'Optional media URL' },
        userId: { type: 'string', format: 'uuid' },
        sellerId: { type: 'string', format: 'uuid' },
        ticketId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'WhatsApp message sent' })
  @SwaggerApiResponse({ status: 403, description: 'Admin access required' })
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
  ) {
    const message = await this.whatsappService.sendMessage(body);
    return { data: message, message: 'WhatsApp message sent successfully' };
  }

  @Public()
  @Post('webhook')
  @ApiOperation({
    summary: 'Handle WhatsApp webhook',
    description: 'Receives webhook events from WhatsApp/Twilio.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(@Body() body: any) {
    const message = await this.whatsappService.handleWebhook(body);
    return { data: message, message: 'Webhook processed successfully' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('conversations')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get WhatsApp conversations (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'sellerId', required: false, type: String })
  @ApiQuery({ name: 'ticketId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Conversations retrieved' })
  async getConversations(
    @Query('userId') userId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('ticketId') ticketId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.whatsappService.getConversations({
      userId,
      sellerId,
      ticketId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data: result, message: 'Conversations retrieved successfully' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('conversations/:id/messages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get conversation messages (Admin only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Messages retrieved' })
  async getConversationMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.whatsappService.getConversationMessages(id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data: result, message: 'Messages retrieved successfully' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('templates')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create WhatsApp template (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'category', 'content'],
      properties: {
        name: { type: 'string' },
        category: { type: 'string' },
        content: { type: 'string' },
        variables: { type: 'array', items: { type: 'string' } },
        approvedBy: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Template created' })
  async createTemplate(
    @Body()
    body: {
      name: string;
      category: string;
      content: string;
      variables?: string[];
      approvedBy?: string;
    },
  ) {
    const template = await this.whatsappService.createTemplate(body);
    return { data: template, message: 'Template created successfully' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('templates')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get WhatsApp templates (Admin only)' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Templates retrieved' })
  async getTemplates(
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    const templates = await this.whatsappService.getTemplates({
      category,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    return { data: templates, message: 'Templates retrieved successfully' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('send-template')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send template message (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'templateName', 'variables'],
      properties: {
        to: { type: 'string' },
        templateName: { type: 'string' },
        variables: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Template message sent' })
  async sendTemplateMessage(
    @Body()
    body: {
      to: string;
      templateName: string;
      variables: Record<string, string>;
    },
  ) {
    const message = await this.whatsappService.sendTemplateMessage(body);
    return { data: message, message: 'Template message sent successfully' };
  }
}

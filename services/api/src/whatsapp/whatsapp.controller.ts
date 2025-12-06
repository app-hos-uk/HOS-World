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
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('send')
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


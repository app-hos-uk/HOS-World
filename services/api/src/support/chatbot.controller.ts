import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('support/chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Public()
  @Post('message')
  async sendMessage(
    @Body()
    body: {
      userId?: string;
      sellerId?: string;
      message: string;
      conversationId?: string;
      context?: {
        orderId?: string;
        productId?: string;
        ticketId?: string;
      };
    },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.chatbotService.processMessage({
      ...body,
      userId: body.userId || req.user?.id,
    });
    return {
      data: result,
      message: 'Message processed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('escalate')
  async escalateToHuman(
    @Body()
    body: {
      userId?: string;
      sellerId?: string;
      message: string;
      conversationId?: string;
      reason?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.chatbotService.escalateToHuman({
      ...body,
      userId: body.userId || req.user?.id,
    });
    return {
      data: result,
      message: 'Conversation escalated successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:conversationId')
  async getChatHistory(
    @Param('conversationId') conversationId: string,
  ): Promise<ApiResponse<any[]>> {
    const history = await this.chatbotService.getChatHistory(conversationId);
    return {
      data: history,
      message: 'Chat history retrieved successfully',
    };
  }
}


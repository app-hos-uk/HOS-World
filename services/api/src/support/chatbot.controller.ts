import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('support')
@Controller('support/chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Public()
  @Post('message')
  @ApiOperation({
    summary: 'Send chatbot message',
    description: 'Sends a message to the chatbot and receives a response. Public endpoint, no authentication required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['message'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        sellerId: { type: 'string', format: 'uuid' },
        message: { type: 'string', description: 'User message' },
        conversationId: { type: 'string', description: 'Existing conversation ID' },
        context: {
          type: 'object',
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            ticketId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Message processed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Escalate conversation to human',
    description: 'Escalates a chatbot conversation to a human support agent.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['message'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        sellerId: { type: 'string', format: 'uuid' },
        message: { type: 'string', description: 'User message' },
        conversationId: { type: 'string', description: 'Conversation ID' },
        reason: { type: 'string', description: 'Reason for escalation' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Conversation escalated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get chat history',
    description: 'Retrieves the chat history for a specific conversation.',
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Chat history retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Conversation not found' })
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


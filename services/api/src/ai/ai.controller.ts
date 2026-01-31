import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AIChatService } from './ai-chat.service';
import { PersonalizationService } from './personalization.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('ai')
@ApiBearerAuth('JWT-auth')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiChatService: AIChatService,
    private readonly personalizationService: PersonalizationService,
  ) {}

  @Post('chat/:characterId')
  @ApiOperation({
    summary: 'Send AI chat message',
    description:
      'Sends a message to an AI character and receives a response. Requires authentication.',
  })
  @ApiParam({ name: 'characterId', description: 'Character ID', type: String })
  @ApiBody({ type: SendChatMessageDto })
  @SwaggerApiResponse({ status: 200, description: 'Message sent successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid message data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Character not found' })
  async sendMessage(
    @Request() req: any,
    @Param('characterId') characterId: string,
    @Body() dto: SendChatMessageDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.aiChatService.sendMessage(req.user.id, characterId, dto);
    return {
      data: result,
      message: 'Message sent successfully',
    };
  }

  @Get('chat/history')
  @ApiOperation({
    summary: 'Get chat history',
    description:
      'Retrieves the chat history for the authenticated user, optionally filtered by character. Requires authentication.',
  })
  @ApiQuery({
    name: 'characterId',
    required: false,
    type: String,
    description: 'Filter by character ID (optional)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Chat history retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getChatHistory(
    @Request() req: any,
    @Query('characterId') characterId?: string,
  ): Promise<ApiResponse<any[]>> {
    const history = await this.aiChatService.getChatHistory(req.user.id, characterId);
    return {
      data: history,
      message: 'Chat history retrieved successfully',
    };
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Get personalized recommendations',
    description:
      'Retrieves AI-powered personalized product recommendations for the authenticated user. Requires authentication.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Recommendations retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecommendations(@Request() req: any): Promise<ApiResponse<any[]>> {
    const products = await this.personalizationService.getPersonalizedProducts(req.user.id);
    return {
      data: products,
      message: 'Personalized recommendations retrieved successfully',
    };
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AIChatService } from './ai-chat.service';
import { PersonalizationService } from './personalization.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiChatService: AIChatService,
    private readonly personalizationService: PersonalizationService,
  ) {}

  @Post('chat/:characterId')
  async sendMessage(
    @Request() req: any,
    @Param('characterId') characterId: string,
    @Body() dto: SendChatMessageDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.aiChatService.sendMessage(
      req.user.id,
      characterId,
      dto,
    );
    return {
      data: result,
      message: 'Message sent successfully',
    };
  }

  @Get('chat/history')
  async getChatHistory(
    @Request() req: any,
    @Param('characterId') characterId?: string,
  ): Promise<ApiResponse<any[]>> {
    const history = await this.aiChatService.getChatHistory(
      req.user.id,
      characterId,
    );
    return {
      data: history,
      message: 'Chat history retrieved successfully',
    };
  }

  @Get('recommendations')
  async getRecommendations(@Request() req: any): Promise<ApiResponse<any[]>> {
    const products = await this.personalizationService.getPersonalizedProducts(
      req.user.id,
    );
    return {
      data: products,
      message: 'Personalized recommendations retrieved successfully',
    };
  }
}


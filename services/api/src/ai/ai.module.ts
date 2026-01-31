import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIChatService } from './ai-chat.service';
import { PersonalizationService } from './personalization.service';
import { GeminiService } from './gemini.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [AIController],
  providers: [GeminiService, AIChatService, PersonalizationService],
  exports: [GeminiService, AIChatService, PersonalizationService],
})
export class AIModule {}

import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, AIModule],
  controllers: [TicketsController, ChatbotController, KnowledgeBaseController],
  providers: [TicketsService, ChatbotService, KnowledgeBaseService],
  exports: [TicketsService, ChatbotService, KnowledgeBaseService],
})
export class SupportModule {}


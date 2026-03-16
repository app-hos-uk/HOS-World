import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { DatabaseModule } from '../database/database.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [DatabaseModule, TemplatesModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}

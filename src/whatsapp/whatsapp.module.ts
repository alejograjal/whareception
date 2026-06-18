import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsAppClientModule } from './whatsapp-client.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [ConversationsModule, WhatsAppClientModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
})
export class WhatsAppModule {}

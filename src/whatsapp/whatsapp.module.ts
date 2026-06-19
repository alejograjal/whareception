import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WHATSAPP_INBOUND_QUEUE } from '../queue/queue.module';
import { WhatsAppClientModule } from './whatsapp-client.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { InboundProcessor } from './inbound.processor';
import { MetaSignatureGuard } from './meta-signature.guard';

@Module({
  imports: [
    ConversationsModule,
    TenantsModule,
    WhatsAppClientModule,
    BullModule.registerQueue({ name: WHATSAPP_INBOUND_QUEUE }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, InboundProcessor, MetaSignatureGuard],
})
export class WhatsAppModule {}

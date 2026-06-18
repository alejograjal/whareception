import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TenantsModule } from './tenants/tenants.module';
import { LlmModule } from './llm/llm.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    TenantsModule,
    LlmModule,
    ConversationsModule,
    WhatsAppModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

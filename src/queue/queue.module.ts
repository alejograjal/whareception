import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';

export const WHATSAPP_INBOUND_QUEUE = 'whatsapp-inbound';

/**
 * Configures BullMQ against the same Redis instance used for conversation
 * state, and registers the inbound-message queue. Inbound webhook messages are
 * enqueued and processed in the background with retries so the webhook can
 * acknowledge Meta immediately.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = new URL(config.get('REDIS_URL', { infer: true }));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: WHATSAPP_INBOUND_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

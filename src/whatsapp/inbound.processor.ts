import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { WHATSAPP_INBOUND_QUEUE } from '../queue/queue.module';
import { NormalizedInboundMessage } from './dto/meta-webhook.dto';
import { WhatsAppService } from './whatsapp.service';

// Inbound message ids are remembered for 24h to deduplicate Meta's retries.
const DEDUP_TTL_SECONDS = 86_400;

/**
 * Background worker that processes inbound WhatsApp messages enqueued by the
 * webhook. Deduplicates Meta retries, then hands the message to the engine.
 */
@Processor(WHATSAPP_INBOUND_QUEUE)
export class InboundProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundProcessor.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<NormalizedInboundMessage>): Promise<void> {
    const msg = job.data;

    // Deduplicate: WhatsApp may deliver the same message id more than once.
    const fresh = await this.redis.client.set(
      `wamid:${msg.providerMessageId}`,
      '1',
      'EX',
      DEDUP_TTL_SECONDS,
      'NX',
    );
    if (fresh !== 'OK') {
      this.logger.log(`Duplicate message ${msg.providerMessageId} — skipped.`);
      return;
    }

    await this.whatsapp.handleMetaMessage(msg);
  }

  // Surface terminal failures (after retries) for observability.
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `Inbound job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }
}

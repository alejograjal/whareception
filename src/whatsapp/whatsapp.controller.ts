import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Env } from '../config/env.schema';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { WHATSAPP_INBOUND_QUEUE } from '../queue/queue.module';
import { WhatsAppService } from './whatsapp.service';
import {
  SimulateMessageDto,
  simulateMessageSchema,
} from './dto/simulate-message.dto';
import {
  extractInboundMessages,
  metaWebhookSchema,
} from './dto/meta-webhook.dto';
import { MetaSignatureGuard } from './meta-signature.guard';

@Controller()
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(WHATSAPP_INBOUND_QUEUE) private readonly inboundQueue: Queue,
  ) {}

  /**
   * Local simulation endpoint. Same engine path as a real message, but the
   * tenant is resolved by slug and processing is synchronous for easy testing.
   *
   *   POST /sim/messages
   *   { "tenantId": "demo-vet", "from": "+50688888888", "message": "..." }
   */
  @Post('sim/messages')
  @UsePipes(new ZodValidationPipe(simulateMessageSchema))
  async simulate(@Body() dto: SimulateMessageDto) {
    const result = await this.whatsapp.handleSimulated(
      dto.tenantId,
      dto.from,
      dto.message,
    );
    return {
      reply: result.reply,
      intent: result.intent,
      silent: result.silent ?? false,
      createdAppointmentId: result.createdAppointmentId ?? null,
      createdHandoffId: result.createdHandoffId ?? null,
    };
  }

  /**
   * Meta webhook verification handshake (GET).
   */
  @Get('webhooks/whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expected = this.config.get('WHATSAPP_VERIFY_TOKEN', { infer: true });
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  /**
   * Meta webhook receiver (POST). Verifies the signature, stores the raw event
   * for audit, enqueues each inbound text message for background processing,
   * and acknowledges immediately so Meta does not retry.
   */
  @Post('webhooks/whatsapp')
  @UseGuards(MetaSignatureGuard)
  @HttpCode(200)
  async receive(@Body() rawPayload: unknown): Promise<{ received: true }> {
    const parsed = metaWebhookSchema.safeParse(rawPayload);

    await this.prisma.webhookEvent.create({
      data: {
        source: 'whatsapp',
        payload: rawPayload as object,
        processed: parsed.success,
        error: parsed.success ? null : 'Payload failed schema validation',
      },
    });

    if (!parsed.success) {
      // Acknowledge anyway — retrying a malformed payload won't help.
      this.logger.warn('Received webhook payload that failed validation.');
      return { received: true };
    }

    const messages = extractInboundMessages(parsed.data);
    for (const msg of messages) {
      await this.inboundQueue.add('inbound', msg, { jobId: msg.providerMessageId });
    }
    if (messages.length) {
      this.logger.log(`Enqueued ${messages.length} inbound message(s).`);
    }

    return { received: true };
  }
}

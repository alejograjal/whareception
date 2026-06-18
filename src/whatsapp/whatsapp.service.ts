import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { EngineResult } from '../common/types';
import {
  WHATSAPP_CLIENT,
  WhatsAppClient,
} from './whatsapp-client.interface';

export interface InboundResult extends EngineResult {
  to: string;
}

/**
 * Glue between an inbound WhatsApp message (real or simulated) and the
 * conversation engine: runs the engine, then delivers the reply through the
 * configured WhatsApp client.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_CLIENT) private readonly client: WhatsAppClient,
  ) {}

  async processInbound(
    tenantSlug: string,
    fromPhone: string,
    body: string,
  ): Promise<InboundResult> {
    const result = await this.conversations.handleInboundMessage(
      tenantSlug,
      fromPhone,
      body,
    );

    await this.client.sendText({ to: fromPhone, body: result.reply });

    return { ...result, to: fromPhone };
  }

  /** Stores a raw webhook payload for audit/replay (Phase 2 parses it). */
  async recordWebhookEvent(payload: unknown): Promise<void> {
    await this.prisma.webhookEvent.create({
      data: { source: 'whatsapp', payload: payload as object },
    });
  }
}

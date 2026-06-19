import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { TenantConfig, TenantsService } from '../tenants/tenants.service';
import { EngineResult } from '../common/types';
import { NormalizedInboundMessage } from './dto/meta-webhook.dto';
import {
  WHATSAPP_CLIENT,
  WhatsAppClient,
} from './whatsapp-client.interface';

export interface InboundResult extends EngineResult {
  to: string;
}

/**
 * Glue between an inbound WhatsApp message (real or simulated) and the
 * conversation engine: resolves the tenant, runs the engine, then delivers the
 * reply through the configured WhatsApp client (unless the bot is staying
 * silent because a human is handling the conversation).
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly tenants: TenantsService,
    @Inject(WHATSAPP_CLIENT) private readonly client: WhatsAppClient,
  ) {}

  /** Simulation endpoint path: tenant resolved by slug. */
  async handleSimulated(
    tenantSlug: string,
    fromPhone: string,
    body: string,
  ): Promise<InboundResult> {
    const tenant = await this.tenants.getBySlug(tenantSlug);
    return this.run(tenant, fromPhone, body);
  }

  /** Real webhook path: tenant resolved by Meta phone_number_id. */
  async handleMetaMessage(msg: NormalizedInboundMessage): Promise<InboundResult> {
    const tenant = await this.tenants.getByPhoneNumberId(msg.phoneNumberId);
    return this.run(tenant, msg.from, msg.body, msg.providerMessageId);
  }

  private async run(
    tenant: TenantConfig,
    fromPhone: string,
    body: string,
    providerMessageId?: string,
  ): Promise<InboundResult> {
    const result = await this.conversations.handleInboundMessage(
      tenant,
      fromPhone,
      body,
      { providerMessageId },
    );

    if (!result.silent && result.reply) {
      await this.client.sendText({
        to: fromPhone,
        body: result.reply,
        fromPhoneNumberId: tenant.whatsappPhoneNumberId ?? undefined,
      });
    } else if (result.silent) {
      this.logger.log(
        `Bot silent for ${fromPhone} (handoff active); message recorded.`,
      );
    }

    return { ...result, to: fromPhone };
  }
}

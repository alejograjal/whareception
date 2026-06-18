import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';
import {
  OutboundMessage,
  WhatsAppClient,
} from './whatsapp-client.interface';

/**
 * Meta WhatsApp Cloud API client. Wired but only exercised when
 * WHATSAPP_PROVIDER=meta. Full webhook/receive integration is Phase 2.
 */
@Injectable()
export class MetaWhatsAppClient implements WhatsAppClient {
  private readonly logger = new Logger(MetaWhatsAppClient.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.accessToken = this.config.get('WHATSAPP_ACCESS_TOKEN', {
      infer: true,
    }) as string;
    this.phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID', {
      infer: true,
    }) as string;
  }

  async sendText(
    message: OutboundMessage,
  ): Promise<{ providerMessageId: string }> {
    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.to,
        type: 'text',
        text: { body: message.body },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Meta send failed (${res.status}): ${detail}`);
      throw new Error(`WhatsApp Cloud API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      messages?: { id: string }[];
    };
    return { providerMessageId: data.messages?.[0]?.id ?? 'unknown' };
  }
}

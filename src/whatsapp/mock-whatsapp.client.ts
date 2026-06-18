import { Injectable, Logger } from '@nestjs/common';
import {
  OutboundMessage,
  WhatsAppClient,
} from './whatsapp-client.interface';

/**
 * Local development client. Logs outbound messages instead of calling the
 * WhatsApp Cloud API. Lets the full pipeline run with no external integration.
 */
@Injectable()
export class MockWhatsAppClient implements WhatsAppClient {
  private readonly logger = new Logger(MockWhatsAppClient.name);
  private counter = 0;

  async sendText(
    message: OutboundMessage,
  ): Promise<{ providerMessageId: string }> {
    const providerMessageId = `mock-${++this.counter}`;
    this.logger.log(
      `[OUTBOUND -> ${message.to}] (${providerMessageId})\n${message.body}`,
    );
    return { providerMessageId };
  }
}

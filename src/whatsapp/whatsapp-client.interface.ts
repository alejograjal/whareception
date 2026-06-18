export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');

export interface OutboundMessage {
  to: string;
  body: string;
}

/**
 * Adapter boundary for sending WhatsApp messages. The mock implementation
 * logs sends for local development; the Meta implementation calls the Cloud
 * API (Phase 2).
 */
export interface WhatsAppClient {
  sendText(message: OutboundMessage): Promise<{ providerMessageId: string }>;
}
